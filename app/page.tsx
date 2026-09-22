"use client";

import { useChat } from "@ai-sdk/react";
import { FormEvent, useState } from "react";

export default function Home() {
  const [input, setInput] = useState("");

  const {
    messages,
    sendMessage,
    status,
    stop,
    error,
    setMessages,
  } = useChat();

  const isGenerating =
    status === "submitted" || status === "streaming";

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const text = input.trim();

    if (!text || isGenerating) return;

    setInput("");
    await sendMessage({ text });
  }

  return (
    <main className="chat-page">
      <section className="chat-card">
        <header className="chat-header">
          <div>
            <h1>Local AI Chat</h1>
            <p>AI SDK + Ollama + qwen2.5:3b</p>
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
                <p>
                  Responses are generated locally through Ollama.
                </p>
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div
              className={`message ${message.role}`}
              key={message.id}
            >
              <strong>
                {message.role === "user"
                  ? "You"
                  : "Assistant"}
              </strong>

              {message.parts.map((part, index) => {
                if (part.type !== "text") return null;

                return (
                  <p key={`${message.id}-${index}`}>
                    {part.text}
                  </p>
                );
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
            {error.message ||
              "Something went wrong while generating."}
          </p>
        )}

        <form className="chat-form" onSubmit={handleSubmit}>
          <textarea
            value={input}
            onChange={(event) =>
              setInput(event.target.value)
            }
            placeholder="Write a message..."
            rows={3}
            disabled={isGenerating}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey
              ) {
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
              disabled={!input.trim()}
            >
              Send
            </button>
          )}
        </form>
      </section>
    </main>
  );
}