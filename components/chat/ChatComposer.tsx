import type { FormEvent, RefObject } from "react";
import type { MicrophonePhase } from "../../lib/voice/microphone";
import { Icon } from "../ui/Icon";
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
  const opening = props.micPhase === "opening",
    listening = props.micPhase === "listening",
    finishing = props.micPhase === "finishing";
  const disabled =
    opening || listening || finishing || props.generating || props.transcribing;
  return (
    <form
      className="panel composer-panel"
      onSubmit={props.onSubmit}
      aria-label="Message composer"
    >
      <div className="composer-input-row">
        <span className="composer-spark" aria-hidden="true">
          <Icon name="spark" size={20} />
        </span>
        <textarea
          className="field composer-input"
          ref={props.textareaRef}
          value={props.input}
          readOnly={props.readOnly}
          rows={2}
          aria-label="Message"
          aria-describedby="composer-help"
          disabled={disabled}
          onFocus={props.onReview}
          onClick={props.onReview}
          onChange={(event) => props.onChange(event.target.value)}
          placeholder={
            listening
              ? "Listening to you..."
              : props.transcribing
                ? "Finding your words..."
                : props.readOnly
                  ? "Voice messages send immediately"
                  : "What’s on your mind?"
          }
          onKeyDown={(event) => {
            if (props.readOnly || event.nativeEvent.isComposing) return;
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
        />
        {props.generating ? (
          <button
            className="btn btn-secondary composer-send"
            type="button"
            onClick={props.onStopGeneration}
            aria-label="Stop generating"
          >
            <Icon name="stop" size={18} />
            <span>Stop</span>
          </button>
        ) : (
          <button
            className="btn btn-primary composer-send"
            type="submit"
            disabled={!props.input.trim() || disabled}
            aria-label={
              props.countdown !== null
                ? `Send message, auto-send in ${props.countdown} seconds`
                : "Send message"
            }
          >
            <Icon name="send" size={17} />
            <span>
              {props.countdown !== null ? `${props.countdown}s` : "Send"}
            </span>
          </button>
        )}
      </div>
      <div className="composer-toolbar">
        <span className="composer-help" id="composer-help">
          {props.readOnly
            ? "Immediate voice mode · switch to Review to type"
            : "Enter to send · Shift + Enter for a new line"}
        </span>
        <div className="mic-control">
          <span>
            {opening
              ? "Opening microphone"
              : props.micEnabled
                ? listening
                  ? "Listening"
                  : "Microphone enabled"
                : "Tap to speak"}
          </span>
          <button
            className={`mic-button ${props.micEnabled ? "is-enabled" : ""} ${listening ? "is-listening" : ""}`}
            type="button"
            onClick={props.micEnabled ? props.onStopMic : props.onStartMic}
            disabled={
              opening ||
              finishing ||
              (!props.micEnabled && (props.generating || props.transcribing))
            }
            aria-label={
              props.micEnabled ? "Turn microphone off" : "Start recording"
            }
            aria-pressed={props.micEnabled}
          >
            <Icon name={props.micEnabled ? "stop" : "mic"} size={23} />
          </button>
        </div>
      </div>
      {props.countdown !== null && (
        <div className="countdown-notice" role="status">
          Sending in {props.countdown}s. Click the text box to cancel and edit.
        </div>
      )}
    </form>
  );
}
