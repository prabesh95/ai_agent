"use client";

import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import type { FormEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMicrophone } from "./useMicrophone";
import { useSpeechPlayback } from "./useSpeechPlayback";

export type ConversationPhase = "idle" | "transcribing" | "reviewing" | "generating";
export function messageText(message: UIMessage) {
  return message.parts.filter((part) => part.type === "text")
    .map((part) => part.text).join("\n\n");
}
type Submission = {
  text: string;
  fromVoice: boolean;
  clearDraft: boolean;
  failed: boolean;
  aborted: boolean;
};

export function useVoiceConversation() {
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<ConversationPhase>("idle");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [autoVoiceReply, setAutoVoiceReply] = useState(true);
  const [instantVoiceSend, setInstantVoiceSend] = useState(false);
  const [vadEnabled, setVadEnabled] = useState(true);
  const [voiceError, setVoiceError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesRef = useRef<UIMessage[]>([]);
  // Runtime data is for callbacks; visible state is always React state.
  const runtime = useRef({
    mounted: true,
    input: "",
    voiceDraft: false,
    phase: "idle" as ConversationPhase,
    autoVoiceReply: true,
    instantVoiceSend: false,
    sendPending: false,
    submission: null as Submission | null,
    abort: null as AbortController | null,
    countdownTimer: null as ReturnType<typeof setInterval> | null,
  });
  const speech = useSpeechPlayback();
  const { stop: stopSpeech, clearError: clearSpeechError, beginResponse, consume,
    endResponse, isBusy: speechIsBusy, replay } = speech;

  const transition = useCallback((next: ConversationPhase) => {
    runtime.current.phase = next;
    if (runtime.current.mounted) setPhase(next);
  }, []);
  const updateInput = useCallback((text: string) => {
    runtime.current.input = text;
    if (runtime.current.mounted) setInput(text);
  }, []);
  const cancelCountdown = useCallback(() => {
    if (runtime.current.countdownTimer !== null) clearInterval(runtime.current.countdownTimer);
    runtime.current.countdownTimer = null;
    if (runtime.current.mounted) setCountdown(null);
  }, []);

  const handleSendFailure = useCallback((error: Error) => {
    const current = runtime.current;
    const submission = current.submission;
    if (!current.mounted || !submission || submission.failed || submission.aborted) return;
    submission.failed = true;
    stopSpeech();
    // Restore a retryable draft even if the SDK reports failure via onError.
    // Immediate mode never mixes the failed transcription with an existing draft.
    if (submission.clearDraft && !current.input) {
      updateInput(submission.text);
      current.voiceDraft = submission.fromVoice;
      transition("reviewing");
    } else {
      transition("idle");
    }
    setVoiceError(error.message || "Could not send message. Please try again.");
  }, [stopSpeech, transition, updateInput]);

  const { messages, sendMessage, status, stop, error, setMessages, clearError } = useChat({
    onFinish: ({ message, isAbort, isDisconnect, isError }) => {
      if (!runtime.current.mounted) return;
      if (isAbort) {
        stopSpeech();
        transition("idle");
      } else if (isDisconnect || isError) {
        handleSendFailure(new Error("The reply was interrupted. Please try again."));
      } else {
        consume(message.id, messageText(message), true);
        endResponse();
        transition("idle");
      }
    },
    onError: handleSendFailure,
  });
  const isGenerating = status === "submitted" || status === "streaming";

  useEffect(() => {
    messagesRef.current = messages;
    if (status !== "streaming") return;
    const latest = [...messages].reverse().find((message) => message.role === "assistant");
    if (latest) consume(latest.id, messageText(latest));
  }, [messages, status, consume]);

  const submitText = useCallback(async (text: string, fromVoice: boolean, clearDraft = true) => {
    const current = runtime.current;
    const trimmed = text.trim();
    if (!trimmed || current.sendPending || !current.mounted) return;
    current.sendPending = true;
    const submission: Submission = { text: trimmed, fromVoice, clearDraft, failed: false, aborted: false };
    current.submission = submission;
    cancelCountdown();
    setVoiceError("");
    clearError();
    transition("generating");
    beginResponse(fromVoice && current.autoVoiceReply,
      messagesRef.current.filter((m) => m.role === "assistant").map((m) => m.id));
    if (clearDraft) {
      updateInput("");
      current.voiceDraft = false;
    }
    try {
      await sendMessage({ text: trimmed });
    } catch (sendError) {
      handleSendFailure(sendError instanceof Error ? sendError : new Error("Could not send message."));
    } finally {
      current.sendPending = false;
      endResponse();
      if (current.mounted && current.phase === "generating") transition("idle");
      if (current.submission === submission) current.submission = null;
    }
  }, [beginResponse, cancelCountdown, clearError, endResponse, handleSendFailure,
    sendMessage, transition, updateInput]);

  const startCountdown = useCallback(() => {
    cancelCountdown();
    if (document.activeElement === textareaRef.current) return;
    const deadline = Date.now() + 3000;
    setCountdown(3);
    runtime.current.countdownTimer = setInterval(() => {
      if (document.activeElement === textareaRef.current) { cancelCountdown(); return; }
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      if (remaining === 0) {
        cancelCountdown();
        void submitText(runtime.current.input, runtime.current.voiceDraft);
      } else setCountdown(remaining);
    }, 100);
  }, [cancelCountdown, submitText]);

  const transcribe = useCallback(async (blob: Blob) => {
    const current = runtime.current;
    if (!current.mounted) return;
    transition("transcribing");
    setVoiceError("");
    const controller = new AbortController();
    current.abort = controller;
    try {
      const formData = new FormData();
      const extension = blob.type.includes("mp4") ? "m4a" : "webm";
      formData.append("file", blob, `recording.${extension}`);
      const response = await fetch("/api/transcribe", {
        method: "POST", body: formData, signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Audio transcription failed.");
      if (!current.mounted || controller.signal.aborted) return;
      const text = typeof data.text === "string" ? data.text.trim() : "";
      if (!text) throw new Error("No speech was detected. Please try again.");
      if (current.instantVoiceSend) {
        void submitText(text, true, false);
      } else {
        const existing = current.input.trim();
        updateInput(existing ? `${existing} ${text}` : text);
        current.voiceDraft = true;
        transition("reviewing");
        startCountdown();
      }
    } catch (transcriptionError) {
      if (!current.mounted || controller.signal.aborted) return;
      transition("idle");
      // The microphone controller catches this, stops listening, and reports it.
      throw transcriptionError;
    } finally {
      if (current.abort === controller) current.abort = null;
    }
  }, [startCountdown, submitText, transition, updateInput]);

  const shouldPauseMicrophone = useCallback(() => runtime.current.sendPending ||
    runtime.current.phase !== "idle" || speechIsBusy(), [speechIsBusy]);
  const handleMicrophoneError = useCallback((message: string) => {
    if (runtime.current.mounted) setVoiceError(message);
  }, []);
  const microphone = useMicrophone({ vadEnabled, shouldPause: shouldPauseMicrophone,
    onAudio: transcribe, onError: handleMicrophoneError });
  const { start: startMicrophone, stop: stopMicrophone, isCapturing } = microphone;

  const startMic = useCallback(async () => {
    if (runtime.current.sendPending || runtime.current.phase === "transcribing") return;
    cancelCountdown();
    stopSpeech();
    setVoiceError("");
    transition("idle");
    await startMicrophone();
  }, [cancelCountdown, startMicrophone, stopSpeech, transition]);
  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isGenerating || runtime.current.phase === "transcribing" || isCapturing()) return;
    await submitText(runtime.current.input, runtime.current.voiceDraft);
  }, [isCapturing, isGenerating, submitText]);
  const changeInput = useCallback((text: string) => {
    cancelCountdown();
    updateInput(text);
    if (!text.trim()) {
      runtime.current.voiceDraft = false;
      transition("idle");
    }
  }, [cancelCountdown, transition, updateInput]);
  const toggleAutoVoice = useCallback(() => {
    runtime.current.autoVoiceReply = !runtime.current.autoVoiceReply;
    setAutoVoiceReply(runtime.current.autoVoiceReply);
    if (!runtime.current.autoVoiceReply) stopSpeech();
  }, [stopSpeech]);
  const toggleInstantSend = useCallback(() => {
    cancelCountdown();
    runtime.current.instantVoiceSend = !runtime.current.instantVoiceSend;
    setInstantVoiceSend(runtime.current.instantVoiceSend);
  }, [cancelCountdown]);
  const toggleVad = useCallback(() => setVadEnabled((enabled) => !enabled), []);
  const stopGeneration = useCallback(() => {
    if (runtime.current.submission) runtime.current.submission.aborted = true;
    stopSpeech();
    stop();
  }, [stop, stopSpeech]);
  const clearChat = useCallback(() => {
    cancelCountdown();
    stopSpeech();
    clearSpeechError();
    clearError();
    updateInput("");
    runtime.current.voiceDraft = false;
    transition("idle");
    setVoiceError("");
    setMessages([]);
  }, [cancelCountdown, clearError, clearSpeechError, setMessages, stopSpeech, transition, updateInput]);
  const speakReply = useCallback((id: string, text: string) => {
    if (!isCapturing() && runtime.current.phase !== "transcribing") replay(id, text);
  }, [isCapturing, replay]);

  useEffect(() => {
    const current = runtime.current;
    current.mounted = true;
    return () => {
      current.mounted = false;
      current.abort?.abort();
      if (current.countdownTimer !== null) clearInterval(current.countdownTimer);
      current.countdownTimer = null;
    };
  }, []);

  const micBusy = microphone.phase === "opening" || microphone.phase === "listening" ||
    microphone.phase === "finishing";
  const isTranscribing = phase === "transcribing";
  const controlsBusy = micBusy || isGenerating || isTranscribing;
  let micStatus = "Microphone off";
  if (microphone.enabled) {
    if (microphone.phase === "listening") micStatus = vadEnabled
      ? "Listening — pause for 1.5 seconds to finish your question."
      : "Recording — click Stop to transcribe.";
    else if (isTranscribing) micStatus = "Microphone paused while transcribing.";
    else if (isGenerating) micStatus = "Microphone paused while the assistant replies.";
    else if (speech.busy) micStatus = "Microphone paused during speech playback.";
    else if (phase === "reviewing") micStatus = "Microphone paused while you review your message.";
    else micStatus = "Microphone enabled — listening resumes shortly.";
  }

  return { input, phase, messages, isGenerating, isSubmitted: status === "submitted", isTranscribing, controlsBusy,
    countdown, autoVoiceReply, instantVoiceSend, vadEnabled, microphone, micBusy,
    micStatus, speakingMessageId: speech.messageId, voiceError, speechError: speech.error,
    chatError: error?.message ?? "", textareaRef, changeInput, handleSubmit,
    cancelCountdown, toggleAutoVoice, toggleInstantSend, toggleVad, startMic,
    stopMic: stopMicrophone, stopGeneration, clearChat, speakReply };
}
