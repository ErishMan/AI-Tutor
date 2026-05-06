"use client";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { SessionState } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { modeLabel, modeColor } from "@/lib/utils";

interface TopBarProps {
  state: SessionState;
}

export function TopBar({ state }: TopBarProps) {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const preferred = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    setTheme(preferred);
    document.documentElement.setAttribute("data-theme", preferred);
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
  };

  return (
    <header className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-[var(--color-text)]">{state.topic}</span>
        <Badge className={modeColor(state.currentMode)}>
          {modeLabel(state.currentMode)}
        </Badge>
        {state.isLoading && (
          <span className="text-xs text-[var(--color-text-muted)] animate-pulse">Tutor thinking…</span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {state.sessionId && (
          <span className="text-xs text-[var(--color-text-faint)] font-mono">
            {state.sessionId.slice(0, 8)}
          </span>
        )}
        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-offset)] transition-colors duration-150"
        >
          {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </div>
    </header>
  );
}