import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

export function SectionCard({ title, description, actions, className, bodyClassName, children }: Props) {
  return (
    <section className={cn("rounded-2xl bg-card border border-border/70 shadow-card overflow-hidden", className)}>
      {(title || actions) && (
        <header className="px-6 py-4 border-b border-border/70 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h3 className="font-semibold text-foreground leading-tight">{title}</h3>}
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </header>
      )}
      <div className={cn(bodyClassName)}>{children}</div>
    </section>
  );
}
