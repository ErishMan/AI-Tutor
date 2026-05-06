"use client";
import { motion } from "motion/react";
import { CheckCircle2, XCircle, EyeOff } from "lucide-react";
import { TestResult } from "@/types";
import { cn } from "@/lib/utils";

interface TestResultsPanelProps {
  results:  TestResult[];
  score:    number;
  feedback: string;
}

export function TestResultsPanel({ results, score, feedback }: TestResultsPanelProps) {
  const pct = Math.round(score * 100);
  const passed = pct >= 80;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="p-4 space-y-4"
    >
      {/* Score ring */}
      <div className="flex items-center gap-4">
        <div className={cn(
          "w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold border-4",
          passed
            ? "border-[var(--color-success)] text-[var(--color-success)]"
            : "border-[var(--color-error)] text-[var(--color-error)]"
        )}>
          {pct}%
        </div>
        <div>
          <p className="text-sm font-semibold text-[var(--color-text)]">
            {passed ? "Assessment passed!" : "Keep at it!"}
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">
            {results.filter(r => r.passed).length} / {results.length} checks passed
          </p>
        </div>
      </div>

      {/* Test results */}
      <div className="space-y-1.5">
        {results.map(r => (
          <div key={r.id} className="flex items-start gap-2">
            {r.hidden ? (
              <EyeOff size={13} className="mt-0.5 shrink-0 text-[var(--color-text-faint)]" />
            ) : r.passed ? (
              <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-[var(--color-success)]" />
            ) : (
              <XCircle size={13} className="mt-0.5 shrink-0 text-[var(--color-error)]" />
            )}
            <span className={cn(
              "text-xs leading-relaxed",
              r.hidden ? "text-[var(--color-text-faint)] italic" : "text-[var(--color-text-muted)]"
            )}>
              {r.hidden ? "Hidden test case" : r.description}
            </span>
          </div>
        ))}
      </div>

      {/* Feedback */}
      {feedback && (
        <div className="rounded-lg bg-[var(--color-surface-offset)] border border-[var(--color-border)] px-3 py-2.5">
          <p className="text-xs text-[var(--color-text)] leading-relaxed">{feedback}</p>
        </div>
      )}
    </motion.div>
  );
}