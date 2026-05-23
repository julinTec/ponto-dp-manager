import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Check, X, FileText, CheckCircle2, Paperclip } from "lucide-react";
import { CompanyFilter } from "@/components/CompanyFilter";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";

function initials(name?: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

interface Row {
  id: string;
  tipo: string;
  data_inicio: string;
  data_fim?: string | null;
  motivo?: string | null;
  status: string;
  attachment_path?: string | null;
  employee: { id: string; nome: string } | null;
  has_medical_certificate?: boolean;
}

export default function Aprovacoes() {
  const { user } = useAuth();
  const [companyFilter, setCompanyFilter] = useState<string | null>(null);
  const [justs, setJusts] = useState<Row[]>([]);
  const [reqs, setReqs] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<{ kind: "just" | "req"; row: Row; action: "aprovada" | "recusada" } | null>(null);
  const [comment, setComment] = useState("");

  useEffect(() => { load(); }, [companyFilter]);

  async function load() {
    setLoading(true);
    const baseJ = supabase
      .from("employee_justifications")
      .select("*, employee:employees(id, nome)")
      .eq("status", "pendente")
      .order("created_at", { ascending: false });
    const baseR = supabase
      .from("employee_requests")
      .select("*, employee:employees(id, nome)")
      .eq("status", "pendente")
      .order("created_at", { ascending: false });
    const [j, r] = await Promise.all([
      companyFilter ? baseJ.eq("company_id", companyFilter) : baseJ,
      companyFilter ? baseR.eq("company_id", companyFilter) : baseR,
    ]);
    setJusts((j.data ?? []) as any);
    setReqs((r.data ?? []) as any);
    setLoading(false);
  }

  async function decidir() {
    if (!reviewing || !user) return;
    const { kind, row, action } = reviewing;
    setActing(row.id);
    const table = kind === "just" ? "employee_justifications" : "employee_requests";
    const { error } = await supabase.from(table).update({
      status: action,
      reviewer_id: user.id,
      reviewer_comment: comment || null,
      reviewed_at: new Date().toISOString(),
    }).eq("id", row.id);

    // Atestado aprovado: aplica nas marcações
    if (!error && kind === "just" && action === "aprovada" && row.tipo === "atestado" && row.employee) {
      await supabase.rpc("apply_medical_certificate", {
        _employee_id: row.employee.id,
        _start: row.data_inicio,
        _end: row.data_fim ?? row.data_inicio,
      });
    }

    setActing(null);
    if (error) return toast.error(error.message);
    toast.success(action === "aprovada" ? "Aprovado" : "Recusado");
    setReviewing(null); setComment("");
    load();
  }

  function renderList(items: Row[], kind: "just" | "req") {
    if (loading) return <div className="p-12 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>;
    if (items.length === 0) return (
      <EmptyState
        icon={CheckCircle2}
        title="Sem pendências"
        description={kind === "just" ? "Nenhuma justificativa aguardando aprovação." : "Nenhum pedido pendente da equipe."}
      />
    );
    return (
      <div className="divide-y divide-border/70">
        {items.map((j) => (
          <div key={j.id} className="p-4 sm:px-6 flex items-start justify-between gap-3 hover:bg-muted/30 transition-colors">
            <div className="flex items-start gap-3 min-w-0">
              <div className="h-10 w-10 rounded-xl bg-gradient-primary text-primary-foreground flex items-center justify-center text-xs font-semibold shrink-0">
                {initials(j.employee?.nome)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm text-foreground">{j.employee?.nome ?? "Funcionário"}</p>
                  <span className="chip bg-primary/10 text-primary border-primary/20 capitalize">{j.tipo.replace("_", " ")}</span>
                  {j.attachment_path && (
                    <span className="chip bg-muted text-muted-foreground border-border">
                      <Paperclip className="h-3 w-3" /> Anexo
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {format(new Date(j.data_inicio), "dd/MM/yyyy")}
                  {j.data_fim && ` → ${format(new Date(j.data_fim), "dd/MM/yyyy")}`}
                </p>
                {j.motivo && <p className="text-xs mt-2 text-foreground/80 italic">"{j.motivo}"</p>}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button size="sm" className="bg-premium hover:bg-premium/90 text-premium-foreground" disabled={acting === j.id}
                onClick={() => { setReviewing({ kind, row: j, action: "aprovada" }); setComment(""); }}>
                <Check className="h-4 w-4 mr-1" />Aprovar
              </Button>
              <Button size="sm" variant="ghost" disabled={acting === j.id}
                onClick={() => { setReviewing({ kind, row: j, action: "recusada" }); setComment(""); }}>
                <X className="h-4 w-4 mr-1" />Recusar
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-6">
        <PageHeader
          title="Aprovações"
          subtitle="Justificativas e solicitações pendentes da equipe"
          eyebrow="Pessoas"
          actions={<CompanyFilter value={companyFilter} onChange={setCompanyFilter} />}
        />

        <Tabs defaultValue="justs">
          <TabsList className="bg-muted/60 p-1 rounded-xl">
            <TabsTrigger value="justs" className="rounded-lg">Justificativas ({justs.length})</TabsTrigger>
            <TabsTrigger value="reqs" className="rounded-lg">Solicitações ({reqs.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="justs" className="mt-4"><SectionCard>{renderList(justs, "just")}</SectionCard></TabsContent>
          <TabsContent value="reqs" className="mt-4"><SectionCard>{renderList(reqs, "req")}</SectionCard></TabsContent>
        </Tabs>

        <Dialog open={!!reviewing} onOpenChange={(v) => { if (!v) setReviewing(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {reviewing?.action === "aprovada" ? "Aprovar" : "Recusar"} — {reviewing?.row.employee?.nome}
              </DialogTitle>
            </DialogHeader>
            <Textarea placeholder="Comentário ao funcionário (opcional)" value={comment} onChange={(e) => setComment(e.target.value)} rows={3} maxLength={500} />
            {reviewing?.kind === "just" && reviewing.row.tipo === "atestado" && reviewing.action === "aprovada" && (
              <p className="text-xs text-muted-foreground">Ao aprovar, as marcações do período serão atualizadas como atestado médico.</p>
            )}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setReviewing(null)}>Cancelar</Button>
              <Button onClick={decidir} disabled={acting !== null}>Confirmar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
