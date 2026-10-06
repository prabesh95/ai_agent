# Apply this update

1. Back up your current `app/page.tsx` and `app/globals.css` (or commit your current project).
2. Extract this ZIP into `D:\projects\agent`, merging its folders with the project. It replaces `app/page.tsx` and `app/globals.css` and includes all hooks, controllers, UI components, configuration, and tests. This package supersedes the earlier agent-refactor ZIP; you do not need to install both. It does not contain package.json, layout.tsx, backend, or environment files. Merge the contents of the kings-ai-ui folder directly into your project root.
3. In the project terminal, run:

```powershell
npm run build
npm run dev
```

Keep Ollama and your Python transcription service running as before. This update needs no new application dependencies. It uses your existing React, `ai`, and `@ai-sdk/react` packages. The new globals.css replaces the old stylesheet. Keep your existing root layout importing it.

## Where things live

- `app/page.tsx`: composes the interface.
- `components/chat`: message list, composer, and voice toggles.
- `hooks/useVoiceConversation.ts`: transcription, draft review, countdown, and AI requests.
- `hooks/useMicrophone.ts`: exposes microphone state and actions.
- `hooks/useSpeechPlayback.ts`: exposes speech state and actions.
- `lib/voice/microphone.ts`: owns recording devices, silence detection, and cleanup.
- `lib/voice/speech.ts`: owns sentence buffering, ordered playback, and the replaceable TTS provider.

The controllers hold browser resources; the hooks connect them to React. Components receive display state and action callbacks. Visible status no longer depends on reading a mutable ref during rendering.

## Behavior preserved

- Typed replies use manual Speak buttons.
- Microphone replies speak as sentence-sized chunks arrive when auto voice is on.
- Review mode shows transcription with a 3-second countdown. Focusing/clicking the textarea cancels automatic sending permanently for that draft; send manually afterward.
- Immediate mode sends only the new transcription and preserves any existing typed draft. The textarea is read-only.
- VAD is on by default. After about 1.5 seconds of silence, a recording segment is transcribed. The mic session stays enabled and resumes after review/generation/playback.
- Turn the mic off before changing VAD. With VAD off, click Stop mic to finish the recording.
- Questions are limited to 60 seconds per recording segment. VAD discards silent idle segments. It uses a volume threshold, which can respond to background noise.

## Fixes

The first recorder now waits for its cooldown and each new segment explicitly unmutes the track. Listening also waits briefly after playback. Recording and speech cleanup have dedicated owners, stale recording events are ignored, and SDK-reported failures restore a retryable draft in review mode.

## Checks

The package passed 12 controller tests and 8 coordinator scenarios with mocked browser/React/SDK boundaries. The UI source passed TSX parsing/transformation checks. A full Next.js build and semantic TypeScript check could not run here because your package.json and installed dependencies are not included. The browser permission policy blocked the local visual preview; responsive appearance, real microphone behavior, and browser playback must be verified in your project.

To rerun the included tests, use Node 22.18+ (Node 24 was used for verification):

```powershell
node --test tests/voice-controllers.test.mjs tests/conversation.test.mjs
```

After installing, try two consecutive voice questions, cancel a review countdown and edit, switch to immediate sending, stop a streaming reply, turn automatic voice off, and test a failed transcription/request. Confirm the mic indicator agrees with actual recording.

## Changing TTS later

`SpeechProvider` in `lib/voice/speech.ts` defines `speak(text, events)` returning a cancellation function. A new provider can fetch audio and handle playback behind that contract. It should call `onEnd` or `onError` asynchronously and cancel outstanding work when stopped. Pass it to `useSpeechPlayback` in the conversation hook. The speech queue and chat components do not need to know how the voice is generated.
