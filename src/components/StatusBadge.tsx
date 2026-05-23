import { cn } from "@/lib/utils";

export type BatchStatus = "enviado" | "processando" | "aguardando_revisao" | "revisado" | "exportado";

const LABELS: Record<BatchStatus, string> = {
  enviado: "Enviado",
  processando: "Processando",
  aguardando_revisao: "Aguardando revisão",
  revisado: "Revisado",
  exportado: "Exportado",
};

const STYLES: Record<BatchStatus, string> = {
  enviado: "bg-muted text-muted-foreground border-border",
  processando: "bg-info/10 text-info border-info/20",
  aguardando_revisao: "bg-warning/10 text-warning border-warning/20",
  revisado: "bg-success/10 text-success border-success/20",
  exportado: "bg-primary/10 text-primary border-primary/20",
};

export function StatusBadge({ status, className }: { status: BatchStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap",
        STYLES[status],
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", {
        "bg-muted-foreground": status === "enviado",
        "bg-info": status === "processando",
        "bg-warning": status === "aguardando_revisao",
        "bg-success": status === "revisado",
        "bg-primary": status === "exportado",
      })} />
      {LABELS[status]}
    </span>
  );
}
