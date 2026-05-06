// ── Primitives ────────────────────────────────────────────────────────────────


export type TutorMode   = "chat" | "sandbox" | "test";
export type Language    = "python" | "javascript" | "typescript" | "java" | "general";
export type MessageRole = "user" | "assistant" | "system";


// ── Learner State ─────────────────────────────────────────────────────────────


export interface LearnerState {
  estimatedSkill:   number;
  confusion:        number;
  mastery:          number;
  frustration:      number;
  misconceptions:   string[];
  masteredConcepts: string[];
  preferredPace:    "slow" | "normal" | "fast";
}


// ── Conversation ──────────────────────────────────────────────────────────────


export interface ConversationTurn {
  id:        string;
  role:      MessageRole;
  content:   string;
  timestamp: number;
  codeSubmission?: {
    language:         Language;
    source:           string;
    executionResult?: ExecutionResult;
  };
  mode:    TutorMode;
  signals?: TurnSignals;
}


export interface TurnSignals {
  confusionDetected:    boolean;
  frustrationDetected:  boolean;
  helpSeeking:          boolean;
  conceptualQuestion:   boolean;
  masteryDemonstrated:  boolean;
  plagiarismRisk:       boolean;
  explicitTestRequest:    boolean;  // learner asked to be tested/quizzed/assessed
  explicitSandboxRequest: boolean;  // learner asked for a challenge/exercise/to try
}


// ── Execution ─────────────────────────────────────────────────────────────────


export interface ExecutionResult {
  stdout:       string;
  stderr:       string;
  exitCode:     number;
  timedOut:     boolean;
  runtimeMs:    number;
  testResults?: TestResult[];
}


export interface TestResult {
  id:          string;
  description: string;
  passed:      boolean;
  expected?:   string;
  actual?:     string;
  hidden:      boolean;
}


// ── Sandbox Task ──────────────────────────────────────────────────────────────


export interface SandboxTask {
  starterCode?:    string;
  instructions:    string;
  successCriteria: string[];
  hints:           string[];
  language:        Language;
  entryPoint?:     string;
}


// ── Test Task ─────────────────────────────────────────────────────────────────


export interface TestTask {
  prompt:            string;
  publicRubricItems: string[];
  hiddenRubricIds:   string[];
  timeboxMinutes?:   number;
  noHints:           boolean;
  language:          Language;
  testHarness?:      string;
}


// ── Tutor Decision ────────────────────────────────────────────────────────────


export interface TutorDecision {
  mode:         TutorMode;
  tutorMessage: string;
  objective:    string;
  reasoning:    string;
  learnerState: LearnerState;
  sandboxTask?: SandboxTask;
  testTask?:    TestTask;
  uiDirectives: UIDirectives;
}


export interface UIDirectives {
  openPanel:           "chat" | "editor" | "test";
  showRunButton:       boolean;
  lockSolutionView:    boolean;
  showHintButton:      boolean;
  showProgressUpdate?: boolean;
  progressMessage?:    string;
}


// ── Session ───────────────────────────────────────────────────────────────────


export interface PasteMetrics {
  largePasseCount:      number;
  lastPasteTimestamp?:  number;
  noTypingBeforeSubmit: boolean;
}


export interface Session {
  id:          string;
  createdAt:   number;
  updatedAt:   number;
  language:    Language;
  topic:       string;
  difficulty:  "beginner" | "intermediate" | "advanced";
  turns:       ConversationTurn[];
  learnerState: LearnerState;
  currentMode: TutorMode;
  contextSummary?: string;
  pasteMetrics: PasteMetrics;
}


// ── API Request / Response shapes ─────────────────────────────────────────────


export interface ChatRequest {
  sessionId?:   string;
  message:      string;
  language?:    Language;
  topic?:       string;
  difficulty?:  Session["difficulty"];
  codeContext?: {
    source:   string;
    language: Language;
  };
}


export interface ChatResponse {
  sessionId: string;
  decision:  TutorDecision;
}


export interface ExecuteRequest {
  sessionId:   string;
  source:      string;
  language:    Language;
  testTaskId?: string;
}


export interface ExecuteResponse {
  sessionId:      string;
  result:         ExecutionResult;
  tutorFeedback?: string;
}


export interface HintRequest {
  sessionId:   string;
  taskContext: string;
}


export interface HintResponse {
  hint:      string;
  hintLevel: number;
}


export interface SessionSummaryResponse {
  sessionId:             string;
  topic:                 string;
  turnsCount:            number;
  learnerState:          LearnerState;
  masteredConcepts:      string[];
  misconceptions:        string[];
  recommendedNextTopic?: string;
}