/**
 * AssessmentService — post-execution scoring for strict test mode.
 *
 * Runs public + hidden rubric checks and asks the LLM for qualitative feedback.
 * Hidden rubric content is NEVER sent to the client.
 */
import { ExecutionResult, TestTask, TestResult } from "../types/index.js";
import { chatCompletion } from "./LmStudioClient.js";
import logger from "../utils/logger.js";

export interface AssessmentReport {
  score: number;
  passedCount: number;
  totalCount: number;
  testResults: TestResult[];
  qualitativeFeedback: string;
  passed: boolean;
}

const rubricChecks: Record<
  string,
  (source: string, result: ExecutionResult) => boolean
> = {
  no_print_in_loop: (source) =>
    !/(for|while)\s*.*\n.*print/.test(source),
  uses_function: (source) =>
    /def\s+\w+\s*\(/.test(source) || /function\s+\w+\s*\(/.test(source),
  handles_edge_case_empty: (_, result) =>
    !result.stderr.includes("IndexError") && !result.stderr.includes("TypeError"),
  output_not_empty: (_, result) =>
    result.stdout.trim().length > 0,
  no_hardcoded_answer: (source) =>
    !/print\s*\(\s*["']\d+["']\s*\)/.test(source),
};

export async function assess(
  source: string,
  result: ExecutionResult,
  task: TestTask
): Promise<AssessmentReport> {
  const testResults: TestResult[] = [];

  // Hidden rubric checks
  for (const id of task.hiddenRubricIds) {
    const checker = rubricChecks[id];
    const passed = checker ? checker(source, result) : true;
    testResults.push({
      id,
      description: "Hidden test",
      passed,
      hidden: true,
    });
  }

  // Public rubric — pass if code ran without error
  for (let i = 0; i < task.publicRubricItems.length; i++) {
    testResults.push({
      id: `public_${i}`,
      description: task.publicRubricItems[i],
      passed: result.exitCode === 0 && !result.timedOut,
      hidden: false,
    });
  }

  const passedCount = testResults.filter(t => t.passed).length;
  const score = testResults.length > 0 ? passedCount / testResults.length : 0;

  // LLM qualitative feedback
  let qualitativeFeedback = "";
  try {
    qualitativeFeedback = await chatCompletion(
      [
        {
          role: "system",
          content:
            "You are a programming tutor reviewing a student's test submission. " +
            "Give concise, encouraging feedback (3-5 sentences). Do NOT give the correct solution. " +
            "Highlight what they did well, and ask a Socratic question about one area to improve.",
        },
        {
          role: "user",
          content:
            `Task: ${task.prompt}\n\nStudent code:\n\`\`\`\n${source}\n\`\`\`\n\n` +
            `Output:\n${result.stdout}\n\nErrors:\n${result.stderr}\n\nScore: ${Math.round(score * 100)}%`,
        },
      ],
      { temperature: 0.6, max_tokens: 250 }
    );
  } catch (err) {
    logger.warn("Assessment feedback LLM call failed", err);
    qualitativeFeedback =
      score >= 0.8
        ? "Great work! Your solution runs correctly. Review any remaining edge cases."
        : "Good effort! Look at the error output and think about what might be causing it.";
  }

  return {
    score,
    passedCount,
    totalCount: testResults.length,
    testResults,
    qualitativeFeedback,
    passed: score >= 0.8,
  };
}