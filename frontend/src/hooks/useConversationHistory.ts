"use client";
import { useState, useCallback, useEffect } from "react";
import { ConversationMessage, LearnerState, UIDirectives, SandboxTask, TestTask, TutorMode } from "@/types";

export interface SavedConversation {
  id:                 string;
  /**
   * Fix (issue 3): backendSessionId is now always written by saveConversation
   * so that restoring a conversation also restores the live backend session id.
   * Without this, runCode silently aborted because state.sessionId was undefined
   * after handleSelectConversation ran.
   */
  backendSessionId?:  string;
  title:              string;
  createdAt:          number;
  updatedAt:          number;
  messages:           ConversationMessage[];
  learnerState:       LearnerState;
  topic:              string;
  language:           string;
  // Panel / editor state — persisted so switching chats doesn't lose the editor
  currentMode?:       TutorMode;
  currentSandboxTask?: SandboxTask;
  currentTestTask?:   TestTask;
  uiDirectives?:      UIDirectives;
}

const STORAGE_KEY = "ai-tutor-conversations";

function loadFromStorage(): SavedConversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToStorage(conversations: SavedConversation[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  } catch {
    // Storage full or unavailable — fail silently
  }
}

function generateTitle(messages: ConversationMessage[]): string {
  const firstUser = messages.find(m => m.role === "user");
  if (!firstUser) return "New conversation";
  const text = firstUser.content.slice(0, 50);
  return text.length < firstUser.content.length ? text + "\u2026" : text;
}

export function useConversationHistory() {
  const [conversations, setConversations] = useState<SavedConversation[]>([]);
  const [activeId,      setActiveId]      = useState<string | null>(null);

  // Load on mount
  useEffect(() => {
    setConversations(loadFromStorage());
  }, []);

  /**
   * Save current conversation.
   * `id` is the FRONTEND-stable ID (history.activeId ?? state.sessionId).
   * `backendSessionId` is state.sessionId — persisted so we can restore it
   * when the user selects a past conversation and then tries to run code.
   */
  const saveConversation = useCallback((
    id:                  string,
    messages:            ConversationMessage[],
    learnerState:        LearnerState,
    topic:               string,
    language:            string,
    backendSessionId?:   string,   // Fix: added — was missing, so restored sessions had no sessionId
    currentMode?:        TutorMode,
    currentSandboxTask?: SandboxTask,
    currentTestTask?:    TestTask,
    uiDirectives?:       UIDirectives,
  ) => {
    if (messages.length === 0) return;

    setConversations(prev => {
      const existing = prev.find(c => c.id === id);
      const updated: SavedConversation = {
        id,
        title:              existing?.title ?? generateTitle(messages),
        createdAt:          existing?.createdAt ?? Date.now(),
        updatedAt:          Date.now(),
        messages,
        learnerState,
        topic,
        language,
        backendSessionId,  // Fix: persist the live backend session id
        currentMode,
        currentSandboxTask,
        currentTestTask,
        uiDirectives,
      };
      const next = existing
        ? prev.map(c => c.id === id ? updated : c)
        : [updated, ...prev];
      saveToStorage(next);
      return next;
    });

    // Only set activeId if it isn't already set — avoids overwriting a stable
    // frontend ID with a backend-issued one mid-session.
    setActiveId(prev => prev ?? id);
  }, []);

  // Export a single conversation as a JSON file download
  const exportConversation = useCallback((id: string) => {
    const conv = loadFromStorage().find(c => c.id === id);
    if (!conv) return;
    const blob = new Blob([JSON.stringify(conv, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `tutor-session-${conv.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  // Import a conversation from a JSON file
  const importConversation = useCallback((
    file:   File,
    onLoad: (conv: SavedConversation) => void,
  ) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const conv = JSON.parse(e.target?.result as string) as SavedConversation;
        if (!conv.id || !conv.messages) throw new Error("Invalid format");
        // Give it a fresh ID to avoid collisions; strip backendSessionId since
        // the backend session it pointed to is long gone.
        const imported = {
          ...conv,
          id:               crypto.randomUUID(),
          updatedAt:        Date.now(),
          backendSessionId: undefined,
        };
        setConversations(prev => {
          const next = [imported, ...prev];
          saveToStorage(next);
          return next;
        });
        setActiveId(imported.id);
        onLoad(imported);
      } catch {
        alert("Could not import file — make sure it's a valid tutor session JSON.");
      }
    };
    reader.readAsText(file);
  }, []);

  // Delete a conversation
  const deleteConversation = useCallback((id: string) => {
    setConversations(prev => {
      const next = prev.filter(c => c.id !== id);
      saveToStorage(next);
      return next;
    });
    setActiveId(prev => (prev === id ? null : prev));
  }, []);

  // Rename a conversation
  const renameConversation = useCallback((id: string, title: string) => {
    setConversations(prev => {
      const next = prev.map(c => c.id === id ? { ...c, title } : c);
      saveToStorage(next);
      return next;
    });
  }, []);

  return {
    conversations,
    activeId,
    setActiveId,
    saveConversation,
    exportConversation,
    importConversation,
    deleteConversation,
    renameConversation,
  };
}
