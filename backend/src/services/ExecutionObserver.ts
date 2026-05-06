/**
 * ExecutionObserver — transforms a raw ExecutionResult into a structured
 * observation block the LLM can reason about pedagogically.
 */
import { ExecutionResult, Language, SandboxTask } from "../types/index.js";

export type ExecutionOutcome =
  | "success"
  | "success_no_output"
  | "runtime_error"
  | "syntax_error"
  | "timeout"
  | "logic_error";

export type ErrorCategory =
  | "name_error" | "type_error" | "index_error" | "key_error"
  | "attribute_error" | "syntax_error" | "indentation_error"
  | "zero_division" | "value_error" | "recursion_error"
  | "reference_error" | "type_error_js" | "range_error" | "generic_error";

export interface ExecutionObservation {
  outcome:          ExecutionOutcome;
  outcomeLabel:     string;
  errorCategory?:   ErrorCategory;
  errorAnnotation?: string;
  criteriaMet:      string[];
  criteriaFailed:   string[];
  outputSummary:    string;
  errorSummary?:    string;
  promptBlock:      string;
}

interface ErrorPattern {
  pattern:    RegExp;
  category:   ErrorCategory;
  annotation: string;
}

const PYTHON_ERROR_PATTERNS: ErrorPattern[] = [
  {
    pattern:    /NameError:\s*name '(\w+)' is not defined/i,
    category:   "name_error",
    annotation: "Python raised a NameError — it tried to look up a variable or function name and couldn't find it. This usually means the name was never assigned, or was defined in a different scope.",
  },
  {
    pattern:    /TypeError:/i,
    category:   "type_error",
    annotation: "Python raised a TypeError — an operation was applied to a value of the wrong type, e.g. adding a string and an integer, or calling something that isn't a function.",
  },
  {
    pattern:    /IndexError:\s*list index out of range/i,
    category:   "index_error",
    annotation: "Python raised an IndexError — the code tried to access a list position that doesn't exist. This often means the loop goes one step too far, or the list is empty.",
  },
  {
    pattern:    /KeyError:\s*(.+)/i,
    category:   "key_error",
    annotation: "Python raised a KeyError — the code tried to look up a dictionary key that doesn't exist.",
  },
  {
    pattern:    /AttributeError:\s*'(\w+)' object has no attribute '(\w+)'/i,
    category:   "attribute_error",
    annotation: "Python raised an AttributeError — the code tried to access a method or property that doesn't exist on that object. The object is likely a different type than expected.",
  },
  {
    pattern:    /SyntaxError:/i,
    category:   "syntax_error",
    annotation: "Python couldn't parse the code due to a SyntaxError. The line number in the traceback is the best starting point.",
  },
  {
    pattern:    /IndentationError:/i,
    category:   "indentation_error",
    annotation: "Python raised an IndentationError — the whitespace structure is inconsistent. In Python, indentation defines block structure.",
  },
  {
    pattern:    /ZeroDivisionError/i,
    category:   "zero_division",
    annotation: "Python raised a ZeroDivisionError — the code attempted to divide by zero.",
  },
  {
    pattern:    /ValueError:/i,
    category:   "value_error",
    annotation: "Python raised a ValueError — the right type was passed but the value wasn't valid for that operation.",
  },
  {
    pattern:    /RecursionError:\s*maximum recursion depth exceeded/i,
    category:   "recursion_error",
    annotation: "Python raised a RecursionError — the function called itself too many times without reaching a base case.",
  },
];

const JS_ERROR_PATTERNS: ErrorPattern[] = [
  {
    pattern:    /ReferenceError:\s*(\w+) is not defined/i,
    category:   "reference_error",
    annotation: "JavaScript raised a ReferenceError — a variable was used that doesn't exist in scope.",
  },
  {
    pattern:    /TypeError:\s*(.+) is not a function/i,
    category:   "type_error_js",
    annotation: "JavaScript raised a TypeError — something was called as a function when it isn't one.",
  },
  {
    pattern:    /TypeError:\s*Cannot read propert/i,
    category:   "type_error_js",
    annotation: "JavaScript raised a TypeError trying to read a property on undefined or null.",
  },
  {
    pattern:    /RangeError:/i,
    category:   "range_error",
    annotation: "JavaScript raised a RangeError — a value was outside the allowed range, or the call stack overflowed due to infinite recursion.",
  },
  {
    pattern:    /SyntaxError:/i,
    category:   "syntax_error",
    annotation: "JavaScript found a SyntaxError and could not parse the code.",
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function detectError(
  stderr: string,
  language: Language,
): { category: ErrorCategory; annotation: string } | null {
  const patterns = language === "python" ? PYTHON_ERROR_PATTERNS : JS_ERROR_PATTERNS;
  for (const p of patterns) {
    if (p.pattern.test(stderr)) {
      return { category: p.category, annotation: p.annotation };
    }
  }
  return {
    category:   "generic_error",
    annotation: "An error occurred during execution. The error message and traceback are the most useful signals.",
  };
}

/**
 * Evaluate success criteria against the source code AND execution result.
 * NOTE: `source` is the original code string — required for loop/function detection.
 */
function checkCriteria(
  source:   string,         // ← the code, not stdout
  result:   ExecutionResult,
  criteria: string[],
): { met: string[]; failed: string[] } {
  const met:    string[] = [];
  const failed: string[] = [];

  for (const criterion of criteria) {
    const lower = criterion.toLowerCase();
    let passes = false;

    if (lower.includes("no errors") || lower.includes("without errors") || lower.includes("runs correctly")) {
      passes = result.exitCode === 0 && !result.timedOut;
    } else if (lower.includes("output") && lower.includes("not empty")) {
      passes = result.stdout.trim().length > 0;
    } else if (lower.includes("uses a loop") || lower.includes("use a loop")) {
      // Check source code, not stdout
      passes = /\bfor\b|\bwhile\b/.test(source);
    } else if (lower.includes("uses a function") || lower.includes("use a function") || lower.includes("function")) {
      // Check source code, not stdout
      passes = /def\s+\w+|function\s+\w+|\w+\s*=>/.test(source);
    } else if (lower.includes("handles empty")) {
      passes = !result.stderr.includes("IndexError") && !result.stderr.includes("TypeError");
    } else if (lower.includes("returns a list") || lower.includes("return a list")) {
      passes = result.exitCode === 0 && !result.stderr;
    } else {
      // Default: passes if code ran without errors
      passes = result.exitCode === 0 && !result.timedOut;
    }

    (passes ? met : failed).push(criterion);
  }

  return { met, failed };
}

function classifyOutcome(
  result:   ExecutionResult,
  source:   string,
  criteria: string[],
): ExecutionOutcome {
  if (result.timedOut) return "timeout";
  if (/SyntaxError|IndentationError/i.test(result.stderr)) return "syntax_error";
  if (result.exitCode !== 0 && result.stderr) return "runtime_error";
  if (result.exitCode === 0 && criteria.length > 0) {
    const { failed } = checkCriteria(source, result, criteria);
    if (failed.length > 0) return "logic_error";
  }
  if (result.exitCode === 0 && !result.stdout.trim()) return "success_no_output";
  return "success";
}

const OUTCOME_LABELS: Record<ExecutionOutcome, string> = {
  success:           "✓ Ran successfully",
  success_no_output: "✓ Ran without errors (no output produced)",
  runtime_error:     "✗ Runtime error",
  syntax_error:      "✗ Syntax error (code could not be parsed)",
  timeout:           "✗ Execution timed out",
  logic_error:       "△ Ran but may not meet all criteria",
};

const MAX_STDOUT = 800;
const MAX_STDERR = 600;

function trimOutput(text: string, max: number): string {
  if (text.length <= max) return text;
  const half = Math.floor(max / 2);
  return (
    text.slice(0, half) +
    `\n… [${text.length - max} chars omitted] …\n` +
    text.slice(-half)
  );
}

function buildPromptBlock(obs: Omit<ExecutionObservation, "promptBlock">): string {
  const lines: string[] = [
    "## EXECUTION OBSERVATION",
    `Outcome: ${obs.outcomeLabel}`,
    `Runtime: ${obs.outputSummary ? "see stdout" : "no output"}`,
  ];
  if (obs.errorCategory) {
    lines.push(`Error type: ${obs.errorCategory}`);
    lines.push(`Teaching context: ${obs.errorAnnotation}`);
  }
  if (obs.outputSummary) {
    lines.push("", "### stdout", "```", obs.outputSummary, "```");
  } else {
    lines.push("", "### stdout", "(empty)");
  }
  if (obs.errorSummary) {
    lines.push("", "### stderr / traceback", "```", obs.errorSummary, "```");
  }
  if (obs.criteriaMet.length > 0) {
    lines.push("", "### Criteria met ✓");
    obs.criteriaMet.forEach(c => lines.push(`- ${c}`));
  }
  if (obs.criteriaFailed.length > 0) {
    lines.push("", "### Criteria NOT met ✗");
    obs.criteriaFailed.forEach(c => lines.push(`- ${c}`));
  }
  lines.push(
    "",
    "---",
    "Use this observation to give targeted Socratic feedback.",
    "Do NOT repeat the error message verbatim — teach the concept behind it.",
    "Do NOT give the fix — guide the student toward discovering it.",
  );
  return lines.join("\n");
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * @param result   Raw execution result from SandboxExecutor
 * @param source   The original source code string (used for loop/function detection)
 * @param language Runtime language
 * @param task     Active sandbox task (for criteria evaluation), if any
 */
export function observe(
  result:   ExecutionResult,
  source:   string,           // ← must be the code, not stdout
  language: Language,
  task?:    SandboxTask,
): ExecutionObservation {
  const criteria  = task?.successCriteria ?? [];
  const outcome   = classifyOutcome(result, source, criteria);
  const errorInfo = result.stderr ? detectError(result.stderr, language) : null;

  const { met, failed } = criteria.length > 0
    ? checkCriteria(source, result, criteria)
    : { met: [], failed: [] };

  const outputSummary = trimOutput(result.stdout.trim(), MAX_STDOUT);
  const errorSummary  = result.stderr
    ? trimOutput(result.stderr.trim(), MAX_STDERR)
    : undefined;

  const partial: Omit<ExecutionObservation, "promptBlock"> = {
    outcome,
    outcomeLabel:    OUTCOME_LABELS[outcome],
    errorCategory:   errorInfo?.category   ?? undefined,
    errorAnnotation: errorInfo?.annotation ?? undefined,
    criteriaMet:     met,
    criteriaFailed:  failed,
    outputSummary,
    errorSummary,
  };

  return { ...partial, promptBlock: buildPromptBlock(partial) };
}