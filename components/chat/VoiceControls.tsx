type Props = {
  autoVoiceReply: boolean;
  instantVoiceSend: boolean;
  vadEnabled: boolean;
  busy: boolean;
  micEnabled: boolean;
  onToggleAutoVoice: () => void;
  onToggleInstantSend: () => void;
  onToggleVad: () => void;
};

export function VoiceControls(props: Props) {
  return (
    <div className="voice-controls" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
      <button className="speaker-button" type="button" aria-pressed={props.autoVoiceReply}
        onClick={props.onToggleAutoVoice}>
        Auto voice replies: {props.autoVoiceReply ? "On" : "Off"}
      </button>
      <button className="speaker-button" type="button" aria-pressed={props.instantVoiceSend}
        onClick={props.onToggleInstantSend} disabled={props.busy}>
        Voice send: {props.instantVoiceSend ? "Immediate" : "Review 3 seconds"}
      </button>
      <button className="speaker-button" type="button" aria-pressed={props.vadEnabled}
        onClick={props.onToggleVad} disabled={props.micEnabled || props.busy}
        title="Turn the microphone off before changing silence detection.">
        VAD: {props.vadEnabled ? "On" : "Off"}
      </button>
    </div>
  );
}
