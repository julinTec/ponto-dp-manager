import { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

type Tone = "primary" | "premium" | "warning" | "destructive" | "info" | "muted";

const TONE: Record<Tone, { chip: string; text: string }> = {
  primary: { chip: "bg-primary/10 text-primary", text: "text-primary" },
  premium: { chip: "bg-premium/10 text-premium", text: "text-premium" },
  warning: { chip: "bg-warning/10 text-warning", text: "text-warning" },
  destructive: { chip: "bg-destructive/10 text-destructive", text: "text-destructive" },
  info: { chip: "bg-info/10 text-info", text: "text-info" },
  muted: { chip: "bg-muted text-muted-foreground", text: "text-muted-foreground" },
};

interface MetricCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: Tone;
  hint?: string;
  to?: string;
  className?: string;
}

export function MetricCard({ label, value, icon: Icon, tone = "primary", hint, to, className }: MetricCardProps) {
  const t = TONE[tone];
  const body = (
    <div
      className={cn(
        "group relative h-full rounded-2xl bg-card border border-border/70 p-5 shadow-card",
        "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-elevated",
        to && "cursor-pointer",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-muted-foreground truncate">{label}</p>
          <p className="mt-2 text-3xl font-bold text-foreground tabular-nums tracking-tight">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center shrink-0", t.chip)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
  return to ? <Link to={to} className="block h-full">{body}</Link> : body;
}
