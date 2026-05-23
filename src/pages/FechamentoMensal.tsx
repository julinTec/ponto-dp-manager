import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CompanyFilter } from "@/components/CompanyFilter";
import { Loader2, CalendarCheck2, Lock, Unlock, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

export default function FechamentoMensal() {
  const { isDp, isAdmin, isSuperAdmin } = useAuth();
  const canClose = isDp || isAdmin || isSuperAdmin;
  const [params, setParams] = useSearchParams();
  const now = new Date();
  const [ano, setAno] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [companyFilter, setCompanyFilter] = useState<string | null>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [closures, setClosures] = useState<Record<string, any>>({});
  const [selectedEmp, setSelectedEmp] = useState<string | null>(params.get("employee"));
  const [preview, setPreview] = useState<any>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [acting, setActing] = useState(false);
  const [obs, setObs] = useState("");

  useEffect(() => { loadList(); }, [ano, mes, companyFilter]);
  useEffect(() => { if (selectedEmp) loadPreview(); else setPreview(null); }, [selectedEmp, ano, mes]);

  async function loadList() {
    setLoadingList(true);
    let qe = supabase.from("employees").select("id, nome, cargo, company_id").eq("status", "ativo").order("nome");
    if (companyFilter) qe = qe.eq("company_id", companyFilter);
    const { data: emps } = await qe;
    setEmployees(emps ?? []);

    const ids = (emps ?? []).map((e) => e.id);
    if (ids.length > 0) {
      const { data: cls } = await supabase
        .from("monthly_closures")
        .select("*")
        .in("employee_id", ids)
        .eq("ano", ano)
        .eq("mes", mes);
      const map: Record<string, any> = {};
      (cls ?? []).forEach((c) => { map[c.employee_id] = c; });
      setClosures(map);
    } else {
      setClosures({});
    }
    setLoadingList(false);
  }

  async function loadPreview() {
    if (!selectedEmp) return;
    setLoadingPreview(true);
    setPreview(null);
    const { data, error } = await supabase.functions.invoke("monthly-closure", {
      body: { employee_id: selectedEmp, ano, mes, action: "preview" },
    });
    if (error) toast.error(error.message);
    else setPreview(data);
    setLoadingPreview(false);
  }

  async function fechar() {
    if (!selectedEmp) return;
    setActing(true);
    const { data, error } = await supabase.functions.invoke("monthly-closure", {
      body: { employee_id: selectedEmp, ano, mes, action: "fechar", observacoes: obs || undefined },
    });
    setActing(false);
    if (error) return toast.error(error.message);
    toast.success("Mês fechado");
    setObs("");
    loadList();
    setPreview({ ...(preview ?? {}), totais: data?.totais ?? preview?.totais });
  }

  async function reabrir() {
    if (!selectedEmp) return;
    if (!confirm("Reabrir o fechamento deste funcionário?")) return;
    setActing(true);
    const { error } = await supabase.functions.invoke("monthly-closure", {
      body: { employee_id: selectedEmp, ano, mes, action: "reabrir" },
    });
    setActing(false);
    if (error) return toast.error(error.message);
    toast.success("Mês reaberto");
    loadList();
  }

  const selected = useMemo(() => employees.find((e) => e.id === selectedEmp), [employees, selectedEmp]);
  const currentClosure = selectedEmp ? closures[selectedEmp] : null;

  const anos = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  return (
    <AppLayout>
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <PageHeader
          title="Fechamento mensal"
          subtitle="Consolidação de horas, faltas e ocorrências por funcionário"
          actions={<CompanyFilter value={companyFilter} onChange={setCompanyFilter} />}
        />

        <Card className="p-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Mês</Label>
            <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>{MESES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Ano</Label>
            <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>{anos.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-[320px,1fr] gap-6">
          <Card className="overflow-hidden h-fit">
            <div className="px-4 py-3 border-b text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Funcionários ({employees.length})
            </div>
            {loadingList ? (
              <div className="p-8 text-center"><Loader2 className="h-4 w-4 animate-spin mx-auto" /></div>
            ) : employees.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Nenhum funcionário.</div>
            ) : (
              <div className="max-h-[600px] overflow-auto divide-y">
                {employees.map((e) => {
                  const cls = closures[e.id];
                  const active = selectedEmp === e.id;
                  return (
                    <button
                      key={e.id}
                      onClick={() => { setSelectedEmp(e.id); setParams({ employee: e.id }); }}
                      className={`w-full text-left px-4 py-2.5 flex items-center justify-between hover:bg-muted/40 ${active ? "bg-accent/60" : ""}`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{e.nome}</p>
                        <p className="text-xs text-muted-foreground truncate">{e.cargo ?? "—"}</p>
                      </div>
                      {cls?.status === "fechado" && <Badge className="bg-success/15 text-success border-success/30" variant="outline">Fechado</Badge>}
                      {cls?.status === "reaberto" && <Badge variant="outline" className="bg-warning/15 text-warning border-warning/30">Reaberto</Badge>}
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          <Card className="p-6 min-h-[400px]">
            {!selected ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground py-16">
                <CalendarCheck2 className="h-10 w-10 mb-3" />
                <p>Selecione um funcionário para visualizar o fechamento de {MESES[mes - 1]}/{ano}.</p>
              </div>
            ) : loadingPreview ? (
              <div className="py-16 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <h2 className="text-xl font-semibold">{selected.nome}</h2>
                    <p className="text-sm text-muted-foreground">{selected.cargo ?? "—"} · {MESES[mes - 1]}/{ano}</p>
                  </div>
                  {currentClosure?.status === "fechado" && (
                    <Badge className="bg-success/15 text-success border-success/30" variant="outline">
                      <Lock className="h-3 w-3 mr-1" />Fechado em {new Date(currentClosure.fechado_em).toLocaleDateString("pt-BR")}
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Stat label="Dias trabalhados" value={preview?.totais?.dias_trabalhados} />
                  <Stat label="Horas trabalhadas" value={preview?.totais?.horas_trabalhadas} suffix="h" />
                  <Stat label="Horas extras" value={preview?.totais?.horas_extras} suffix="h" tone="success" />
                  <Stat label="Horas faltantes" value={preview?.totais?.horas_faltantes} suffix="h" tone="destructive" />
                  <Stat label="Faltas" value={preview?.totais?.faltas} />
                  <Stat label="Faltas justificadas" value={preview?.totais?.faltas_justificadas} />
                  <Stat label="Atestados" value={preview?.totais?.atestados} />
                  <Stat label="DSR descontado" value={preview?.totais?.dsr_descontos_horas} suffix="h" tone="destructive" />
                  <Stat label="Horas noturnas" value={preview?.totais?.horas_noturnas} suffix="h" />
                  <Stat label="Folgas" value={preview?.totais?.folgas} />
                  <Stat label="Feriados" value={preview?.totais?.feriados} />
                  <Stat label="Ajustes" value={preview?.totais?.ajustes_horas} suffix="h" />
                </div>

                {canClose && (
                  <div className="space-y-3 pt-4 border-t">
                    {currentClosure?.observacoes && (
                      <div className="text-xs text-muted-foreground">
                        <strong>Obs anteriores:</strong> {currentClosure.observacoes}
                      </div>
                    )}
                    <div className="space-y-1">
                      <Label className="text-xs">Observações do fechamento</Label>
                      <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} placeholder="Opcional" />
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={loadPreview} disabled={loadingPreview}>
                        <RefreshCw className="h-4 w-4 mr-2" />Recalcular
                      </Button>
                      {currentClosure?.status === "fechado" ? (
                        <Button variant="outline" onClick={reabrir} disabled={acting}>
                          <Unlock className="h-4 w-4 mr-2" />Reabrir
                        </Button>
                      ) : (
                        <Button onClick={fechar} disabled={acting}>
                          {acting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Lock className="h-4 w-4 mr-2" />}
                          Fechar mês
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}

function Stat({ label, value, suffix = "", tone }: { label: string; value: number | undefined; suffix?: string; tone?: "success" | "destructive" }) {
  const v = value ?? 0;
  const color = tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${color}`}>{Number(v).toLocaleString("pt-BR")}{suffix}</p>
    </div>
  );
}
