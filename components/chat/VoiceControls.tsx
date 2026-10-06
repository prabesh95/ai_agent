import { Icon } from "../ui/Icon";
type Props = {
  autoVoiceReply: boolean; instantVoiceSend: boolean; vadEnabled: boolean; busy: boolean; micEnabled: boolean;
  onToggleAutoVoice: () => void; onToggleInstantSend: () => void; onToggleVad: () => void;
};
export function VoiceControls(props: Props) {
  return <section className="panel voice-settings" aria-labelledby="voice-settings-title">
    <header className="panel-header"><Icon name="volume" size={17} /><h2 id="voice-settings-title">Voice preferences</h2></header>
    <div className="settings-body">
      <div className="setting-row"><div className="setting-label"><strong id="auto-reply-label">Auto voice reply</strong><span>Speak replies to voice messages</span></div>
        <button className="switch" type="button" role="switch" aria-checked={props.autoVoiceReply} aria-labelledby="auto-reply-label" onClick={props.onToggleAutoVoice}><span /></button></div>
      <div className="setting-block"><div className="setting-label"><strong>Voice send</strong><span>A moment to review, or straight to AI</span></div>
        <div className="segmented-control" role="group" aria-label="Voice send mode">
          <button type="button" className={!props.instantVoiceSend ? "is-active" : ""} aria-pressed={!props.instantVoiceSend} disabled={props.busy}
            onClick={() => { if (props.instantVoiceSend) props.onToggleInstantSend(); }}>Review <span>3s</span></button>
          <button type="button" className={props.instantVoiceSend ? "is-active" : ""} aria-pressed={props.instantVoiceSend} disabled={props.busy}
            onClick={() => { if (!props.instantVoiceSend) props.onToggleInstantSend(); }}>Immediate</button>
        </div>
      </div>
      <div className="setting-row"><div className="setting-label"><strong id="vad-label">Silence detection</strong><span>Finish after a 1.5 second pause</span></div>
        <button className="switch" type="button" role="switch" aria-checked={props.vadEnabled} aria-labelledby="vad-label" disabled={props.micEnabled || props.busy}
          onClick={props.onToggleVad} title="Stop the microphone before changing silence detection"><span /></button></div>
      <p className="settings-note">{props.micEnabled ? "Stop the microphone to change silence detection." : "Turn silence detection off to stop recordings manually."}</p>
    </div>
  </section>;
}
