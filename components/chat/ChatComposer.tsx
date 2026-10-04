import type { FormEvent, RefObject } from "react";
import type { MicrophonePhase } from "../../lib/voice/microphone";

type Props = {
  input: string;
  readOnly: boolean;
  micEnabled: boolean;
  micPhase: MicrophonePhase;
  generating: boolean;
  transcribing: boolean;
  countdown: number | null;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onChange: (value: string) => void;
  onReview: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onStartMic: () => Promise<void>;
  onStopMic: () => void;
  onStopGeneration: () => void;
};

export function ChatComposer(props: Props) {
  const opening = props.micPhase === "opening";
  const listening = props.micPhase === "listening";
  const finishing = props.micPhase === "finishing";
  const disabled = opening || listening || finishing || props.generating || props.transcribing;
  return (
    <form className="chat-form" onSubmit={props.onSubmit}>
      <button className={props.micEnabled ? "microphone-button recording" : "microphone-button"}
        type="button" onClick={props.micEnabled ? props.onStopMic : props.onStartMic}
        disabled={opening || finishing || (!props.micEnabled && (props.generating || props.transcribing))}
        aria-label={props.micEnabled ? "Turn microphone off" : "Start recording"}>
        {opening ? "Opening mic..." : props.micEnabled ? "Stop mic" : props.transcribing ? "Processing..." : "Mic"}
      </button>
      <textarea ref={props.textareaRef} value={props.input} readOnly={props.readOnly}
        aria-label="Message" rows={3} disabled={disabled}
        onFocus={props.onReview} onClick={props.onReview}
        onChange={(event) => props.onChange(event.target.value)}
        placeholder={listening ? "Listening..." : props.transcribing ? "Transcribing..." : "Write or speak a message..."}
        onKeyDown={(event) => {
          if (props.readOnly || event.nativeEvent.isComposing) return;
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }} />
      {props.generating ? (
        <button type="button" onClick={props.onStopGeneration}>Stop</button>
      ) : (
        <button type="submit" disabled={!props.input.trim() || disabled}>
          {props.countdown !== null ? `Send (${props.countdown}s)` : "Send"}
        </button>
      )}
    </form>
  );
}
