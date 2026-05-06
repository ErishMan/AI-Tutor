"use client";
import { BookOpen, RotateCcw, Wifi, WifiOff } from "lucide-react";
import { SessionState, Language, Difficulty } from "@/types";import { SkillBar } from "@/components/ui/SkillBar";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface SidebarProps {
  state: SessionState;
  onReset: () => void;
  onTopicChange:      (t: string)       => void;   
  onDifficultyChange: (d: Difficulty)   => void;   
  onLanguageChange:   (l: Language)     => void;   

}

export function Sidebar({ state, onReset, onTopicChange, onDifficultyChange, onLanguageChange}: SidebarProps) {
  const { learnerState, lmStatus, topic, difficulty } = state;

  return (
    <aside className="w-52 shrink-0 flex flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] overflow-y-auto">
      {/* Logo */}
      <div className="h-12 flex items-center gap-2.5 px-4 border-b border-[var(--color-border)] shrink-0">
        <div className="w-6 h-6 rounded-lg bg-[var(--color-primary)] flex items-center justify-center">
          <BookOpen size={13} className="text-white" />
        </div>
        <span className="text-sm font-semibold text-[var(--color-text)]">TutorAI</span>
      </div>

      {/* Session info */}
      <div className="px-3 py-3 border-b border-[var(--color-border)] space-y-0.5">
        <p className="text-xs font-medium text-[var(--color-text)] truncate">{topic}</p>
        <p className="text-xs text-[var(--color-text-muted)] capitalize">{difficulty}</p>
      </div>

      {/* Learner state */}
      <div className="px-3 py-3 space-y-3 flex-1">
        <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">Learner State</p>
        <SkillBar label="Skill" value={learnerState.estimatedSkill} colorClass="bg-[var(--color-primary)]" />
        <SkillBar label="Mastery" value={learnerState.mastery} colorClass="bg-[var(--color-success)]" />
        <SkillBar label="Confusion" value={learnerState.confusion} colorClass="bg-[var(--color-warning)]" />
        <SkillBar label="Frustration" value={learnerState.frustration} colorClass="bg-[var(--color-error)]" />

        {learnerState.masteredConcepts.length > 0 && (
          <div className="pt-1">
            <p className="text-xs text-[var(--color-text-muted)] mb-1.5">Mastered</p>
            <div className="flex flex-wrap gap-1">
              {learnerState.masteredConcepts.map(c => (
                <span key={c} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-success-highlight)] text-[var(--color-success)]">
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}

        {learnerState.misconceptions.length > 0 && (
          <div>
            <p className="text-xs text-[var(--color-text-muted)] mb-1.5">Misconceptions</p>
            <div className="flex flex-wrap gap-1">
              {learnerState.misconceptions.map(c => (
                <span key={c} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-warning-highlight)] text-[var(--color-warning)]">
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-[var(--color-border)] space-y-2">
        <div className={cn("flex items-center gap-2 text-xs", lmStatus === "online" ? "text-[var(--color-success)]" : "text-[var(--color-error)]")}>
          {lmStatus === "online" ? <Wifi size={12} /> : <WifiOff size={12} />}
          LM Studio {lmStatus}
        </div>
        <Button variant="ghost" size="sm" onClick={onReset} className="w-full justify-start gap-1.5 text-[var(--color-text-muted)]">
          <RotateCcw size={12} /> New session
        </Button>
      </div>
    </aside>
  );
}
