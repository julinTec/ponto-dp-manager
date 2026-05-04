import { Badge } from "@/components/ui/badge";
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
  enviado: "bg-muted text-muted-foreground hover:bg-muted",
  processando: "bg-info/15 text-info hover:bg-info/20 border-info/30",
  aguardando_revisao: "bg-warning/15 text-warning hover:bg-warning/20 border-warning/30",
  revisado: "bg-success/15 text-success hover:bg-success/20 border-success/30",
  exportado: "bg-primary/15 text-primary hover:bg-primary/20 border-primary/30",
};

export function StatusBadge({ status, className }: { status: BatchStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", STYLES[status], className)}>
      {LABELS[status]}
    </Badge>
  );
}
