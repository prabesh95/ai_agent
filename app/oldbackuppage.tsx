"use client";

import { useChat } from "@ai-sdk/react";
import type { SubmitEvent } from "react";
import { FormEvent, useEffect, useRef, useState } from "react";

export default function Home() {
  const [input, setInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState("");

  const [isHydrated, setIsHydrated] =
  useState(false);
  useEffect(() => {
  setIsHydrated(true);
}, []);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const audioChunksRef = useRef<Blob[]>([]);

  const microphoneStreamRef = useRef<MediaStream | null>(null);

  const { messages, sendMessage, status, stop, error, setMessages } = useChat();

  const isGenerating = status === "submitted" || status === "streaming";

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = input.trim();

    if (!text || isGenerating) return;

    setInput("");
    await sendMessage({ text });
  }

  async function startRecording() {
    setVoiceError("");

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setVoiceError("This browser does not support microphone recording.");

      return;
    }

    try {
      const microphoneStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      microphoneStreamRef.current = microphoneStream;
      //Audio through the microphone stream to the audio context and connect it to the analyser node
    //   const audioContext = new AudioContext();
    // const source = audioContext.createMediaStreamSource(microphoneStream);
    // const analyser = audioContext.destination;
    // source.connect(analyser);

      const recorder = new MediaRecorder(microphoneStream);

      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      });

      recorder.addEventListener("stop", async () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });

        await transcribeAudio(audioBlob);
      });

      recorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Microphone access failed:", error);

      setVoiceError("Microphone access was denied or unavailable.");
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current;

    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }

    microphoneStreamRef.current?.getTracks().forEach((track) => track.stop());

    microphoneStreamRef.current = null;
    setIsRecording(false);
  }

  async function transcribeAudio(audioBlob: Blob) {
    setIsTranscribing(true);
    setVoiceError("");

    try {
      const formData = new FormData();

      formData.append("file", audioBlob, "recording.webm");

      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Audio transcription failed.");
      }

      const transcribedText = data.text?.trim();

      if (!transcribedText) {
        throw new Error("No speech was detected in the recording.");
      }

      setInput((currentInput) => {
        if (!currentInput.trim()) {
          return transcribedText;
        }

        return `${currentInput.trim()} ${transcribedText}`;
      });
    } catch (error) {
      console.error("Transcription failed:", error);

      setVoiceError(
        error instanceof Error
          ? error.message
          : "Could not transcribe the recording.",
      );
    } finally {
      setIsTranscribing(false);
      audioChunksRef.current = [];
    }
  }

  useEffect(() => {
    return () => {
      microphoneStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <main className="chat-page">
      <section className="chat-card">
        <header className="chat-header">
          <div>
            <h1>Local AI Chat</h1>
            <p>AI SDK + Ollama + local speech</p>
          </div>

          <button
            className="clear-button"
            type="button"
            onClick={() => setMessages([])}
            disabled={messages.length === 0 || isGenerating}
          >
            Clear
          </button>
        </header>

        <div className="messages">
          {messages.length === 0 && (
            <div className="empty-state">
              <div>
                <h2>Start a conversation</h2>

                <p>Type a message or record your voice.</p>
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div className={`message ${message.role}`} key={message.id}>
              <strong>{message.role === "user" ? "You" : "Assistant"}</strong>

              {message.parts.map((part, index) => {
                if (part.type !== "text") {
                  return null;
                }

                return <p key={`${message.id}-${index}`}>{part.text}</p>;
              })}
            </div>
          ))}

          {status === "submitted" && (
            <div className="message assistant">
              <strong>Assistant</strong>
              <p>Loading model...</p>
            </div>
          )}
        </div>

        {error && (
          <p className="error-message">
            {error.message || "The AI provider could not generate a response."}
          </p>
        )}

        {voiceError && <p className="error-message">{voiceError}</p>}

        <form className="chat-form" onSubmit={handleSubmit}>
          <button
            className={
              isRecording ? "microphone-button recording" : "microphone-button"
            }
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isTranscribing || isGenerating}
            aria-label={isRecording ? "Stop recording" : "Start recording"}
          >
            {isRecording ? "Stop" : isTranscribing ? "Processing..." : "Mic"}
          </button>

          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={
              isRecording
                ? "Listening..."
                : isTranscribing
                  ? "Transcribing..."
                  : "Write or speak a message..."
            }
            rows={3}
            disabled={isGenerating || isTranscribing}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();

                event.currentTarget.form?.requestSubmit();
              }
            }}
          />

          {isGenerating ? (
            <button type="button" onClick={stop}>
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim() || isRecording || isTranscribing}
            >
              Send
            </button>
          )}
        </form>
      </section>
      <p>
  Client JavaScript:{" "}
  {isHydrated ? "active" : "not active"}
</p>
    </main>
  );
}
