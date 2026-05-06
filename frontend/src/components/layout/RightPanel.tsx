"use client";
import { AnimatePresence, motion } from "motion/react";
import { SessionState, ExecutionResult } from "@/types";
import { EditorPanel } from "@/components/editor/EditorPanel";
import { TestResultsPanel } from "@/components/test/TestResultsPanel";
import { Code2, ClipboardCheck } from "lucide-react";

interface RightPanelProps {
  state:         SessionState;
  onRun:         (source: string, msgId: string) => void;
  onRequestHint: () => Promise<string>;
  lastResult?:   ExecutionResult;
  lastFeedback?: string;
}

export function RightPanel({ state, onRun, onRequestHint, lastResult, lastFeedback }: RightPanelProps) {
  const panel = state.uiDirectives.openPanel;
  const showPanel = panel === "editor" || panel === "test";

  if (!showPanel) {
    return (
      <div className="w-72 border-l border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col items-center justify-center gap-3 text-center px-6">
        <Code2 size={24} className="text-[var(--color-text-faint)]" />
        <p className="text-sm text-[var(--color-text-muted)]">
          The code editor will appear here when the tutor thinks you&apos;re ready for a hands-on task.
        </p>
      </div>
    );
  }

  return (
    <div className="w-[520px] shrink-0 border-l border-[var(--color-border)] flex flex-col h-full overflow-hidden">
      {/* Panel header */}
      <div className="h-10 shrink-0 flex items-center gap-2 px-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        {panel === "test" ? (
          <><ClipboardCheck size={14} className="text-[var(--color-error)]" />
          <span className="text-xs font-medium text-[var(--color-text)]">Assessment</span></>
        ) : (
          <><Code2 size={14} className="text-[var(--color-gold)]" />
          <span className="text-xs font-medium text-[var(--color-text)]">Practice Sandbox</span></>
        )}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={panel}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ type: "spring", damping: 30, stiffness: 250 }}
          className="flex-1 min-h-0 flex flex-col"
        >
          <EditorPanel
            state={state}
            onRun={onRun}
            onRequestHint={onRequestHint}
          />
        </motion.div>
      </AnimatePresence>

      {/* Test results dock */}
      {panel === "test" && lastResult?.testResults && lastFeedback && (
        <div className="shrink-0 border-t border-[var(--color-border)] bg-[var(--color-surface)] max-h-64 overflow-y-auto">
          <TestResultsPanel
            results={lastResult.testResults}
            score={lastResult.testResults.filter(r => r.passed).length / lastResult.testResults.length}
            feedback={lastFeedback}
          />
        </div>
      )}
    </div>
  );
}