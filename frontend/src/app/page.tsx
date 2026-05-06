"use client";
import { useEffect, useRef, useState } from "react";
import { useTutorSession } from "@/hooks/useTutorSession";
import { useConversationHistory, SavedConversation } from "@/hooks/useConversationHistory";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { RightPanel } from "@/components/layout/RightPanel";
import ConversationSidebar from "@/components/layout/ConversationSidebar";
import { ExecutionResult } from "@/types";

export default function HomePage() {
  const { state, sendMessage, runCode, requestHint, checkHealth, reset, dispatch } =
    useTutorSession();

  const history = useConversationHistory();

  const [lastResult,   setLastResult]   = useState<ExecutionResult | undefined>();
  const [lastFeedback, setLastFeedback] = useState<string | undefined>();
  const runMsgIdRef = useRef<string>("");

  // Health check on mount
  useEffect(() => { checkHealth(); }, [checkHealth]);

  // Auto-save whenever messages change.
  // Always use the FRONTEND-stable activeId (not the backend sessionId) as the key
  // so that resumed sessions update the existing sidebar entry rather than creating
  // a duplicate.
  useEffect(() => {
    if (state.messages.length === 0) return;

    // Prefer the history activeId (stable across backend session resets);
    // fall back to state.sessionId only for brand-new sessions that haven't
    // been registered yet.
    const saveId = history.activeId ?? state.sessionId;
    if (!saveId) return;

    history.saveConversation(
      saveId,
      state.messages,
      state.learnerState,
      state.topic,
      state.language,
      state.currentMode,
      state.currentSandboxTask,
      state.currentTestTask,
      state.uiDirectives,
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.messages]);

  const handleSend = (message: string) => {
    sendMessage(message).catch(err => {
      console.error("sendMessage failed:", err);
    });
  };

  const handleRun = async (source: string, msgId: string) => {
    runMsgIdRef.current = msgId;
    await runCode(source, msgId);
    const lastMsg = state.messages.findLast(
      m => m.role === "user" && m.code?.result
    );
    if (lastMsg?.code?.result) {
      setLastResult(lastMsg.code.result);
    }
  };

  // Load a saved conversation into the session
  const handleSelectConversation = (conv: SavedConversation) => {
    dispatch({ type: "RESET" });

    // Restore messages
    conv.messages.forEach(msg => dispatch({ type: "ADD_MESSAGE", payload: msg }));

    // Restore session metadata
    dispatch({ type: "SET_TOPIC",      payload: conv.topic });
    dispatch({ type: "SET_LANGUAGE",   payload: conv.language as any });

    // BUG FIX 1: restore the backend sessionId so runCode / requestHint don't
    // silently abort on the `if (!state.sessionId) return` guard.
    if (conv.backendSessionId) {
      dispatch({ type: "SET_SESSION_ID", payload: conv.backendSessionId });
    }

    // BUG FIX 2: restore editor/test panel state so the RightPanel stays open.
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

  // Start a fresh conversation
  const handleNewConversation = () => {
    reset();
    history.setActiveId(null);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-bg)]" data-theme="">

      {/* Conversation history sidebar */}
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

      {/* Session settings sidebar */}
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
          {/* Chat — always visible */}
          <div className="flex-1 min-w-0 flex flex-col">
            <ChatPanel state={state} onSend={handleSend} />
          </div>

          {/* Right panel — editor / test */}
          <RightPanel
            state={state}
            onRun={handleRun}
            onRequestHint={requestHint}
            lastResult={lastResult}
            lastFeedback={lastFeedback}
          />
        </main>
      </div>
    </div>
  );
}