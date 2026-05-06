"use client";
import { motion } from "motion/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ConversationMessage } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { modeColor, modeLabel, formatRuntime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, Clock } from "lucide-react";

interface MessageBubbleProps {
  message: ConversationMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", damping: 30, stiffness: 250 }}
      className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}
    >
      {/* Avatar */}
      <div className={cn(
        "w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs font-semibold mt-0.5",
        isUser
          ? "bg-[var(--color-surface-dynamic)] text-[var(--color-text-muted)]"
          : "bg-[var(--color-primary)] text-white"
      )}>
        {isUser ? "U" : "T"}
      </div>

      <div className={cn("flex flex-col gap-1 max-w-[78%]", isUser && "items-end")}>
        {/* Mode badge — assistant only */}
        {!isUser && (
          <Badge className={cn("self-start text-[10px]", modeColor(message.mode))}>
            {modeLabel(message.mode)}
          </Badge>
        )}

        {/* Bubble */}
        <div className={cn(
          "rounded-xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "bg-[var(--color-primary)] text-[var(--color-text-inverse)] rounded-tr-sm"
            : "bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] rounded-tl-sm"
        )}>
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-sm max-w-none [&_code]:font-mono [&_code]:text-xs [&_pre]:bg-[var(--color-surface-offset)] [&_pre]:rounded-lg [&_pre]:p-3 [&_p]:text-[var(--color-text)] [&_strong]:text-[var(--color-text)] [&_li]:text-[var(--color-text)]">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Code submission result */}
        {message.code?.result && (
          <div className="w-full mt-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-offset)] overflow-hidden text-xs font-mono">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--color-border)]">
              <div className="flex items-center gap-2">
                {message.code.result.exitCode === 0
                  ? <CheckCircle2 size={12} className="text-[var(--color-success)]" />
                  : <XCircle     size={12} className="text-[var(--color-error)]" />
                }
                <span className="text-[var(--color-text-muted)]">
                  {message.code.result.exitCode === 0 ? "Ran successfully" : "Error"}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[var(--color-text-faint)]">
                <Clock size={10} />
                {formatRuntime(message.code.result.runtimeMs)}
              </div>
            </div>
            {message.code.result.stdout && (
              <pre className="px-3 py-2 text-[var(--color-text)] whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
                {message.code.result.stdout}
              </pre>
            )}
            {message.code.result.stderr && (
              <pre className="px-3 py-2 text-[var(--color-error)] whitespace-pre-wrap break-words max-h-32 overflow-y-auto border-t border-[var(--color-border)]">
                {message.code.result.stderr}
              </pre>
            )}
          </div>
        )}

        {/* Timestamp */}
        <span className="text-[10px] text-[var(--color-text-faint)] px-1">
          {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </motion.div>
  );
}