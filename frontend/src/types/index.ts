// All types defined inline — no shared import path needed

export type TutorMode  = "chat" | "sandbox" | "test";
export type Language   = "python" | "javascript" | "typescript" | "java" | "general";
export type Difficulty = "beginner" | "intermediate" | "advanced";
export type LmStatus   = "online" | "offline" | "checking";

export interface LearnerState {
  estimatedSkill:   number;
  confusion:        number;
  mastery:          number;
  frustration:      number;
  preferredPace:    "slow" | "normal" | "fast";
  misconceptions:   string[];
  masteredConcepts: string[];
}

export interface TestResult {
  id:          string;
  description: string;
  passed:      boolean;
  hidden:      boolean;
}

export interface ExecutionResult {
  stdout:       string;
  stderr:       string;
  exitCode:     number;
  runtimeMs:    number;
  timedOut:     boolean;
  testResults?: TestResult[];
}

export interface UIDirectives {
  openPanel?:        "chat" | "editor" | "test";
  lockSolutionView?: boolean;
  showRunButton?:    boolean;
  showHintButton?:   boolean;
}

export interface SandboxTask {
  instructions:    string;
  starterCode?:    string;
  successCriteria: string[];
  hints:           string[];
  language:        Language;
}

export interface TestTask {
  prompt:            string;
  publicRubricItems: string[];
  hiddenRubricIds:   string[];
  timeboxMinutes?:   number;
  noHints:           boolean;
  language:          Language;
}

// TutorDecision — this is exactly what the backend /chat route returns
export interface TutorDecision {
  mode:          TutorMode;
  tutorMessage:  string;
  objective?:    string;
  reasoning?:    string;
  learnerState:  LearnerState;
  sandboxTask?:  SandboxTask | null;
  testTask?:     TestTask | null;
  uiDirectives:  UIDirectives;
}

export interface ConversationMessage {
  id:        string;
  role:      "user" | "assistant";
  content:   string;
  timestamp: number;
  mode?:     TutorMode;
  code?: {
    source:   string;
    language: Language;
    result?:  ExecutionResult;
  };
}

export interface SessionState {
  sessionId?:          string;   // optional — created lazily on first message
  topic:               string;
  language:            Language;
  difficulty:          Difficulty;
  currentMode:         TutorMode;
  messages:            ConversationMessage[];
  learnerState:        LearnerState;
  currentSandboxTask?: SandboxTask;
  currentTestTask?:    TestTask;
  uiDirectives:        UIDirectives;
  isLoading:           boolean;
  isExecuting:         boolean;
  lmStatus:            LmStatus;
}

// Discriminated union of all reducer actions
export type SessionAction =
  | { type: "SET_LOADING";          payload: boolean }
  | { type: "SET_EXECUTING";        payload: boolean }
  | { type: "SET_LM_STATUS";        payload: LmStatus }
  | { type: "SET_SESSION_ID";       payload: string }
  | { type: "SET_TOPIC";            payload: string }
  | { type: "SET_LANGUAGE";         payload: Language }
  | { type: "SET_DIFFICULTY";       payload: Difficulty }
  | { type: "ADD_MESSAGE";          payload: ConversationMessage }
  | { type: "APPLY_DECISION";       payload: TutorDecision }
  | { type: "SET_EXECUTION_RESULT"; payload: { msgId: string; result: ExecutionResult } }
  | { type: "RESTORE_PANEL";        payload: {
      currentMode?:        TutorMode;
      currentSandboxTask?: SandboxTask;
      currentTestTask?:    TestTask;
      uiDirectives?:       UIDirectives;
    }}
  | { type: "RESET" };