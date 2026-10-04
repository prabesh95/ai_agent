"use client";

import { ChatComposer } from "../components/chat/ChatComposer";
import { ChatMessages } from "../components/chat/ChatMessages";
import { VoiceControls } from "../components/chat/VoiceControls";
import { useVoiceConversation } from "../hooks/useVoiceConversation";

export default function Home() {
  const chat = useVoiceConversation();
  return (
    <main className="chat-page">
      <section className="chat-card">
        <header className="chat-header">
          <div><h1>Local AI Chat</h1><p>AI SDK + Ollama + local speech</p></div>
          <button className="clear-button" type="button" onClick={chat.clearChat}
            disabled={(chat.messages.length === 0 && !chat.input) || chat.controlsBusy}>
            Clear
          </button>
        </header>
        <ChatMessages messages={chat.messages} submitted={chat.isSubmitted}
          busy={chat.controlsBusy} speakingMessageId={chat.speakingMessageId} onSpeak={chat.speakReply} />
        {chat.chatError && <p className="error-message">{chat.chatError}</p>}
        {chat.voiceError && <p className="error-message">{chat.voiceError}</p>}
        {chat.speechError && <p className="error-message">{chat.speechError}</p>}
        <VoiceControls autoVoiceReply={chat.autoVoiceReply} instantVoiceSend={chat.instantVoiceSend}
          vadEnabled={chat.vadEnabled} busy={chat.controlsBusy} micEnabled={chat.microphone.enabled}
          onToggleAutoVoice={chat.toggleAutoVoice} onToggleInstantSend={chat.toggleInstantSend}
          onToggleVad={chat.toggleVad} />
        <p role="status">{chat.micStatus}</p>
        {chat.countdown !== null && <p>Sending in {chat.countdown}s. Click the text box to cancel auto-send and edit.</p>}
        {chat.instantVoiceSend && <p>Voice messages send immediately. Switch to review mode to type or edit.</p>}
        <ChatComposer input={chat.input} readOnly={chat.instantVoiceSend}
          micEnabled={chat.microphone.enabled} micPhase={chat.microphone.phase}
          generating={chat.isGenerating} transcribing={chat.isTranscribing}
          countdown={chat.countdown} textareaRef={chat.textareaRef}
          onChange={chat.changeInput} onReview={chat.cancelCountdown} onSubmit={chat.handleSubmit}
          onStartMic={chat.startMic} onStopMic={chat.stopMic} onStopGeneration={chat.stopGeneration} />
      </section>
    </main>
  );
}
