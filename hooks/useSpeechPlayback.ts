"use client";

import { useCallback, useEffect, useState } from "react";
import { browserSpeechProvider, SpeechPlaybackController } from "../lib/voice/speech";
import type { SpeechProvider } from "../lib/voice/speech";

export function useSpeechPlayback(provider: SpeechProvider = browserSpeechProvider) {
  // Provider belongs to this hook instance. Remount it to replace the provider.
  const [controller] = useState(() => new SpeechPlaybackController(provider));
  const [state, setState] = useState(() => controller.snapshot());
  useEffect(() => {
    const unsubscribe = controller.subscribe(setState);
    return () => { unsubscribe(); controller.stop(); };
  }, [controller]);

  const stop = useCallback(() => controller.stop(), [controller]);
  const isBusy = useCallback(() => controller.isBusy(), [controller]);
  const clearError = useCallback(() => controller.clearError(), [controller]);
  const beginResponse = useCallback((enabled: boolean, ids: string[]) =>
    controller.beginResponse(enabled, ids), [controller]);
  const consume = useCallback((id: string, text: string, finished = false) =>
    controller.consume(id, text, finished), [controller]);
  const endResponse = useCallback(() => controller.endResponse(), [controller]);
  const replay = useCallback((id: string, text: string) => controller.replay(id, text), [controller]);

  return { ...state, stop, isBusy, clearError, beginResponse, consume, endResponse, replay };
}
