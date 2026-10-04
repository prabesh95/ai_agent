"use client";

import { useCallback, useEffect, useState } from "react";
import { MicrophoneController } from "../lib/voice/microphone";
import type { MicrophoneOptions } from "../lib/voice/microphone";

export function useMicrophone(options: MicrophoneOptions) {
  const { vadEnabled, shouldPause, onAudio, onError } = options;
  const [controller] = useState(() => new MicrophoneController(options));
  const [state, setState] = useState(() => controller.snapshot());
  useEffect(() => {
    controller.configure({ vadEnabled, shouldPause, onAudio, onError });
  }, [controller, vadEnabled, shouldPause, onAudio, onError]);
  useEffect(() => {
    const unsubscribe = controller.subscribe(setState);
    return () => { unsubscribe(); controller.dispose(); };
  }, [controller]);
  const start = useCallback(() => controller.start(), [controller]);
  const stop = useCallback(() => controller.stop(), [controller]);
  const isCapturing = useCallback(() => {
    const phase = controller.snapshot().phase;
    return phase === "opening" || phase === "listening" || phase === "finishing";
  }, [controller]);
  return { ...state, start, stop, isCapturing };
}
