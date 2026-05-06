/**
 * PolicyEngine — determines the next TutorMode and applies server-side guardrails.
 *
 * Decision matrix (priority order, first match wins):
 * 0. explicitTestRequest      → allow test (unless frustration > 0.6)
 * 0. explicitSandboxRequest   → allow sandbox (unless frustration > 0.6)
 * 1. frustration > 0.7        → always chat (de-escalate)
 * 2. plagiarismRisk            → always chat (ask for explanation)
 * 3. confusion > 0.6          → prefer chat
 * 4. mastery > 0.75 + skill > 0.6 → allow test
 * 5. skill > 0.3 + >3 turns   → allow sandbox
 * 6. skill < 0.3 or first 3 turns → chat only
 */
import { LearnerState, TutorMode, TurnSignals, Session } from "../types/index.js";


export interface PolicyResult {
  allowedModes:    TutorMode[];
  recommendedMode: TutorMode;
  overrideReason?: string;
}


export function evaluatePolicy(
  learnerState: LearnerState,
  signals:      TurnSignals,
  session:      Session,
): PolicyResult {
  const { frustration, confusion, mastery, estimatedSkill } = learnerState;
  const turnCount = session.turns.length;


  // Rule 0 — explicit learner requests override all soft signals
  // Only blocked by extreme frustration (> 0.6)
  if (signals.explicitTestRequest && frustration <= 0.6) {
    return {
      allowedModes:    ["chat", "sandbox", "test"],
      recommendedMode: "test",
      overrideReason:  "Learner explicitly requested a test — overriding soft signals",
    };
  }


  if (signals.explicitSandboxRequest && frustration <= 0.6) {
    return {
      allowedModes:    ["chat", "sandbox"],
      recommendedMode: "sandbox",
      overrideReason:  "Learner explicitly requested a sandbox exercise — overriding soft signals",
    };
  }


  // Rule 1 — frustration override
  if (frustration > 0.7) {
    return {
      allowedModes:    ["chat"],
      recommendedMode: "chat",
      overrideReason:  "Frustration threshold reached — de-escalate before any task",
    };
  }


  // Rule 2 — plagiarism override
  if (signals.plagiarismRisk) {
    return {
      allowedModes:    ["chat"],
      recommendedMode: "chat",
      overrideReason:  "Plagiarism risk detected — ask learner to explain logic first",
    };
  }


  // Rule 3 — high confusion
  if (confusion > 0.6) {
    return {
      allowedModes:    ["chat", "sandbox"],
      recommendedMode: "chat",
      overrideReason:  "High confusion — favour dialogue over tasks",
    };
  }


  // Rule 4 — mastery + skill → allow strict test
  if (mastery > 0.75 && estimatedSkill > 0.6) {
    return {
      allowedModes:    ["chat", "sandbox", "test"],
      recommendedMode: "test",
    };
  }


  // Rule 5 — adequate skill → sandbox practice
  if (estimatedSkill > 0.3 && turnCount > 3) {
    return {
      allowedModes:    ["chat", "sandbox"],
      recommendedMode: signals.helpSeeking ? "sandbox" : "chat",
    };
  }


  // Rule 6 — early session or very low skill
  return {
    allowedModes:    ["chat"],
    recommendedMode: "chat",
    overrideReason:  turnCount <= 3
      ? "Early session — build rapport before any tasks"
      : "Low estimated skill — more dialogue needed",
  };
}


// ── Learner state update ──────────────────────────────────────────────────────


function clamp(v: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, v));
}


function inferPace(
  signals: TurnSignals,
  current: LearnerState["preferredPace"],
): LearnerState["preferredPace"] {
  if (signals.frustrationDetected || signals.confusionDetected) return "slow";
  if (signals.masteryDemonstrated && !signals.helpSeeking)      return "fast";
  return current;
}


export function updateLearnerState(
  current: LearnerState,
  signals: TurnSignals,
): LearnerState {
  const decay = 0.85;


  return {
    ...current,
    confusion:  clamp(current.confusion  * decay + (signals.confusionDetected   ?  0.25 : -0.05)),
    frustration:clamp(current.frustration* decay + (signals.frustrationDetected  ?  0.3  : -0.08)),
    mastery:    clamp(current.mastery    * decay + (signals.masteryDemonstrated  ?  0.3  : -0.02)),
    estimatedSkill: clamp(
      current.estimatedSkill
      + (signals.masteryDemonstrated  ?  0.08 : 0)
      + (signals.confusionDetected    ? -0.05 : 0)
      + (signals.frustrationDetected  ? -0.02 : 0),
    ),
    preferredPace: inferPace(signals, current.preferredPace),
  };
}