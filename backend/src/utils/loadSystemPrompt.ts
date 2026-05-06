import { readFileSync } from "fs";
import { join } from "path";
import { Session, TutorMode } from "../types/index.js";

let cached: string | null = null;

function getBasePrompt(): string {
  if (cached) return cached;
  cached = readFileSync(
    join(process.cwd(), "src/prompts/tutor-system-prompt.md"),
    "utf8"
  );
  return cached;
}

export function buildSystemPrompt(session: Session, allowedModes: TutorMode[]): string {
  const base = getBasePrompt();

  // Append the live session context block — this is the dynamic part
  const contextBlock = `
---

# LIVE SESSION CONTEXT

**Topic:** ${session.topic}
**Language:** ${session.language}
**Difficulty:** ${session.difficulty}

**ALLOWED MODES:** ${allowedModes.join(", ")}

**Learner state (current):**
- Estimated skill:  ${session.learnerState.estimatedSkill.toFixed(2)} / 1.00
- Confusion:        ${session.learnerState.confusion.toFixed(2)} / 1.00
- Mastery:          ${session.learnerState.mastery.toFixed(2)} / 1.00
- Frustration:      ${session.learnerState.frustration.toFixed(2)} / 1.00
- Preferred pace:   ${session.learnerState.preferredPace}
- Known misconceptions: ${session.learnerState.misconceptions.join("; ") || "none detected yet"}
- Confirmed mastered:   ${session.learnerState.masteredConcepts.join("; ") || "none confirmed yet"}

**Prior session summary:**
${session.contextSummary ?? "No prior summary — this is the beginning of the session."}

Remember: respond with a single JSON object only. No text outside the JSON.
`;

  return base + contextBlock;
}