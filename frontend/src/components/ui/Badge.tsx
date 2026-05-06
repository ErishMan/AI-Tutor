import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "primary" | "success" | "error" | "warning" | "gold";
}

const variantStyles: Record<string, string> = {
  default:  "bg-[var(--color-surface-offset)] text-[var(--color-text-muted)]",
  primary:  "bg-[var(--color-primary-highlight)] text-[var(--color-primary)]",
  success:  "bg-[var(--color-success-highlight)] text-[var(--color-success)]",
  error:    "bg-[var(--color-error-highlight)] text-[var(--color-error)]",
  warning:  "bg-[var(--color-warning-highlight)] text-[var(--color-warning)]",
  gold:     "bg-[var(--color-gold-highlight)] text-[var(--color-gold)]",
};

export function Badge({ children, className, variant = "default" }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
