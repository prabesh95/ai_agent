import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SpeechPlaybackController, nextSpeechBoundary } from '../lib/voice/speech.ts';
import { MicrophoneController } from '../lib/voice/microphone.ts';

function fakeProvider() {
  const chunks = [];
  let cancelled = 0;
  return { chunks, get cancelled() { return cancelled; },
    provider: { speak(text, events) {
      chunks.push({ text, events });
      return () => { cancelled++; };
    } },
  };
}

test('streams sentences once, plays them in order, and flushes the final fragment', () => {
  const fake = fakeProvider();
  const speech = new SpeechPlaybackController(fake.provider);
  speech.beginResponse(true, ['old']);
  speech.consume('old', 'Old response. ');
  speech.consume('new', 'Kathmandu is');
  assert.equal(fake.chunks.length, 0);
  speech.consume('new', 'Kathmandu is the capital of Nepal. More');
  speech.consume('new', 'Kathmandu is the capital of Nepal. More');
  assert.equal(fake.chunks.length, 1);
  speech.consume('new', 'Kathmandu is the capital of Nepal. More information follows! Final fragment', true);
  assert.equal(fake.chunks.length, 1);
  fake.chunks[0].events.onEnd();
  assert.equal(fake.chunks[1].text, 'More information follows!');
  fake.chunks[1].events.onEnd();
  assert.equal(fake.chunks[2].text, 'Final fragment');
  fake.chunks[2].events.onEnd();
  assert.equal(speech.isBusy(), false);
});

test('Stop drops queued speech and ignores late callbacks and further stream updates', () => {
  const fake = fakeProvider();
  const speech = new SpeechPlaybackController(fake.provider);
  speech.beginResponse(true, []);
  speech.consume('a', 'First. Second. ');
  speech.stop();
  fake.chunks[0].events.onEnd();
  speech.consume('a', 'First. Second. Third. ', true);
  assert.equal(fake.chunks.length, 1);
  assert.equal(fake.cancelled, 1);
  assert.equal(speech.isBusy(), false);
  speech.beginResponse(false, []);
  speech.consume('typed', 'Typed answer. ', true);
  assert.equal(fake.chunks.length, 1);
  speech.replay('typed', 'Typed answer.');
  assert.equal(fake.chunks.at(-1).text, 'Typed answer.');
});

test('speech errors clear playback and do not keep starting failed chunks', () => {
  const speech = new SpeechPlaybackController({ speak() { throw new Error('Blocked'); } });
  speech.replay('a', 'First. Second. Third.');
  assert.equal(speech.snapshot().error, 'Blocked');
  assert.equal(speech.isBusy(), false);
});

test('sentence boundaries support Nepali punctuation, decimals, and common abbreviations', () => {
  assert.equal(nextSpeechBoundary('Dr. Smith is here. Next', false), 18);
  assert.equal(nextSpeechBoundary('Value: 3.14. Next', false), 12);
  assert.equal(nextSpeechBoundary('काठमाडौं हो। अर्को', false), 'काठमाडौं हो।'.length);
  assert.equal(nextSpeechBoundary('Not finished', false), 0);
  assert.equal(nextSpeechBoundary('Not finished', true), 12);
  assert(nextSpeechBoundary('word '.repeat(90), false) <= 241);
});

// Fake device APIs exercise the actual controller lifecycle, including async
// dataavailable/stop events and a clock-driven analyser. No microphone is needed.
function fakeDevices() {
  const originals = new Map();
  const replace = (key, value) => {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  };
  let now = 0, amplitude = 0, nextTimer = 0;
  const timers = new Map(), tracks = [], recorders = [], contexts = [];
  let resolvePermission = null;
  let delayPermission = false;
  class FakeTrack {
    enabled = true;
    stopped = false;
    handlers = {};
    stop() { this.stopped = true; }
    addEventListener(name, fn) { this.handlers[name] = fn; }
  }
  function makeStream() {
    const track = new FakeTrack(); tracks.push(track);
    return { getTracks: () => [track], getAudioTracks: () => [track] };
  }
  class Recorder {
    state = 'inactive';
    mimeType = 'audio/webm';
    handlers = {};
    static isTypeSupported() { return true; }
    constructor(stream) { this.stream = stream; recorders.push(this); }
    addEventListener(name, fn) { this.handlers[name] = fn; }
    start() { this.state = 'recording'; }
    stop() {
      if (this.state === 'inactive') return;
      this.state = 'inactive';
      queueMicrotask(() => {
        this.handlers.dataavailable?.({ data: new Blob(['audio']) });
        this.handlers.stop?.();
      });
    }
  }
  class Context {
    state = 'running';
    constructor() { contexts.push(this); }
    async resume() {}
    async close() { this.state = 'closed'; }
    createAnalyser() {
      return { fftSize: 2048, getFloatTimeDomainData: (array) => {
        array.fill(tracks.at(-1).enabled ? amplitude : 0);
      } };
    }
    createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
  }
  replace('performance', { now: () => now });
  replace('setInterval', (fn) => { const id = ++nextTimer; timers.set(id, fn); return id; });
  replace('clearInterval', (id) => timers.delete(id));
  replace('navigator', { mediaDevices: { getUserMedia: async () => {
    if (delayPermission) await new Promise((resolve) => { resolvePermission = resolve; });
    return makeStream();
  } } });
  replace('window', { MediaRecorder: Recorder, AudioContext: Context });
  replace('MediaRecorder', Recorder);
  replace('AudioContext', Context);
  const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
  return {
    tracks, recorders, contexts, timers, flush,
    setAmplitude: (value) => { amplitude = value; },
    deferPermission: () => { delayPermission = true; },
    grantPermission: () => resolvePermission(),
    async advance(ms) {
      for (let elapsed = 0; elapsed < ms; elapsed += 50) {
        now += 50;
        for (const fn of [...timers.values()]) fn();
        await flush();
      }
    },
    restore() {
      for (const [key, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete globalThis[key];
      }
    },
  };
}

function setupMic(devices, overrides = {}) {
  const audio = [], errors = [];
  const controller = new MicrophoneController({ vadEnabled: true, shouldPause: () => false,
    onAudio: async (blob) => { audio.push(blob); }, onError: (error) => errors.push(error), ...overrides });
  return { controller, audio, errors };
}

test('initial cooldown ends with an enabled audio track, not a permanently muted recorder', async () => {
  const devices = fakeDevices();
  const { controller } = setupMic(devices);
  try {
    await controller.start();
    assert.equal(devices.recorders.length, 0);
    await devices.advance(500);
    assert.equal(controller.snapshot().phase, 'listening');
    assert.equal(devices.tracks[0].enabled, true);
    await devices.advance(500);
    assert.equal(devices.tracks[0].enabled, true);
  } finally { controller.dispose(); await devices.flush(); devices.restore(); }
});

test('consecutive spoken questions transcribe after silence and recording resumes', async () => {
  const devices = fakeDevices();
  const { controller, audio, errors } = setupMic(devices);
  try {
    await controller.start(); await devices.advance(500);
    for (let question = 0; question < 2; question++) {
      devices.setAmplitude(.03); await devices.advance(250);
      devices.setAmplitude(0); await devices.advance(1500);
      assert.equal(audio.length, question + 1);
      await devices.advance(550);
      assert.equal(controller.snapshot().phase, 'listening');
      assert.equal(devices.tracks[0].enabled, true);
    }
    assert.deepEqual(errors, []);
  } finally { controller.dispose(); await devices.flush(); devices.restore(); }
});

test('review and playback pauses mute capture and resume only after cooldown', async () => {
  const devices = fakeDevices(); let blocked = false;
  const { controller, audio } = setupMic(devices, { shouldPause: () => blocked });
  try {
    await controller.start(); await devices.advance(500);
    blocked = true; await devices.advance(100);
    assert.equal(controller.snapshot().phase, 'paused');
    assert.equal(devices.tracks[0].enabled, false);
    await devices.advance(2000); assert.equal(audio.length, 0);
    blocked = false; await devices.advance(50);
    assert.equal(devices.tracks[0].enabled, false);
    await devices.advance(500);
    assert.equal(controller.snapshot().phase, 'listening');
    assert.equal(devices.tracks[0].enabled, true);
  } finally { controller.dispose(); await devices.flush(); devices.restore(); }
});

test('silent idle recordings are discarded without transcription', async () => {
  const devices = fakeDevices();
  const { controller, audio } = setupMic(devices);
  try {
    await controller.start(); await devices.advance(16000);
    assert.equal(audio.length, 0);
    assert(devices.recorders.length >= 2);
  } finally { controller.dispose(); await devices.flush(); devices.restore(); }
});

test('VAD off records until Stop, then releases the device and transcribes once', async () => {
  const devices = fakeDevices();
  const { controller, audio } = setupMic(devices, { vadEnabled: false });
  try {
    await controller.start(); await devices.advance(2000);
    assert.equal(audio.length, 0);
    controller.stop(); await devices.flush();
    assert.equal(audio.length, 1);
    assert.equal(controller.snapshot().enabled, false);
    assert.equal(devices.tracks[0].stopped, true);
    assert.equal(devices.timers.size, 0);
  } finally { controller.dispose(); await devices.flush(); devices.restore(); }
});

test('transcription failure stops automatic recording instead of repeating errors', async () => {
  const devices = fakeDevices();
  const { controller, errors } = setupMic(devices, { onAudio: async () => { throw new Error('Offline'); } });
  try {
    await controller.start(); await devices.advance(500);
    devices.setAmplitude(.03); await devices.advance(250);
    devices.setAmplitude(0); await devices.advance(1500);
    assert.deepEqual(errors, ['Offline']);
    assert.equal(controller.snapshot().enabled, false);
    assert.equal(devices.tracks[0].stopped, true);
  } finally { controller.dispose(); await devices.flush(); devices.restore(); }
});

test('unmount while microphone permission is pending releases the eventual stream', async () => {
  const devices = fakeDevices(); devices.deferPermission();
  const { controller, audio } = setupMic(devices);
  try {
    const starting = controller.start();
    controller.dispose(); devices.grantPermission(); await starting;
    assert.equal(devices.tracks[0].stopped, true);
    assert.equal(devices.recorders.length, 0);
    assert.equal(devices.timers.size, 0);
    assert.equal(audio.length, 0);
  } finally { controller.dispose(); await devices.flush(); devices.restore(); }
});

test('a recorder error releases its stale segment and the microphone can start again', async () => {
  const devices = fakeDevices();
  const { controller, errors } = setupMic(devices);
  try {
    await controller.start(); await devices.advance(500);
    const failed = devices.recorders[0];
    failed.state = 'inactive';
    failed.handlers.error();
    assert.equal(controller.snapshot().enabled, false);
    assert.equal(errors.length, 1);
    await controller.start(); await devices.advance(500);
    assert.equal(controller.snapshot().phase, 'listening');
    assert.equal(devices.tracks.at(-1).enabled, true);
    assert.equal(devices.recorders.length, 2);
  } finally { controller.dispose(); await devices.flush(); devices.restore(); }
});
