import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { TutorMode } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function modeLabel(mode?: TutorMode): string {
  switch (mode) {
    case "chat":    return "Chat";
    case "sandbox": return "Sandbox";
    case "test":    return "Assessment";
    default:        return "idle";
  }
}

export function modeColor(mode?: TutorMode): string {
  switch (mode) {
    case "chat":    return "bg-[var(--color-blue-highlight)] text-[var(--color-blue)]";
    case "sandbox": return "bg-[var(--color-gold-highlight)] text-[var(--color-gold)]";
    case "test":    return "bg-[var(--color-error-highlight)] text-[var(--color-error)]";
    default:        return "bg-[var(--color-surface-offset)] text-[var(--color-text-muted)]";
  }
}

export function formatRuntime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
