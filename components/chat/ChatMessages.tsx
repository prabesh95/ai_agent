import type { UIMessage } from "ai";

function messageText(message: UIMessage) {
  return message.parts.filter((part) => part.type === "text")
    .map((part) => part.text).join("\n\n");
}
type Props = {
  messages: UIMessage[];
  submitted: boolean;
  busy: boolean;
  speakingMessageId: string | null;
  onSpeak: (id: string, text: string) => void;
};

export function ChatMessages({ messages, submitted, busy, speakingMessageId, onSpeak }: Props) {
  return (
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
                onClick={() => onSpeak(message.id, text)} disabled={!isSpeaking && busy}
                aria-label={isSpeaking ? "Stop reading reply" : "Read reply aloud"}
                aria-pressed={isSpeaking}>
                {isSpeaking ? "⏹ Stop speaking" : "🔊 Speak"}
              </button>
            )}
          </div>
        );
      })}
      {submitted && <div className="message assistant">
        <strong>Assistant</strong><p>Loading model...</p>
      </div>}
    </div>
  );
}
