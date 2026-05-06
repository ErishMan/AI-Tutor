export default function Loading() {
  return (
    <div className="flex h-screen items-center justify-center bg-[var(--color-bg)]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)] animate-pulse" />
        <p className="text-sm text-[var(--color-text-muted)]">Loading tutor…</p>
      </div>
    </div>
  );
}