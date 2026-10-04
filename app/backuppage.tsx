"use client";

import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";

// Lightweight volume/silence detection, not a speech recognition model.
const SILENCE_MS = 1500;
const MIN_VOICE_MS = 200;
const VOICE_RMS_THRESHOLD = 0.015;
const MAX_RECORDING_MS = 60000;
const IDLE_RECORDING_MS = 15000;
const LISTENING_COOLDOWN_MS = 500;

function messageText(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n\n");
}

// Offsets always refer to the original text, not its spoken/cleaned version.
function nextSpeechBoundary(text: string, finished: boolean): number {
  const endings = /[.!?।](?:["'”’\)\]]+)?(?=\s)/g;
  for (const match of text.matchAll(endings)) {
    const end = match.index! + match[0].length;
    const prefix = text.slice(0, end);
    if (/\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|e\.g|i\.e)\.$/i.test(prefix)) continue;
    return end;
  }
  // Bound long sentences to manageable speech chunks, at word boundaries.
  if (text.length > 240) {
    const split = text.lastIndexOf(" ", 240);
    if (split > 80) return split + 1;
  }
  return finished ? text.length : 0;
}

function spokenText(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/(^|\n)\s{0,3}(?:#{1,6}\s+|[-*+]\s+)/g, "$1")
    .replace(/[*_`]/g, "")
    .trim();
}

type SpeechChunk = { messageId: string; text: string };
type VoiceResponse = {
  enabled: boolean;
  messageId: string | null;
  consumed: number;
  previousAssistantIds: Set<string>;
};
type RecordingSegment = {
  recorder: MediaRecorder;
  chunks: Blob[];
  startedAt: number;
  lastFrameAt: number;
  lastVoiceAt: number;
  voicedMs: number;
  shouldTranscribe: boolean;
  automatic: boolean;
  session: number;
};

export default function Home() {
  const [input, setInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [isStartingRecording, setIsStartingRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [vadEnabled, setVadEnabled] = useState(true);
  const [autoVoiceReply, setAutoVoiceReply] = useState(true);
  const [instantVoiceSend, setInstantVoiceSend] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState("");
  const [speechError, setSpeechError] = useState("");

  const mountedRef = useRef(true);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const inputRef = useRef("");
  const messagesRef = useRef<UIMessage[]>([]);
  const voiceDraftRef = useRef(false);
  const reviewPendingRef = useRef(false);
  const autoVoiceReplyRef = useRef(true);
  const instantVoiceSendRef = useRef(false);
  const sendingRef = useRef(false);
  const transcribingRef = useRef(false);
  const startingMicRef = useRef(false);
  const micEnabledRef = useRef(false);
  const vadEnabledRef = useRef(true);
  const micSessionRef = useRef(0);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const samplesRef = useRef<Float32Array<ArrayBuffer> | null>(null);
  const segmentRef = useRef<RecordingSegment | null>(null);
  const segmentFinalizingRef = useRef(false);
  const vadTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptionAbortRef = useRef<AbortController | null>(null);
  const listenAfterRef = useRef(0);
  const speechQueueRef = useRef<SpeechChunk[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const speechBusyRef = useRef(false);
  const speechEpochRef = useRef(0);
  const voiceResponseRef = useRef<VoiceResponse | null>(null);

  const { messages, sendMessage, status, stop, error, setMessages } = useChat({
    onFinish: ({ message, isAbort, isDisconnect, isError }) => {
      if (!mountedRef.current) return;
      if (isAbort || isDisconnect || isError) {
        stopSpeaking();
      } else {
        consumeAssistantText(message, true);
        voiceResponseRef.current = null;
      }
    },
    onError: () => {
      if (mountedRef.current) stopSpeaking();
    },
  });
  const isGenerating = status === "submitted" || status === "streaming";

  function updateInput(text: string) {
    inputRef.current = text;
    setInput(text);
  }

  function cancelCountdown() {
    if (countdownTimerRef.current !== null) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setCountdown(null);
    // Review remains pending: leaving the field never restarts the countdown.
  }

  function muteMicrophone(muted: boolean) {
    microphoneStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
  }

  function clearSpeechResources() {
    speechEpochRef.current += 1;
    const utterance = utteranceRef.current;
    if (utterance) {
      utterance.onend = null;
      utterance.onerror = null;
    }
    utteranceRef.current = null;
    speechQueueRef.current = [];
    speechBusyRef.current = false;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    listenAfterRef.current = performance.now() + LISTENING_COOLDOWN_MS;
  }

  function stopSpeaking() {
    // Also suppress future chunks of this response after a Stop click.
    if (voiceResponseRef.current) voiceResponseRef.current.enabled = false;
    clearSpeechResources();
    setSpeakingMessageId(null);
  }

  function playNextSpeechChunk() {
    if (!mountedRef.current || utteranceRef.current) return;
    const next = speechQueueRef.current.shift();
    if (!next) {
      speechBusyRef.current = false;
      setSpeakingMessageId(null);
      listenAfterRef.current = performance.now() + LISTENING_COOLDOWN_MS;
      return;
    }
    const epoch = speechEpochRef.current;
    const utterance = new SpeechSynthesisUtterance(next.text);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;
    utteranceRef.current = utterance;
    speechBusyRef.current = true;
    setSpeakingMessageId(next.messageId);
    muteMicrophone(true);
    utterance.onend = () => {
      if (!mountedRef.current || epoch !== speechEpochRef.current) return;
      utteranceRef.current = null;
      playNextSpeechChunk();
    };
    utterance.onerror = (event) => {
      if (!mountedRef.current || epoch !== speechEpochRef.current) return;
      stopSpeaking();
      if (event.error !== "canceled" && event.error !== "interrupted") {
        setSpeechError("Speech playback failed. You can try the reply's Speak button.");
      }
    };
    try {
      window.speechSynthesis.speak(utterance);
    } catch {
      stopSpeaking();
      setSpeechError("Could not start speech playback. Try the Speak button.");
    }
  }

  function queueSpeech(messageId: string, text: string) {
    const clean = spokenText(text);
    if (!clean) return;
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      stopSpeaking();
      setSpeechError("This browser does not support text-to-speech.");
      return;
    }
    speechQueueRef.current.push({ messageId, text: clean });
    speechBusyRef.current = true;
    playNextSpeechChunk();
  }

  function consumeAssistantText(message: UIMessage, finished: boolean) {
    const response = voiceResponseRef.current;
    if (!response?.enabled || !autoVoiceReplyRef.current || message.role !== "assistant") return;
    if (response.previousAssistantIds.has(message.id)) return;
    if (response.messageId !== null && response.messageId !== message.id) return;
    response.messageId = message.id;
    const text = messageText(message);
    while (response.enabled && response.consumed < text.length) {
      const remaining = text.slice(response.consumed);
      const boundary = nextSpeechBoundary(remaining, finished);
      if (!boundary) break;
      response.consumed += boundary;
      queueSpeech(message.id, remaining.slice(0, boundary));
    }
  }

  // Effects process streamed updates; onFinish flushes the final incomplete sentence.
  useEffect(() => {
    messagesRef.current = messages;
    if (status !== "streaming") return;
    const latest = [...messages].reverse().find((message) => message.role === "assistant");
    if (latest) consumeAssistantText(latest, false);
  }, [messages, status]); // Functions use refs so queued offsets stay current.

  function speakReply(messageId: string, text: string) {
    if (segmentRef.current || startingMicRef.current || transcribingRef.current) return;
    if (speakingMessageId === messageId) {
      stopSpeaking();
      return;
    }
    stopSpeaking();
    setSpeechError("");
    // Manual replay cannot interrupt an active recording.
    let remaining = text;
    while (remaining.trim()) {
      const boundary = nextSpeechBoundary(remaining, true);
      queueSpeech(messageId, remaining.slice(0, boundary));
      remaining = remaining.slice(boundary);
    }
  }

  async function submitText(text: string, fromVoice: boolean, clearDraft = true) {
    const trimmed = text.trim();
    if (!trimmed || sendingRef.current || !mountedRef.current) return;
    sendingRef.current = true;
    cancelCountdown();
    reviewPendingRef.current = false;
    stopSpeaking();
    setSpeechError("");
    muteMicrophone(true);
    voiceResponseRef.current = {
      enabled: fromVoice && autoVoiceReplyRef.current,
      messageId: null,
      consumed: 0,
      previousAssistantIds: new Set(messagesRef.current.filter((m) => m.role === "assistant").map((m) => m.id)),
    };
    if (clearDraft) {
      updateInput("");
      voiceDraftRef.current = false;
    }
    try {
      await sendMessage({ text: trimmed });
    } catch (sendError) {
      if (!mountedRef.current) return;
      stopSpeaking();
      if (clearDraft && !inputRef.current) {
        updateInput(trimmed);
        voiceDraftRef.current = fromVoice;
        reviewPendingRef.current = true;
      }
      setVoiceError(sendError instanceof Error ? sendError.message : "Could not send message.");
    } finally {
      sendingRef.current = false;
      voiceResponseRef.current = null;
      listenAfterRef.current = performance.now() + LISTENING_COOLDOWN_MS;
    }
  }

  function startCountdown() {
    cancelCountdown();
    if (document.activeElement === textareaRef.current) return;
    const deadline = Date.now() + 3000;
    setCountdown(3);
    countdownTimerRef.current = setInterval(() => {
      if (document.activeElement === textareaRef.current) {
        cancelCountdown();
        return;
      }
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      if (!remaining) {
        cancelCountdown();
        void submitText(inputRef.current, voiceDraftRef.current);
      } else {
        setCountdown(remaining);
      }
    }, 100);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isGenerating || transcribingRef.current || segmentRef.current || startingMicRef.current) return;
    await submitText(inputRef.current, voiceDraftRef.current);
  }

  function releaseMicrophone() {
    micEnabledRef.current = false;
    if (vadTimerRef.current !== null) clearInterval(vadTimerRef.current);
    vadTimerRef.current = null;
    microphoneStreamRef.current?.getTracks().forEach((track) => track.stop());
    microphoneStreamRef.current = null;
    audioSourceRef.current?.disconnect();
    audioSourceRef.current = null;
    analyserRef.current = null;
    samplesRef.current = null;
    const context = audioContextRef.current;
    audioContextRef.current = null;
    if (context && context.state !== "closed") void context.close().catch(() => {});
    if (mountedRef.current) setMicEnabled(false);
  }

  function finishSegment(transcribe: boolean) {
    const segment = segmentRef.current;
    if (!segment || segment.recorder.state === "inactive" || segmentFinalizingRef.current) return;
    segment.shouldTranscribe = transcribe;
    segmentFinalizingRef.current = true;
    muteMicrophone(true);
    segment.recorder.stop();
    if (mountedRef.current) setIsRecording(false);
  }

  function startSegment(stream: MediaStream, automatic: boolean) {
    if (segmentRef.current || segmentFinalizingRef.current) return;
    const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"]
      .find((type) => MediaRecorder.isTypeSupported(type));
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const now = performance.now();
    const segment: RecordingSegment = {
      recorder, chunks: [], startedAt: now, lastFrameAt: now,
      lastVoiceAt: now, voicedMs: 0, shouldTranscribe: false,
      automatic, session: micSessionRef.current,
    };
    segmentRef.current = segment;
    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size) segment.chunks.push(event.data);
    });
    recorder.addEventListener("error", () => {
      if (!mountedRef.current || segment.session !== micSessionRef.current || segmentRef.current !== segment) return;
      segment.shouldTranscribe = false;
      micSessionRef.current += 1;
      segmentRef.current = null;
      segmentFinalizingRef.current = false;
      releaseMicrophone();
      if (mountedRef.current) {
        setIsRecording(false);
        setVoiceError("Microphone recording failed. Turn the mic on to try again.");
      }
    });
    recorder.addEventListener("stop", () => {
      if (segmentRef.current === segment) {
        segmentRef.current = null;
        segmentFinalizingRef.current = false;
      }
      if (!mountedRef.current || segment.session !== micSessionRef.current) return;
      setIsRecording(false);
      if (!segment.automatic) releaseMicrophone();
      const blob = new Blob(segment.chunks, { type: recorder.mimeType || "audio/webm" });
      if (segment.shouldTranscribe && blob.size) {
        void transcribeAudio(blob);
      } else {
        listenAfterRef.current = performance.now() + 100;
      }
    });
    muteMicrophone(false);
    try {
      recorder.start();
      setIsRecording(true);
    } catch (recordingError) {
      segmentRef.current = null;
      segment.shouldTranscribe = false;
      throw recordingError;
    }
  }

  function tickVad() {
    if (!mountedRef.current || !micEnabledRef.current || !vadEnabledRef.current) return;
    const stream = microphoneStreamRef.current;
    const analyser = analyserRef.current;
    const samples = samplesRef.current;
    if (!stream || !analyser || !samples) return;
    const now = performance.now();
    const blocked = sendingRef.current || transcribingRef.current || reviewPendingRef.current ||
      speechBusyRef.current || startingMicRef.current || now < listenAfterRef.current;
    if (blocked || segmentFinalizingRef.current) {
      muteMicrophone(true);
      return;
    }
    if (!segmentRef.current) {
      try {
        startSegment(stream, true);
      } catch {
        releaseMicrophone();
        setIsRecording(false);
        setVoiceError("Could not restart recording. Turn the mic on to try again.");
      }
      return;
    }
    const segment = segmentRef.current;
    analyser.getFloatTimeDomainData(samples);
    let sum = 0;
    for (const value of samples) sum += value * value;
    const rms = Math.sqrt(sum / samples.length);
    const elapsed = Math.min(100, now - segment.lastFrameAt);
    segment.lastFrameAt = now;
    if (rms >= VOICE_RMS_THRESHOLD) {
      segment.voicedMs += elapsed;
      segment.lastVoiceAt = now;
    }
    const hasSpeech = segment.voicedMs >= MIN_VOICE_MS;
    if (hasSpeech && now - segment.lastVoiceAt >= SILENCE_MS) {
      finishSegment(true);
    } else if (now - segment.startedAt >= MAX_RECORDING_MS) {
      finishSegment(hasSpeech);
    } else if (!hasSpeech && now - segment.startedAt >= IDLE_RECORDING_MS) {
      // Throw away silence instead of asking Whisper to transcribe it.
      finishSegment(false);
    }
  }

  async function startRecording() {
    if (startingMicRef.current || micEnabledRef.current || sendingRef.current ||
        transcribingRef.current || segmentFinalizingRef.current || isGenerating) return;
    if (!navigator.mediaDevices?.getUserMedia || !("MediaRecorder" in window)) {
      setVoiceError("This browser does not support microphone recording.");
      return;
    }
    cancelCountdown();
    reviewPendingRef.current = false;
    stopSpeaking();
    setVoiceError("");
    const session = ++micSessionRef.current;
    startingMicRef.current = true;
    setIsStartingRecording(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (!mountedRef.current || session !== micSessionRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      microphoneStreamRef.current = stream;
      stream.getAudioTracks().forEach((track) => {
        track.addEventListener("ended", () => {
          if (!mountedRef.current || session !== micSessionRef.current) return;
          micSessionRef.current += 1;
          if (segmentRef.current) segmentRef.current.shouldTranscribe = false;
          releaseMicrophone();
          setIsRecording(false);
          setVoiceError("The microphone disconnected. Turn it on to try again.");
        });
      });
      if (vadEnabledRef.current) {
        if (!("AudioContext" in window)) throw new Error("Silence detection is unavailable. Turn VAD off and try again.");
        const context = new AudioContext();
        audioContextRef.current = context;
        await context.resume();
        if (!mountedRef.current || session !== micSessionRef.current) return;
        const analyser = context.createAnalyser();
        analyser.fftSize = 2048;
        const source = context.createMediaStreamSource(stream);
        source.connect(analyser); // No connection to speakers: no mic feedback.
        audioSourceRef.current = source;
        analyserRef.current = analyser;
        samplesRef.current = new Float32Array(analyser.fftSize);
      }
      micEnabledRef.current = true;
      setMicEnabled(true);
      startSegment(stream, vadEnabledRef.current);
      if (vadEnabledRef.current) vadTimerRef.current = setInterval(tickVad, 50);
    } catch (recordingError) {
      releaseMicrophone();
      if (mountedRef.current) {
        setIsRecording(false);
        setVoiceError(recordingError instanceof Error ? recordingError.message : "Microphone access failed.");
      }
    } finally {
      startingMicRef.current = false;
      if (mountedRef.current) setIsStartingRecording(false);
    }
  }

  function stopRecording() {
    // Stop the session, but transcribe a final segment if it contains speech.
    const segment = segmentRef.current;
    if (segment && !segmentFinalizingRef.current) {
      finishSegment(!segment.automatic || segment.voicedMs >= MIN_VOICE_MS);
    }
    releaseMicrophone();
    setIsRecording(false);
  }

  async function transcribeAudio(audioBlob: Blob) {
    if (transcribingRef.current || !mountedRef.current) return;
    transcribingRef.current = true;
    setIsTranscribing(true);
    setVoiceError("");
    muteMicrophone(true);
    const controller = new AbortController();
    transcriptionAbortRef.current = controller;
    try {
      const formData = new FormData();
      const extension = audioBlob.type.includes("mp4") ? "m4a" : "webm";
      formData.append("file", audioBlob, `recording.${extension}`);
      const response = await fetch("/api/transcribe", {
        method: "POST", body: formData, signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Audio transcription failed.");
      if (!mountedRef.current) return;
      const text = typeof data.text === "string" ? data.text.trim() : "";
      if (!text) throw new Error("No speech was detected. Please try again.");
      if (instantVoiceSendRef.current) {
        void submitText(text, true, false);
      } else {
        const existing = inputRef.current.trim();
        updateInput(existing ? `${existing} ${text}` : text);
        voiceDraftRef.current = true;
        reviewPendingRef.current = true;
        startCountdown();
      }
    } catch (transcriptionError) {
      if (!mountedRef.current || controller.signal.aborted) return;
      setVoiceError(transcriptionError instanceof Error ? transcriptionError.message : "Could not transcribe recording.");
      // Stop automatic listening on errors so failures don't repeat unattended.
      releaseMicrophone();
    } finally {
      transcriptionAbortRef.current = null;
      transcribingRef.current = false;
      if (mountedRef.current) setIsTranscribing(false);
      listenAfterRef.current = performance.now() + LISTENING_COOLDOWN_MS;
    }
  }

  function clearChat() {
    cancelCountdown();
    reviewPendingRef.current = false;
    voiceDraftRef.current = false;
    updateInput("");
    stopSpeaking();
    setMessages([]);
    setVoiceError("");
    setSpeechError("");
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      micSessionRef.current += 1;
      transcriptionAbortRef.current?.abort();
      if (countdownTimerRef.current !== null) clearInterval(countdownTimerRef.current);
      const segment = segmentRef.current;
      if (segment && segment.recorder.state !== "inactive") {
        segment.shouldTranscribe = false;
        segment.recorder.stop();
      }
      releaseMicrophone();
      clearSpeechResources();
    };
  }, []);

  const controlsBusy = isGenerating || isTranscribing || isStartingRecording || isRecording;
  const micStatus = !micEnabled ? "Microphone off" : isRecording
    ? (vadEnabled ? "Listening — pause for 1.5 seconds to finish your question." : "Recording — click Stop to transcribe.")
    : isTranscribing ? "Microphone paused while transcribing."
    : isGenerating ? "Microphone paused while the assistant replies."
    : speakingMessageId ? "Microphone paused during speech playback."
    : voiceDraftRef.current && input.trim() ? "Microphone paused while you review your message."
    : "Microphone enabled — listening resumes shortly.";

  return (
    <main className="chat-page">
      <section className="chat-card">
        <header className="chat-header">
          <div>
            <h1>Local AI Chat</h1>
            <p>AI SDK + Ollama + local speech</p>
          </div>
          <button className="clear-button" type="button" onClick={clearChat}
            disabled={(messages.length === 0 && !input) || controlsBusy}>
            Clear
          </button>
        </header>

        <div className="messages">
          {messages.length === 0 && (
            <div className="empty-state"><div>
              <h2>Start a conversation</h2>
              <p>Type a message or record your voice.</p>
            </div></div>
          )}
          {messages.map((message) => {
            const text = messageText(message);
            const isSpeaking = speakingMessageId === message.id;
            return (
              <div className={`message ${message.role}`} key={message.id}>
                <strong>{message.role === "user" ? "You" : "Assistant"}</strong>
                {message.parts.map((part, index) => part.type === "text"
                  ? <p key={`${message.id}-${index}`}>{part.text}</p> : null)}
                {message.role === "assistant" && text.trim() && (
                  <button className="speaker-button" type="button"
                    onClick={() => speakReply(message.id, text)}
                    disabled={!isSpeaking && controlsBusy}
                    aria-label={isSpeaking ? "Stop reading reply" : "Read reply aloud"}
                    aria-pressed={isSpeaking}>
                    {isSpeaking ? "⏹ Stop speaking" : "🔊 Speak"}
                  </button>
                )}
              </div>
            );
          })}
          {status === "submitted" && (
            <div className="message assistant"><strong>Assistant</strong><p>Loading model...</p></div>
          )}
        </div>

        {error && <p className="error-message">{error.message || "Could not generate a response."}</p>}
        {voiceError && <p className="error-message">{voiceError}</p>}
        {speechError && <p className="error-message">{speechError}</p>}

        <div className="voice-controls" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <button className="speaker-button" type="button" aria-pressed={autoVoiceReply}
            onClick={() => {
              const enabled = !autoVoiceReplyRef.current;
              autoVoiceReplyRef.current = enabled;
              setAutoVoiceReply(enabled);
              if (!enabled) stopSpeaking();
            }}>
            Auto voice replies: {autoVoiceReply ? "On" : "Off"}
          </button>
          <button className="speaker-button" type="button" aria-pressed={instantVoiceSend}
            disabled={controlsBusy}
            onClick={() => {
              cancelCountdown();
              instantVoiceSendRef.current = !instantVoiceSendRef.current;
              setInstantVoiceSend(instantVoiceSendRef.current);
            }}>
            Voice send: {instantVoiceSend ? "Immediate" : "Review 3 seconds"}
          </button>
          <button className="speaker-button" type="button" aria-pressed={vadEnabled}
            disabled={micEnabled || controlsBusy}
            title="Turn the microphone off before changing silence detection."
            onClick={() => {
              vadEnabledRef.current = !vadEnabledRef.current;
              setVadEnabled(vadEnabledRef.current);
            }}>
            VAD: {vadEnabled ? "On" : "Off"}
          </button>
        </div>
        <p role="status">{micStatus}</p>
        {countdown !== null && <p>Sending in {countdown}s. Click the text box to cancel auto-send and edit.</p>}
        {instantVoiceSend && <p>Voice messages send immediately. Switch to review mode to type or edit.</p>}

        <form className="chat-form" onSubmit={handleSubmit}>
          <button className={micEnabled ? "microphone-button recording" : "microphone-button"}
            type="button" onClick={micEnabled ? stopRecording : startRecording}
            disabled={isStartingRecording || (!micEnabled && (isGenerating || isTranscribing))}
            aria-label={micEnabled ? "Turn microphone off" : "Start recording"}>
            {isStartingRecording ? "Opening mic..." : micEnabled ? (vadEnabled ? "Mic off" : "Stop") : isTranscribing ? "Processing..." : "Mic"}
          </button>
          <textarea ref={textareaRef} value={input} readOnly={instantVoiceSend}
            aria-label="Message" rows={3}
            disabled={isGenerating || isTranscribing || isRecording || isStartingRecording}
            onFocus={cancelCountdown} onClick={cancelCountdown}
            onChange={(event) => {
              cancelCountdown();
              updateInput(event.target.value);
              if (!event.target.value.trim()) {
                voiceDraftRef.current = false;
                reviewPendingRef.current = false;
              }
            }}
            placeholder={isRecording ? "Listening..." : isTranscribing ? "Transcribing..." : "Write or speak a message..."}
            onKeyDown={(event) => {
              if (instantVoiceSend || event.nativeEvent.isComposing) return;
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }} />
          {isGenerating ? (
            <button type="button" onClick={() => { stopSpeaking(); stop(); }}>Stop</button>
          ) : (
            <button type="submit" disabled={!input.trim() || isRecording || isTranscribing || isStartingRecording}>
              {countdown !== null ? `Send (${countdown}s)` : "Send"}
            </button>
          )}
        </form>
      </section>
    </main>
  );
}
