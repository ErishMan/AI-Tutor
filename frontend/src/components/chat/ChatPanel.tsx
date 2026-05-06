"use client";
import { useEffect, useRef } from "react";
import { AnimatePresence } from "motion/react";
import { SessionState } from "@/types";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import { BookOpen } from "lucide-react";
import { motion } from "motion/react";

interface ChatPanelProps {
  state:     SessionState;
  onSend:    (message: string) => void;
}

export function ChatPanel({ state, onSend }: ChatPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.messages.length]);

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {state.messages.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center h-full gap-4 text-center"
          >
            <div className="w-12 h-12 rounded-2xl bg-[var(--color-primary-highlight)] flex items-center justify-center">
              <BookOpen size={22} className="text-[var(--color-primary)]" />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--color-text)]">
                Start your session
              </p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1 max-w-xs">
                Say hello, ask a question, or tell me what you&apos;re working on.
                I&apos;ll adapt to where you are.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              {[
                "What are Python lists?",
                "I'm stuck on recursion",
                "Can you give me a challenge?",
              ].map(s => (
                <button
                  key={s}
                  onClick={() => onSend(s)}
                  className="text-xs px-3 py-1.5 rounded-full border border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors duration-150"
                >
                  {s}
                </button>
              ))}
            </div>
          </motion.div>
        ) : (
          <AnimatePresence initial={false}>
            {state.messages.map(msg => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
          </AnimatePresence>
        )}

        {/* Typing indicator */}
        {state.isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex gap-3"
          >
            <div className="w-7 h-7 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-xs font-semibold text-white shrink-0">T</div>
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1 items-center h-4">
                {[0, 1, 2].map(i => (
                  <motion.div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)]"
                    animate={{ y: [0, -4, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
        <div ref={bottomRef} />
      </div>

      <ChatInput
        onSend={onSend}
        isLoading={state.isLoading}
        disabled={state.lmStatus === "offline"}
        placeholder={
          state.lmStatus === "offline"
            ? "LM Studio is offline — check your local server"
            : undefined
        }
      />
    </div>
  );
}