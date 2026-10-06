import type { UIMessage } from "ai";
import { useEffect, useRef } from "react";
import { APP_BRAND } from "../../lib/app-config";
import { Icon } from "../ui/Icon";
function messageText(message: UIMessage) {
  return message.parts.filter((part) => part.type === "text").map((part) => part.text).join("\n\n");
}
type Props = {
  messages: UIMessage[]; submitted: boolean; busy: boolean;
  speakingMessageId: string | null; onSpeak: (id: string, text: string) => void;
  onClear: () => void; canClear: boolean; onSuggestion: (text: string) => void;
};
export function ChatMessages(props: Props) {
  const scrollRef = useRef(null as HTMLDivElement | null);
  const stickToBottom = useRef(true);
  useEffect(() => {
    const node = scrollRef.current;
    if (node && stickToBottom.current) node.scrollTop = node.scrollHeight;
  }, [props.messages, props.submitted]);
  return <section className="panel conversation-panel" id="conversation" aria-labelledby="conversation-title">
    <header className="panel-header"><span className="panel-icon"><Icon name="chat" size={18} /></span>
      <div className="panel-title"><h2 id="conversation-title">Conversation</h2><span>{props.messages.length ? "A space for your ideas" : "Start something good"}</span></div>
      <button className="btn btn-ghost icon-button" type="button" onClick={props.onClear} disabled={!props.canClear} title="Clear conversation" aria-label="Clear conversation"><Icon name="trash" size={16} /></button>
    </header>
    <div className="messages" ref={scrollRef} onScroll={() => {
      const node = scrollRef.current;
      if (node) stickToBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 90;
    }} role="log" aria-label="Conversation messages">
      {props.messages.length === 0 && <div className="empty-state">
        <div className="empty-state-mark"><Icon name="spark" size={26} /></div><span className="eyebrow">LET’S BEGIN</span>
        <h3>A question.<br />A new possibility.</h3><p>Think out loud, or type what’s on your mind.</p>
        <div className="suggestion-list">{["Explain something simply", "Help me brainstorm an idea"].map((text) =>
          <button className="suggestion-button" key={text} type="button" disabled={props.busy} onClick={() => props.onSuggestion(text)}>{text}<Icon name="arrow" size={15} /></button>)}</div>
      </div>}
      {props.messages.map((message) => {
        const text = messageText(message), speaking = props.speakingMessageId === message.id;
        return <article className={`message ${message.role}`} key={message.id}>
          <div className="message-author"><span className="message-avatar">{message.role === "user" ? "Y" : APP_BRAND.mark}</span><strong>{message.role === "user" ? "You" : APP_BRAND.name}</strong></div>
          {message.parts.map((part, index) => part.type === "text" ? <p key={`${message.id}-${index}`}>{part.text}</p> : null)}
          {message.role === "assistant" && text.trim() && <button className={`btn btn-ghost speaker-button ${speaking ? "is-speaking" : ""}`} type="button"
            onClick={() => props.onSpeak(message.id, text)} disabled={!speaking && props.busy} aria-pressed={speaking}>
            <Icon name={speaking ? "stop" : "volume"} size={14} />{speaking ? "Stop speaking" : "Read aloud"}</button>}
        </article>;
      })}
      {props.submitted && <div className="thinking-message"><span className="thinking-dots" aria-hidden="true"><i /><i /><i /></span><span>Preparing a reply</span></div>}
    </div>
    <div className="conversation-footnote"><Icon name="spark" size={13} /><span>Good conversations start with curiosity.</span></div>
  </section>;
}
