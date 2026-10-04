export type SpeechEvents = {
  onEnd: () => void;
  onError: (message: string) => void;
};

// A future provider can fetch audio and play it behind the same contract.
export interface SpeechProvider {
  speak(text: string, events: SpeechEvents): () => void;
}

export const browserSpeechProvider: SpeechProvider = {
  speak(text, events) {
    if (typeof window === "undefined" || !("speechSynthesis" in window) ||
        !("SpeechSynthesisUtterance" in window)) {
      throw new Error("This browser does not support text-to-speech.");
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.onend = events.onEnd;
    utterance.onerror = (event) => {
      events.onError(event.error === "not-allowed"
        ? "Your browser blocked speech. Try the reply's Speak button."
        : "Speech playback failed. Try the reply's Speak button.");
    };
    window.speechSynthesis.speak(utterance);
    return () => {
      utterance.onend = null;
      utterance.onerror = null;
      window.speechSynthesis.cancel();
    };
  },
};

export function nextSpeechBoundary(text: string, finished: boolean): number {
  for (const match of text.matchAll(/[.!?।](?:["'”’\)\]]+)?(?=\s)/g)) {
    const end = match.index! + match[0].length;
    if (/\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|e\.g|i\.e)\.$/i.test(text.slice(0, end))) continue;
    return end;
  }
  if (text.length > 240) {
    const split = text.lastIndexOf(" ", 240);
    if (split > 80) return split + 1;
  }
  return finished ? text.length : 0;
}

function spokenText(text: string) {
  return text.replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/(^|\n)\s{0,3}(?:#{1,6}\s+|[-*+]\s+)/g, "$1")
    .replace(/[*_`]/g, "").trim();
}

type ResponseSpeech = {
  enabled: boolean;
  id: string | null;
  offset: number;
  previousIds: Set<string>;
};
export type SpeechSnapshot = { messageId: string | null; busy: boolean; error: string };

export class SpeechPlaybackController {
  private provider: SpeechProvider;
  private listener: ((state: SpeechSnapshot) => void) | null = null;
  private queue: { id: string; text: string }[] = [];
  private response: ResponseSpeech | null = null;
  private cancelCurrent: (() => void) | null = null;
  private active = false;
  private epoch = 0;
  private state: SpeechSnapshot = { messageId: null, busy: false, error: "" };

  constructor(provider: SpeechProvider) { this.provider = provider; }
  snapshot() { return { ...this.state }; }
  isBusy() { return this.state.busy; }
  subscribe(listener: (state: SpeechSnapshot) => void) {
    this.listener = listener;
    listener(this.snapshot());
    return () => { this.listener = null; };
  }
  private publish(patch: Partial<SpeechSnapshot>) {
    this.state = { ...this.state, ...patch };
    this.listener?.(this.snapshot());
  }
  clearError() { this.publish({ error: "" }); }
  stop() {
    if (this.response) this.response.enabled = false;
    this.epoch += 1;
    this.cancelCurrent?.();
    this.cancelCurrent = null;
    this.active = false;
    this.queue = [];
    this.publish({ messageId: null, busy: false });
  }
  beginResponse(enabled: boolean, previousIds: string[]) {
    this.stop();
    this.clearError();
    this.response = { enabled, id: null, offset: 0, previousIds: new Set(previousIds) };
  }
  endResponse() { this.response = null; }
  consume(id: string, text: string, finished = false) {
    const response = this.response;
    if (!response?.enabled || response.previousIds.has(id)) return;
    if (response.id !== null && response.id !== id) return;
    response.id = id;
    while (response.enabled && response.offset < text.length) {
      const rest = text.slice(response.offset);
      const boundary = nextSpeechBoundary(rest, finished);
      if (!boundary) break;
      response.offset += boundary;
      this.enqueue(id, rest.slice(0, boundary));
    }
  }
  replay(id: string, text: string) {
    if (this.state.messageId === id) { this.stop(); return; }
    this.stop();
    this.clearError();
    let rest = text;
    while (rest.trim()) {
      const boundary = nextSpeechBoundary(rest, true);
      if (!this.enqueue(id, rest.slice(0, boundary))) break;
      rest = rest.slice(boundary);
    }
  }
  private enqueue(id: string, text: string): boolean {
    const clean = spokenText(text);
    if (!clean) return true;
    this.queue.push({ id, text: clean });
    this.publish({ busy: true });
    return this.pump();
  }
  private pump(): boolean {
    if (this.active) return true;
    const next = this.queue.shift();
    if (!next) {
      this.publish({ busy: false, messageId: null });
      return true;
    }
    const epoch = this.epoch;
    this.active = true;
    this.publish({ busy: true, messageId: next.id });
    const fail = (error: string) => {
      if (epoch !== this.epoch) return;
      this.stop();
      this.publish({ error });
    };
    try {
      this.cancelCurrent = this.provider.speak(next.text, {
        onEnd: () => {
          if (epoch !== this.epoch) return;
          this.cancelCurrent = null;
          this.active = false;
          this.pump();
        },
        onError: fail,
      });
      return epoch === this.epoch;
    } catch (error) {
      fail(error instanceof Error ? error.message : "Could not start speech playback.");
      return false;
    }
  }
}
