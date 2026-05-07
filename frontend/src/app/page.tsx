"use client";
import { useEffect } from "react";
import { useTutorSession } from "@/hooks/useTutorSession";
import { useConversationHistory, SavedConversation } from "@/hooks/useConversationHistory";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { RightPanel } from "@/components/layout/RightPanel";
import ConversationSidebar from "@/components/layout/ConversationSidebar";
import { Language } from "@/types";

export default function HomePage() {
  const { state, sendMessage, retryLastMessage, runCode, requestHint, checkHealth, reset, dispatch } =
    useTutorSession();

  const history = useConversationHistory();

  // Health check on mount
  useEffect(() => { checkHealth(); }, [checkHealth]);

  // Auto-save whenever messages change
  useEffect(() => {
    if (state.messages.length === 0) return;
    const saveId = history.activeId ?? state.sessionId;
    if (!saveId) return;
    history.saveConversation(
      saveId,
      state.messages,
      state.learnerState,
      state.topic,
      state.language,
      state.sessionId,
      state.currentMode,
      state.currentSandboxTask,
      state.currentTestTask,
      state.uiDirectives,
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.messages]);

  const handleSend = (message: string) => {
    sendMessage(message).catch(err => console.error("sendMessage failed:", err));
  };

  const handleRetry = () => {
    retryLastMessage().catch(err => console.error("retryLastMessage failed:", err));
  };

  const handleRun = async (source: string, language: Language) => {
    return runCode(source, language);
  };

  const handleSubmit = (source: string, language: Language) => {
    sendMessage(
      "I've written my solution — please review it.",
      source,
      language,
    ).catch(err => console.error("submitCode failed:", err));
  };

  const handleSelectConversation = (conv: SavedConversation) => {
    dispatch({ type: "RESET" });
    conv.messages.forEach(msg => dispatch({ type: "ADD_MESSAGE", payload: msg }));
    dispatch({ type: "SET_TOPIC",    payload: conv.topic });
    dispatch({ type: "SET_LANGUAGE", payload: conv.language as Language });
    if (conv.backendSessionId) {
      dispatch({ type: "SET_SESSION_ID", payload: conv.backendSessionId });
    }
    if (conv.currentMode || conv.uiDirectives || conv.currentSandboxTask || conv.currentTestTask) {
      dispatch({
        type: "RESTORE_PANEL",
        payload: {
          currentMode:        conv.currentMode,
          currentSandboxTask: conv.currentSandboxTask,
          currentTestTask:    conv.currentTestTask,
          uiDirectives:       conv.uiDirectives,
        },
      });
    }
    history.setActiveId(conv.id);
  };

  const handleNewConversation = () => {
    reset();
    history.setActiveId(null);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-bg)]" data-theme="">
      <ConversationSidebar
        conversations={history.conversations}
        activeId={history.activeId}
        onSelect={handleSelectConversation}
        onNew={handleNewConversation}
        onDelete={history.deleteConversation}
        onRename={history.renameConversation}
        onExport={history.exportConversation}
        onImport={(file) => history.importConversation(file, handleSelectConversation)}
      />

      <Sidebar
        state={state}
        onReset={handleNewConversation}
        onTopicChange={t      => dispatch({ type: "SET_TOPIC",      payload: t })}
        onDifficultyChange={d => dispatch({ type: "SET_DIFFICULTY", payload: d })}
        onLanguageChange={l   => dispatch({ type: "SET_LANGUAGE",   payload: l })}
      />

      <div className="flex flex-col flex-1 min-w-0">
        <TopBar state={state} />
        <main className="flex flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 min-w-0 flex flex-col">
            <ChatPanel
              state={state}
              onSend={handleSend}
              onRetry={handleRetry}
            />
          </div>
          <RightPanel
            state={state}
            onRun={handleRun}
            onSubmit={handleSubmit}
            onRequestHint={requestHint}
          />
        </main>
      </div>
    </div>
  );
}
