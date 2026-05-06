"use client";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface SkillBarProps {
  label: string;
  value: number;  // 0–1
  colorClass?: string;
  className?: string;
}

export function SkillBar({ label, value, colorClass, className }: SkillBarProps) {
  const pct = Math.round(value * 100);
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex justify-between items-center">
        <span className="text-xs text-[var(--color-text-muted)]">{label}</span>
        <span className="text-xs text-[var(--color-text-faint)] tabular-nums">{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--color-surface-dynamic)] overflow-hidden">
        <motion.div
          className={cn("h-full rounded-full", colorClass ?? "bg-[var(--color-primary)]")}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 200, damping: 30 }}
        />
      </div>
    </div>
  );
}
