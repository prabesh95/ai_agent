// Volume/silence detection. Noise can trigger it; this is not neural VAD.
export const VAD_CONFIG = {
  silenceMs: 1500,
  minVoiceMs: 200,
  rmsThreshold: 0.015,
  maxRecordingMs: 60000,
  idleRecordingMs: 15000,
  cooldownMs: 500,
};
export type MicrophonePhase = "off" | "opening" | "listening" | "paused" | "finishing";
export type MicrophoneSnapshot = { enabled: boolean; phase: MicrophonePhase };
export type MicrophoneOptions = {
  vadEnabled: boolean;
  shouldPause: () => boolean;
  onAudio: (blob: Blob) => Promise<void>;
  onError: (error: string) => void;
};
type Segment = {
  recorder: MediaRecorder;
  chunks: Blob[];
  session: number;
  send: boolean;
  startedAt: number;
  lastFrameAt: number;
  lastVoiceAt: number;
  voicedMs: number;
};

export class MicrophoneController {
  private options: MicrophoneOptions;
  private listener: ((state: MicrophoneSnapshot) => void) | null = null;
  private state: MicrophoneSnapshot = { enabled: false, phase: "off" };
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private samples: Float32Array<ArrayBuffer> | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private segment: Segment | null = null;
  private finalizing = false;
  private processing = false;
  private session = 0;
  private listenAfter = 0;
  private automatic = true;
  private wasBlocked = false;

  constructor(options: MicrophoneOptions) { this.options = options; }
  configure(options: MicrophoneOptions) { this.options = options; }
  snapshot() { return { ...this.state }; }
  subscribe(listener: (state: MicrophoneSnapshot) => void) {
    this.listener = listener;
    listener(this.snapshot());
    return () => { this.listener = null; };
  }
  private publish(patch: Partial<MicrophoneSnapshot>) {
    const next = { ...this.state, ...patch };
    if (next.enabled === this.state.enabled && next.phase === this.state.phase) return;
    this.state = next;
    this.listener?.(this.snapshot());
  }
  private mute(muted: boolean) {
    this.stream?.getAudioTracks().forEach((track) => { track.enabled = !muted; });
  }
  private release() {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.source?.disconnect();
    this.source = null;
    this.analyser = null;
    this.samples = null;
    const context = this.context;
    this.context = null;
    if (context && context.state !== "closed") void context.close().catch(() => {});
  }
  async start() {
    if (this.state.enabled || this.state.phase === "opening" || this.finalizing || this.processing) return;
    if (!navigator.mediaDevices?.getUserMedia || !("MediaRecorder" in window)) {
      this.options.onError("This browser does not support microphone recording.");
      return;
    }
    const session = ++this.session;
    this.automatic = this.options.vadEnabled;
    this.publish({ phase: "opening" });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (session !== this.session) { stream.getTracks().forEach((track) => track.stop()); return; }
      this.stream = stream;
      stream.getAudioTracks().forEach((track) => track.addEventListener("ended", () => {
        if (session !== this.session) return;
        this.stop(true);
        this.options.onError("The microphone disconnected. Turn it on to try again.");
      }));
      if (this.automatic) {
        if (!("AudioContext" in window)) throw new Error("Silence detection is unavailable. Turn VAD off and try again.");
        this.context = new AudioContext();
        await this.context.resume();
        if (session !== this.session) return;
        this.analyser = this.context.createAnalyser();
        this.analyser.fftSize = 2048;
        this.samples = new Float32Array(this.analyser.fftSize);
        this.source = this.context.createMediaStreamSource(stream);
        this.source.connect(this.analyser);
      }
      this.publish({ enabled: true, phase: "paused" });
      // Wait before creating the first recorder; no live segment gets stranded muted.
      this.listenAfter = performance.now() + VAD_CONFIG.cooldownMs;
      this.mute(true);
      this.timer = setInterval(() => this.tick(), 50);
      if (!this.automatic) this.beginSegment();
    } catch (error) {
      if (session !== this.session) return;
      this.stop(true);
      this.options.onError(error instanceof Error ? error.message : "Microphone access failed.");
    }
  }
  stop(discard = false) {
    if (discard) {
      this.session += 1;
      const segment = this.segment;
      this.segment = null;
      this.finalizing = false;
      if (segment) {
        segment.send = false;
        if (segment.recorder.state !== "inactive") segment.recorder.stop();
      }
      this.release();
      this.publish({ enabled: false, phase: "off" });
      return;
    }
    if (this.state.phase === "opening") this.session += 1;
    const segment = this.segment;
    if (segment && !this.finalizing) {
      this.finishSegment(!this.automatic || segment.voicedMs >= VAD_CONFIG.minVoiceMs);
    }
    this.release();
    this.publish({ enabled: false, phase: this.finalizing ? "finishing" : "off" });
  }
  dispose() { this.stop(true); }

  private beginSegment() {
    if (!this.stream || this.segment || this.finalizing) return;
    const type = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"]
      .find((value) => MediaRecorder.isTypeSupported(value));
    const recorder = new MediaRecorder(this.stream, type ? { mimeType: type } : undefined);
    const now = performance.now();
    const segment: Segment = {
      recorder, chunks: [], session: this.session, send: false,
      startedAt: now, lastFrameAt: now, lastVoiceAt: now, voicedMs: 0,
    };
    this.segment = segment;
    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size) segment.chunks.push(event.data);
    });
    recorder.addEventListener("error", () => {
      if (segment.session !== this.session || this.segment !== segment) return;
      this.stop(true);
      this.options.onError("Microphone recording failed. Turn it on to try again.");
    });
    recorder.addEventListener("stop", () => { void this.completeSegment(segment); });
    // Every new segment explicitly enables the track again.
    this.mute(false);
    try {
      recorder.start();
      this.publish({ phase: "listening" });
    } catch (error) {
      this.segment = null;
      throw error;
    }
  }
  private finishSegment(send: boolean) {
    if (!this.segment || this.finalizing || this.segment.recorder.state === "inactive") return;
    this.segment.send = send;
    this.finalizing = true;
    this.mute(true);
    this.segment.recorder.stop();
    this.publish({ phase: "finishing" });
  }
  private async completeSegment(segment: Segment) {
    if (this.segment === segment) { this.segment = null; this.finalizing = false; }
    if (segment.session !== this.session) {
      if (!this.state.enabled && !this.finalizing) this.publish({ phase: "off" });
      return;
    }
    this.publish({ phase: this.state.enabled ? "paused" : "off" });
    const blob = new Blob(segment.chunks, { type: segment.recorder.mimeType || "audio/webm" });
    if (!segment.send || !blob.size) { this.listenAfter = performance.now() + 100; return; }
    this.processing = true;
    try {
      await this.options.onAudio(blob);
    } catch (error) {
      if (segment.session === this.session) {
        this.stop(true);
        this.options.onError(error instanceof Error ? error.message : "Could not transcribe recording.");
      }
    } finally {
      this.processing = false;
      this.listenAfter = performance.now() + VAD_CONFIG.cooldownMs;
    }
  }
  private tick() {
    if (!this.state.enabled || !this.stream) return;
    const now = performance.now();
    const externallyBlocked = this.processing || this.options.shouldPause();
    if (externallyBlocked) this.wasBlocked = true;
    else if (this.wasBlocked) {
      this.wasBlocked = false;
      this.listenAfter = now + VAD_CONFIG.cooldownMs;
    }
    const paused = externallyBlocked || (this.automatic && now < this.listenAfter);
    if (paused || this.finalizing) {
      if (this.segment && !this.finalizing) this.finishSegment(false);
      this.mute(true);
      if (!this.finalizing) this.publish({ phase: "paused" });
      return;
    }
    if (!this.segment) {
      try { this.beginSegment(); }
      catch (error) {
        this.stop(true);
        this.options.onError(error instanceof Error ? error.message : "Could not start recording.");
      }
      return;
    }
    const segment = this.segment;
    if (!this.automatic) {
      if (now - segment.startedAt >= VAD_CONFIG.maxRecordingMs) this.stop();
      return;
    }
    if (!this.analyser || !this.samples) return;
    this.analyser.getFloatTimeDomainData(this.samples);
    let sum = 0;
    for (const sample of this.samples) sum += sample * sample;
    const rms = Math.sqrt(sum / this.samples.length);
    const elapsed = Math.min(100, now - segment.lastFrameAt);
    segment.lastFrameAt = now;
    if (rms >= VAD_CONFIG.rmsThreshold) {
      segment.voicedMs += elapsed;
      segment.lastVoiceAt = now;
    }
    const hasSpeech = segment.voicedMs >= VAD_CONFIG.minVoiceMs;
    if (hasSpeech && now - segment.lastVoiceAt >= VAD_CONFIG.silenceMs) this.finishSegment(true);
    else if (now - segment.startedAt >= VAD_CONFIG.maxRecordingMs) this.finishSegment(hasSpeech);
    else if (!hasSpeech && now - segment.startedAt >= VAD_CONFIG.idleRecordingMs) this.finishSegment(false);
  }
}
