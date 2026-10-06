"use client";

import { useState } from "react";
import { AppShell } from "../components/shell/AppShell";
import { ChatComposer } from "../components/chat/ChatComposer";
import { ChatMessages } from "../components/chat/ChatMessages";
import { VoiceControls } from "../components/chat/VoiceControls";
import { HolographicOrb } from "../components/voice/HolographicOrb";
import type { OrbState } from "../components/voice/HolographicOrb";
import { ConversationActivity } from "../components/voice/ConversationActivity";
import { Icon } from "../components/ui/Icon";
import { useVoiceConversation } from "../hooks/useVoiceConversation";
import type { WorkspaceView } from "../lib/app-config";

export default function Home() {
  const chat = useVoiceConversation();
  const [view, setView] = useState("home" as WorkspaceView);
  const orbState: OrbState =
    chat.microphone.phase === "listening"
      ? "listening"
      : chat.isTranscribing
        ? "transcribing"
        : chat.speakingMessageId
          ? "speaking"
          : chat.isGenerating
            ? "thinking"
            : "ready";
  const errors = [chat.chatError, chat.voiceError, chat.speechError].filter(
    Boolean,
  );
  return (
    <AppShell activeView={view} onNavigate={setView}>
      <div className={`dashboard-grid view-${view}`}>
        <ChatMessages
          messages={chat.messages}
          submitted={chat.isSubmitted}
          busy={chat.controlsBusy}
          speakingMessageId={chat.speakingMessageId}
          onSpeak={chat.speakReply}
          onClear={chat.clearChat}
          canClear={
            (chat.messages.length > 0 || Boolean(chat.input)) &&
            !chat.controlsBusy
          }
          onSuggestion={(text) => {
            chat.changeInput(text);
            chat.textareaRef.current?.focus();
          }}
        />
        <HolographicOrb state={orbState} />
        <aside className="context-column" aria-label="Conversation controls">
          <VoiceControls
            autoVoiceReply={chat.autoVoiceReply}
            instantVoiceSend={chat.instantVoiceSend}
            vadEnabled={chat.vadEnabled}
            busy={chat.controlsBusy}
            micEnabled={chat.microphone.enabled}
            onToggleAutoVoice={chat.toggleAutoVoice}
            onToggleInstantSend={chat.toggleInstantSend}
            onToggleVad={chat.toggleVad}
          />
          <ConversationActivity state={orbState} />
          <div className="context-note">
            <Icon name="spark" size={16} />
            <p>
              A thought away.
              <br />
              <span>Speak it. Explore it. Make it yours.</span>
            </p>
          </div>
        </aside>
        <div className="composer-area">
          <div className="workspace-state">
            <span
              className={`status-dot ${orbState === "ready" ? "" : "is-active"}`}
            />
            <span role="status">{chat.micStatus}</span>
            <span className="workspace-state-line" />
          </div>
          {errors.length > 0 && (
            <div className="alert alert-error" role="alert">
              <Icon name="warning" size={18} />
              <div>
                {[...new Set(errors)].map((error) => (
                  <p key={error}>{error}</p>
                ))}
              </div>
            </div>
          )}
          <ChatComposer
            input={chat.input}
            readOnly={chat.instantVoiceSend}
            micEnabled={chat.microphone.enabled}
            micPhase={chat.microphone.phase}
            generating={chat.isGenerating}
            transcribing={chat.isTranscribing}
            countdown={chat.countdown}
            textareaRef={chat.textareaRef}
            onChange={chat.changeInput}
            onReview={chat.cancelCountdown}
            onSubmit={chat.handleSubmit}
            onStartMic={chat.startMic}
            onStopMic={chat.stopMic}
            onStopGeneration={chat.stopGeneration}
          />
        </div>
      </div>
    </AppShell>
  );
}
