import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "primary" | "premium" | "warning" | "destructive" | "muted";
const DOT: Record<Tone, string> = {
  primary: "bg-primary",
  premium: "bg-premium",
  warning: "bg-warning",
  destructive: "bg-destructive",
  muted: "bg-muted-foreground/40",
};

export interface TimelineItem {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  time?: string;
  tone?: Tone;
}

export function Timeline({ items, className }: { items: TimelineItem[]; className?: string }) {
  if (items.length === 0) return null;
  return (
    <ol className={cn("relative space-y-5 ms-2", className)}>
      <span className="absolute left-[5px] top-1 bottom-1 w-px bg-border" aria-hidden />
      {items.map((it) => (
        <li key={it.id} className="relative ps-6">
          <span className={cn("absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-card", DOT[it.tone ?? "primary"])} />
          <div className="flex flex-wrap items-baseline gap-x-2">
            <p className="text-sm font-medium text-foreground">{it.title}</p>
            {it.time && <span className="text-xs text-muted-foreground">{it.time}</span>}
          </div>
          {it.description && <p className="text-xs text-muted-foreground mt-0.5">{it.description}</p>}
        </li>
      ))}
    </ol>
  );
}
