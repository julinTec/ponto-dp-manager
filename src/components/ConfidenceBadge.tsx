import { cn } from "@/lib/utils";

export function ConfidenceBadge({ value, className }: { value: number | null | undefined; className?: string }) {
  if (value == null) {
    return <span className={cn("inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground", className)}>—</span>;
  }
  const pct = Math.round(value * 100);
  const tone =
    value >= 0.9 ? "bg-success/15 text-success" :
    value >= 0.7 ? "bg-warning/15 text-warning" :
    "bg-destructive/15 text-destructive";
  return <span className={cn("inline-block px-2 py-0.5 rounded text-[10px] font-medium tabular-nums", tone, className)}>{pct}%</span>;
}
