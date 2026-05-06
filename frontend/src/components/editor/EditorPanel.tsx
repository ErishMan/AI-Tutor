"use client";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "motion/react";
import { Play, Lightbulb, CheckCircle2, Clock, ChevronDown, Send, Terminal, XCircle } from "lucide-react";
import { SessionState, ExecutionResult, Language } from "@/types";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";

loader.config({ monaco });

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

interface EditorPanelProps {
  state:         SessionState;
  /** Run code locally and display output in the panel */
  onRun:         (source: string, language: Language) => Promise<ExecutionResult>;
  /** Submit code to the tutor for evaluation via chat */
  onSubmit:      (source: string, language: Language) => void;
  onRequestHint: () => Promise<string>;
}

export function EditorPanel({ state, onRun, onSubmit, onRequestHint }: EditorPanelProps) {
  const task   = state.currentSandboxTask ?? state.currentTestTask;
  const isTest = state.currentMode === "test";

  const [code,          setCode]          = useState(state.currentSandboxTask?.starterCode ?? "");
  const [hint,          setHint]          = useState<string | null>(null);
  const [hintLoading,   setHintLoading]   = useState(false);
  const [showCriteria,  setShowCriteria]  = useState(true);
  const [runResult,     setRunResult]     = useState<ExecutionResult | null>(null);
  const [isRunning,     setIsRunning]     = useState(false);

  // Resolve execution language: task language > session language > python fallback
  const execLanguage: Language = (
    state.currentSandboxTask?.language ??
    state.currentTestTask?.language ??
    (state.language === "general" ? "python" : state.language)
  );

  // Update starter code when task changes
  useEffect(() => {
    if (state.currentSandboxTask?.starterCode) {
      setCode(state.currentSandboxTask.starterCode);
    }
    setHint(null);
    setRunResult(null);
  }, [state.currentSandboxTask]);

  const handleRun = async () => {
    if (!code.trim() || isRunning) return;
    setIsRunning(true);
    setRunResult(null);
    try {
      const result = await onRun(code, execLanguage);
      setRunResult(result);
    } finally {
      setIsRunning(false);
    }
  };

  const handleSubmit = () => {
    if (!code.trim()) return;
    onSubmit(code, execLanguage);
  };

  const handleHint = async () => {
    setHintLoading(true);
    try {
      const h = await onRequestHint();
      setHint(h);
    } finally {
      setHintLoading(false);
    }
  };

  const editorLanguage =
    execLanguage === "typescript" ? "typescript" :
    execLanguage === "javascript" ? "javascript" :
    execLanguage === "java"       ? "java"       : "python";

  return (
    <div className="flex flex-col h-full">

      {/* Task description */}
      {task && (
        <div className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant={isTest ? "error" : "gold"}>
                  {isTest ? "Assessment" : "Practice"}
                </Badge>
                {isTest && state.currentTestTask?.timeboxMinutes && (
                  <span className="text-xs text-[var(--color-text-muted)] flex items-center gap-1">
                    <Clock size={11} /> {state.currentTestTask.timeboxMinutes} min
                  </span>
                )}
              </div>
              <p className="text-sm text-[var(--color-text)] leading-snug">
                {"instructions" in task ? task.instructions : task.prompt}
              </p>
            </div>
          </div>

          {/* Success criteria (sandbox) */}
          {"successCriteria" in task && task.successCriteria.length > 0 && (
            <div>
              <button
                onClick={() => setShowCriteria(v => !v)}
                className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
              >
                <ChevronDown size={12} className={`transition-transform ${showCriteria ? "" : "-rotate-90"}`} />
                Success criteria
              </button>
              <AnimatePresence>
                {showCriteria && (
                  <motion.ul
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="mt-1.5 space-y-0.5 overflow-hidden"
                  >
                    {task.successCriteria.map((c, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-[var(--color-text-muted)]">
                        <CheckCircle2 size={11} className="mt-0.5 shrink-0 text-[var(--color-success)]" />
                        {c}
                      </li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Public rubric (test) */}
          {"publicRubricItems" in task && task.publicRubricItems.length > 0 && (
            <div className="space-y-0.5">
              {task.publicRubricItems.map((item, i) => (
                <div key={i} className="flex items-start gap-1.5 text-xs text-[var(--color-text-muted)]">
                  <CheckCircle2 size={11} className="mt-0.5 shrink-0 text-[var(--color-text-faint)]" />
                  {item}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Monaco editor */}
      <div className="flex-1 min-h-0 bg-[var(--color-surface)]">
        <MonacoEditor
          height="100%"
          language={editorLanguage}
          value={code}
          onChange={v => setCode(v ?? "")}
          theme="vs-dark"
          options={{
            fontSize:             13,
            fontFamily:           "var(--font-mono)",
            minimap:              { enabled: false },
            lineNumbers:          "on",
            scrollBeyondLastLine: false,
            padding:              { top: 12, bottom: 12 },
            wordWrap:             "on",
            renderLineHighlight:  "gutter",
            readOnly:             false,
          }}
        />
      </div>

      {/* Output panel — shown after every Run */}
      <AnimatePresence>
        {runResult && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden shrink-0 border-t border-[var(--color-border)]"
          >
            <div className="bg-[#1e1e1e] max-h-44 overflow-y-auto">
              {/* Output header */}
              <div className={`flex items-center justify-between px-3 py-1.5 border-b ${
                runResult.exitCode === 0
                  ? "border-[var(--color-success)] bg-[var(--color-success-highlight)]"
                  : "border-[var(--color-error)]   bg-[var(--color-error-highlight)]"
              }`}>
                <div className="flex items-center gap-1.5">
                  <Terminal size={11} className={runResult.exitCode === 0 ? "text-[var(--color-success)]" : "text-[var(--color-error)]"} />
                  <span className="text-xs font-medium" style={{ color: runResult.exitCode === 0 ? "var(--color-success)" : "var(--color-error))" }}>
                    {runResult.exitCode === 0 ? "Run succeeded" : "Run failed"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--color-text-muted)]">{runResult.runtimeMs}ms</span>
                  <button
                    onClick={() => setRunResult(null)}
                    className="text-[var(--color-text-faint)] hover:text-[var(--color-text)] transition-colors"
                    aria-label="Clear output"
                  >
                    <XCircle size={12} />
                  </button>
                </div>
              </div>

              {/* stdout */}
              {runResult.stdout && (
                <pre className="px-3 py-2 text-xs text-[#d4d4d4] font-mono whitespace-pre-wrap leading-relaxed">
                  {runResult.stdout}
                </pre>
              )}

              {/* stderr */}
              {runResult.stderr && (
                <pre className="px-3 py-2 text-xs text-[#f48771] font-mono whitespace-pre-wrap leading-relaxed border-t border-[#3a3a3a]">
                  {runResult.stderr}
                </pre>
              )}

              {/* empty output */}
              {!runResult.stdout && !runResult.stderr && (
                <p className="px-3 py-2 text-xs text-[var(--color-text-faint)] italic">No output.</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hint */}
      <AnimatePresence>
        {hint && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-[var(--color-border)]"
          >
            <div className="px-4 py-2.5 bg-[var(--color-gold-highlight)] flex items-start gap-2">
              <Lightbulb size={13} className="text-[var(--color-gold)] mt-0.5 shrink-0" />
              <p className="text-xs text-[var(--color-text)] leading-relaxed">{hint}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toolbar */}
      {state.uiDirectives.showRunButton && (
        <div className="shrink-0 flex items-center justify-between px-3 py-2.5 border-t border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="flex items-center gap-2">
            {state.uiDirectives.showHintButton && !isTest && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleHint}
                loading={hintLoading}
                className="gap-1.5"
              >
                <Lightbulb size={13} />
                Hint
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Run — executes locally, shows output inline */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRun}
              loading={isRunning}
              disabled={!code.trim() || state.isExecuting}
              className="gap-1.5"
            >
              <Play size={13} />
              {isRunning ? "Running…" : "Run"}
            </Button>

            {/* Submit — sends code to tutor for evaluation */}
            <Button
              variant="primary"
              size="sm"
              onClick={handleSubmit}
              loading={state.isLoading}
              disabled={!code.trim()}
              className="gap-1.5"
            >
              <Send size={13} />
              {state.isLoading ? "Sending…" : "Submit to tutor"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
