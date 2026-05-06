"use client";
import { useState, useRef, KeyboardEvent } from "react";
import { Send, Code2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend:      (message: string) => void;
  isLoading:   boolean;
  disabled?:   boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, isLoading, disabled, placeholder }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  };

  return (
    <div className={cn(
      "flex items-end gap-2 p-3 border-t border-[var(--color-border)] bg-[var(--color-surface)]",
      disabled && "opacity-60 pointer-events-none"
    )}>
      <div className="flex-1 relative rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] focus-within:border-[var(--color-primary)] transition-colors duration-150">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => { setValue(e.target.value); handleInput(); }}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder={placeholder ?? "Ask me anything, share your code, or just chat…"}
          className="w-full resize-none bg-transparent px-4 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] focus:outline-none min-h-[42px] max-h-[180px]"
        />
        <div className="absolute right-2 bottom-1.5 flex items-center gap-1 text-[var(--color-text-faint)]">
          <Code2 size={12} />
          <span className="text-[10px]">Shift+Enter for newline</span>
        </div>
      </div>
      <Button
        variant="primary"
        size="md"
        onClick={handleSend}
        disabled={!value.trim() || isLoading}
        loading={isLoading}
        className="shrink-0 rounded-xl h-[42px]"
        aria-label="Send message"
      >
        <Send size={15} />
      </Button>
    </div>
  );
}