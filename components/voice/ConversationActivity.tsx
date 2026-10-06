import type { OrbState } from "./HolographicOrb";
import { Icon } from "../ui/Icon";
export function ConversationActivity({ state }: { state: OrbState }) {
  const steps = [
    { state: "listening", title: "Listening", detail: "Capture your question", icon: "mic" as const },
    { state: "transcribing", title: "Transcribing", detail: "Turn speech into text", icon: "wave" as const },
    { state: "thinking", title: "Generating", detail: "Build your response", icon: "spark" as const },
    { state: "speaking", title: "Speaking", detail: "Read the answer aloud", icon: "volume" as const },
  ];
  return <section className="panel activity-panel" aria-labelledby="activity-title">
    <header className="panel-header"><Icon name="wave" size={17} /><h2 id="activity-title">Conversation activity</h2></header>
    <ol className="activity-list">{steps.map((step) => <li key={step.state} className={state === step.state ? "is-active" : ""}>
      <span className="activity-icon"><Icon name={step.icon} size={16} /></span><div><strong>{step.title}</strong><span>{step.detail}</span></div>
      <span className="activity-indicator" aria-label={state === step.state ? "Active" : "Idle"} />
    </li>)}</ol>
  </section>;
}
