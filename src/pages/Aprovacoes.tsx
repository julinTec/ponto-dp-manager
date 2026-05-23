import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Check, X, FileText, CheckCircle2 } from "lucide-react";
import { CompanyFilter } from "@/components/CompanyFilter";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";

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
      <div className="p-12 text-center text-muted-foreground">
        <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-success" />
        <p>Sem pendências.</p>
      </div>
    );
    return (
      <div className="divide-y">
        {items.map((j) => (
          <div key={j.id} className="p-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium text-sm">{j.employee?.nome ?? "Funcionário"}</p>
                <Badge variant="outline" className="capitalize">{j.tipo.replace("_", " ")}</Badge>
                {j.attachment_path && <FileText className="h-3.5 w-3.5 text-muted-foreground" />}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {format(new Date(j.data_inicio), "dd/MM/yyyy")}
                {j.data_fim && ` → ${format(new Date(j.data_fim), "dd/MM/yyyy")}`}
              </p>
              {j.motivo && <p className="text-xs mt-1.5 text-foreground/80">{j.motivo}</p>}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button size="sm" variant="outline" disabled={acting === j.id}
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
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <PageHeader
          title="Aprovações"
          subtitle="Justificativas e solicitações pendentes da equipe"
          actions={<CompanyFilter value={companyFilter} onChange={setCompanyFilter} />}
        />

        <Tabs defaultValue="justs">
          <TabsList>
            <TabsTrigger value="justs">Justificativas ({justs.length})</TabsTrigger>
            <TabsTrigger value="reqs">Solicitações ({reqs.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="justs"><Card className="overflow-hidden">{renderList(justs, "just")}</Card></TabsContent>
          <TabsContent value="reqs"><Card className="overflow-hidden">{renderList(reqs, "req")}</Card></TabsContent>
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
