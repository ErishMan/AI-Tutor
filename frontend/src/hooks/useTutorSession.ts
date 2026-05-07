"use client";
import { useReducer, useCallback, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import {
  SessionState, SessionAction, ConversationMessage,
  LearnerState, UIDirectives, TutorDecision,
  SandboxTask, TestTask, TutorMode, Language, ExecutionResult,
} from "@/types";
import {
  sendChatMessage, executeCode, requestHint as apiRequestHint,
  getHealth, deleteSession,
} from "@/lib/api";

// ── Defaults ──────────────────────────────────────────────────────────────────

const defaultLearnerState: LearnerState = {
  estimatedSkill: 0,
  confusion:      0,
  mastery:        0,
  frustration:    0,
  preferredPace:  "normal",
  misconceptions:   [],
  masteredConcepts: [],
};

const defaultUIDirectives: UIDirectives = {
  openPanel:        "chat",
  showRunButton:    false,
  lockSolutionView: false,
  showHintButton:   false,
};

const initialState: SessionState = {
  sessionId:    undefined,
  topic:        "open topic",
  language:     "python",
  difficulty:   "intermediate",
  currentMode:  "chat",
  messages:     [],
  learnerState: defaultLearnerState,
  uiDirectives: defaultUIDirectives,
  isLoading:    false,
  isExecuting:  false,
  lmStatus:     "checking",
};

// ── Reducer ───────────────────────────────────────────────────────────────────

function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {

    case "SET_LOADING":
      return { ...state, isLoading: action.payload };

    case "SET_EXECUTING":
      return { ...state, isExecuting: action.payload };

    case "SET_LM_STATUS":
      return { ...state, lmStatus: action.payload };

    case "SET_SESSION_ID":
      return { ...state, sessionId: action.payload };

    case "ADD_MESSAGE":
      return { ...state, messages: [...state.messages, action.payload] };

    case "REMOVE_LAST_ASSISTANT": {
      // Remove the last assistant message so retry can replace it in-place
      const msgs = [...state.messages];
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === "assistant") {
          msgs.splice(i, 1);
          break;
        }
      }
      return { ...state, messages: msgs };
    }

    case "APPLY_DECISION": {
      const d: TutorDecision = action.payload;
      if (!d) return { ...state, isLoading: false };
      return {
        ...state,
        currentMode:        d.mode,
        learnerState:       d.learnerState,
        currentSandboxTask: d.sandboxTask ?? undefined,
        currentTestTask:    d.testTask ?? undefined,
        uiDirectives:       d.uiDirectives,
        isLoading:          false,
      };
    }

    case "RESTORE_PANEL": {
      const p = action.payload;
      return {
        ...state,
        currentMode:        p.currentMode        ?? state.currentMode,
        currentSandboxTask: p.currentSandboxTask ?? state.currentSandboxTask,
        currentTestTask:    p.currentTestTask     ?? state.currentTestTask,
        uiDirectives:       p.uiDirectives        ?? state.uiDirectives,
      };
    }

    case "SET_EXECUTION_RESULT":
      return {
        ...state,
        messages: state.messages.map(msg =>
          msg.id === action.payload.msgId && msg.code
            ? { ...msg, code: { ...msg.code, result: action.payload.result } }
            : msg
        ),
      };

    case "RESET":
      return { ...initialState, lmStatus: state.lmStatus };

    case "SET_TOPIC":
      return { ...state, topic: action.payload };

    case "SET_LANGUAGE":
      return { ...state, language: action.payload };

    case "SET_DIFFICULTY":
      return { ...state, difficulty: action.payload };

    default:
      return state;
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useTutorSession() {
  const [state, dispatch] = useReducer(sessionReducer, initialState);

  // Health check on mount, then every 30s
  useEffect(() => {
    const check = async () => {
      const health = await getHealth();
      dispatch({
        type:    "SET_LM_STATUS",
        payload: health.lmStudio === "online" ? "online" : "offline",
      });
    };
    check();
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, []);

  // ── sendMessage ─────────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (
    message:      string,
    codeSource?:  string,
    codeLanguage?: Language,
  ) => {
    const userMsg: ConversationMessage = {
      id:        uuidv4(),
      role:      "user",
      content:   message,
      timestamp: Date.now(),
      ...(codeSource ? { code: { source: codeSource, language: codeLanguage ?? state.language } } : {}),
    };
    dispatch({ type: "ADD_MESSAGE", payload: userMsg });
    dispatch({ type: "SET_LOADING", payload: true });

    try {
      const { sessionId: returnedId, decision } = await sendChatMessage({
        sessionId: state.sessionId,
        message,
        ...(codeSource ? { codeContext: { source: codeSource, language: codeLanguage ?? (state.language === "general" ? "python" : state.language) } } : {}),
      });

      if (returnedId && returnedId !== state.sessionId) {
        dispatch({ type: "SET_SESSION_ID", payload: returnedId });
      }

      dispatch({ type: "APPLY_DECISION", payload: decision });

      const assistantMsg: ConversationMessage = {
        id:        uuidv4(),
        role:      "assistant",
        content:   decision.tutorMessage,
        timestamp: Date.now(),
        mode:      decision.mode,
      };
      dispatch({ type: "ADD_MESSAGE", payload: assistantMsg });

    } catch (err) {
      console.error("sendMessage failed:", err);
      dispatch({ type: "SET_LOADING", payload: false });
      const errorMsg: ConversationMessage = {
        id:        uuidv4(),
        role:      "assistant",
        content:   "Sorry, I couldn't connect to the tutor backend. Please check that LM Studio and the server are running.",
        timestamp: Date.now(),
        mode:      "chat",
      };
      dispatch({ type: "ADD_MESSAGE", payload: errorMsg });
    }
  }, [state.sessionId, state.language]);

  // ── retryLastMessage ────────────────────────────────────────────────────────
  // Removes the last assistant message and replays the last user message so
  // the orchestrator generates a fresh response without cluttering the chat.

  const retryLastMessage = useCallback(async () => {
    const messages = state.messages;

    // Find the last user message to replay
    let lastUserMsg: ConversationMessage | undefined;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") { lastUserMsg = messages[i]; break; }
    }
    if (!lastUserMsg) return;

    // Strip the last assistant message from the chat
    dispatch({ type: "REMOVE_LAST_ASSISTANT" });
    dispatch({ type: "SET_LOADING", payload: true });

    try {
      const { sessionId: returnedId, decision } = await sendChatMessage({
        sessionId: state.sessionId,
        message:   lastUserMsg.content,
        ...(lastUserMsg.code ? {
          codeContext: {
            source:   lastUserMsg.code.source,
            language: lastUserMsg.code.language,
          },
        } : {}),
      });

      if (returnedId && returnedId !== state.sessionId) {
        dispatch({ type: "SET_SESSION_ID", payload: returnedId });
      }

      dispatch({ type: "APPLY_DECISION", payload: decision });

      const assistantMsg: ConversationMessage = {
        id:        uuidv4(),
        role:      "assistant",
        content:   decision.tutorMessage,
        timestamp: Date.now(),
        mode:      decision.mode,
      };
      dispatch({ type: "ADD_MESSAGE", payload: assistantMsg });

    } catch (err) {
      console.error("retryLastMessage failed:", err);
      dispatch({ type: "SET_LOADING", payload: false });
      const errorMsg: ConversationMessage = {
        id:        uuidv4(),
        role:      "assistant",
        content:   "Retry failed — please check that LM Studio is running.",
        timestamp: Date.now(),
        mode:      "chat",
      };
      dispatch({ type: "ADD_MESSAGE", payload: errorMsg });
    }
  }, [state.messages, state.sessionId]);

  // ── runCode ─────────────────────────────────────────────────────────────────

  const runCode = useCallback(async (
    source:   string,
    language: Language,
  ): Promise<ExecutionResult> => {
    if (!state.sessionId) {
      return { stdout: "", stderr: "No active session. Send a message first.", exitCode: 1, runtimeMs: 0, timedOut: false };
    }

    const execLang: Language = language === "general" ? "python" : language;
    dispatch({ type: "SET_EXECUTING", payload: true });

    try {
      const { result } = await executeCode({
        sessionId:         state.sessionId,
        source,
        language:          execLang,
        withTutorFeedback: false,
      });
      return result;
    } catch (err) {
      return {
        stdout:    "",
        stderr:    err instanceof Error ? err.message : "Execution failed.",
        exitCode:  1,
        runtimeMs: 0,
        timedOut:  false,
      };
    } finally {
      dispatch({ type: "SET_EXECUTING", payload: false });
    }
  }, [state.sessionId]);

  // ── requestHint ─────────────────────────────────────────────────────────────

  const requestHint = useCallback(async (): Promise<string> => {
    if (!state.sessionId) return "Start a session first.";
    try {
      const { tutorMessage } = await apiRequestHint(state.sessionId);
      return tutorMessage;
    } catch {
      return "Keep trying — you're closer than you think!";
    }
  }, [state.sessionId]);

  // ── checkHealth ─────────────────────────────────────────────────────────────

  const checkHealth = useCallback(async () => {
    const health = await getHealth();
    dispatch({
      type:    "SET_LM_STATUS",
      payload: health.lmStudio === "online" ? "online" : "offline",
    });
  }, []);

  // ── reset ───────────────────────────────────────────────────────────────────

  const reset = useCallback(async () => {
    if (state.sessionId) {
      await deleteSession(state.sessionId).catch(() => {});
    }
    dispatch({ type: "RESET" });
  }, [state.sessionId]);

  return { state, dispatch, sendMessage, retryLastMessage, runCode, requestHint, checkHealth, reset };
}
