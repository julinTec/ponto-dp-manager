import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Download, FileBarChart2, Users, Clock, AlertTriangle, CalendarX, Moon, TrendingUp } from "lucide-react";
import { CompanyFilter } from "@/components/CompanyFilter";
import { toast } from "sonner";

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

interface Linha {
  employee_id: string;
  nome: string;
  cpf: string | null;
  cargo: string | null;
  total_horas: number;
  horas_extras: number;
  adicional_noturno_horas: number;
  horas_faltantes: number;
  dias_trabalhados: number;
  faltas_justificadas: number;
  faltas_injustificadas: number;
  folgas: number;
  feriados: number;
  inconsistencias: number;
  dsr_horas_descontar: number;
}

interface BatchOpt { id: string; nome: string; }

export default function Relatorios() {
  const [params, setParams] = useSearchParams();
  const loteParam = params.get("lote");

  const [mes, setMes] = useState(String(new Date().getMonth() + 1));
  const [ano, setAno] = useState(String(new Date().getFullYear()));
  const [loteId, setLoteId] = useState<string>(loteParam ?? "todos");
  const [lotes, setLotes] = useState<BatchOpt[]>([]);
  const [loading, setLoading] = useState(false);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [autoRan, setAutoRan] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("timesheet_batches")
        .select("id, nome, mes_referencia, ano_referencia")
        .eq("mes_referencia", parseInt(mes))
        .eq("ano_referencia", parseInt(ano))
        .order("created_at", { ascending: false });
      setLotes((data ?? []) as BatchOpt[]);
    })();
  }, [mes, ano]);

  useEffect(() => {
    if (!loteParam || autoRan) return;
    (async () => {
      const { data } = await supabase
        .from("timesheet_batches").select("mes_referencia, ano_referencia")
        .eq("id", loteParam).single();
      if (data) {
        if (data.mes_referencia) setMes(String(data.mes_referencia));
        if (data.ano_referencia) setAno(String(data.ano_referencia));
      }
      setAutoRan(true);
      setTimeout(() => gerar(loteParam), 100);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loteParam]);

  async function gerar(forceLote?: string) {
    setLoading(true);
    const useLote = forceLote ?? (loteId !== "todos" ? loteId : undefined);
    const body: any = useLote ? { batch_id: useLote } : { mes: parseInt(mes), ano: parseInt(ano) };
    const { data, error } = await supabase.functions.invoke("monthly-report", { body });
    setLoading(false);
    if (error) { console.error(error); return toast.error("Erro ao gerar relatório"); }
    const arr = (data?.linhas ?? []) as Linha[];
    setLinhas(arr);
    if (arr.length === 0) toast.info("Nenhuma marcação encontrada");
  }

  function onChangeLote(v: string) {
    setLoteId(v);
    if (v === "todos") { params.delete("lote"); setParams(params, { replace: true }); }
    else { params.set("lote", v); setParams(params, { replace: true }); }
  }

  function exportar() {
    if (linhas.length === 0) return;
    const header = "Funcionário;CPF;Cargo;Dias trab.;Total horas;HE;Noturno;Faltantes;Faltas just.;Faltas injust.;Folgas;Feriados;DSR descontar;Inconsistências";
    const rows = linhas.map((l) => [
      l.nome, l.cpf ?? "", l.cargo ?? "", l.dias_trabalhados,
      l.total_horas.toFixed(2), l.horas_extras.toFixed(2), l.adicional_noturno_horas.toFixed(2),
      l.horas_faltantes.toFixed(2), l.faltas_justificadas, l.faltas_injustificadas,
      l.folgas, l.feriados, l.dsr_horas_descontar.toFixed(2), l.inconsistencias,
    ].join(";"));
    const blob = new Blob(["\uFEFF" + [header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `consolidado_${ano}_${mes}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const kpis = useMemo(() => linhas.reduce((acc, l) => ({
    funcionarios: acc.funcionarios + 1,
    horas: acc.horas + l.total_horas,
    he: acc.he + l.horas_extras,
    noturno: acc.noturno + l.adicional_noturno_horas,
    faltas_just: acc.faltas_just + l.faltas_justificadas,
    faltas_injust: acc.faltas_injust + l.faltas_injustificadas,
    dsr: acc.dsr + l.dsr_horas_descontar,
    inconsistencias: acc.inconsistencias + l.inconsistencias,
  }), { funcionarios: 0, horas: 0, he: 0, noturno: 0, faltas_just: 0, faltas_injust: 0, dsr: 0, inconsistencias: 0 }), [linhas]);

  return (
    <AppLayout>
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <PageHeader
          title="Relatórios mensais"
          subtitle="Consolidado por funcionário: horas, HE, adicional noturno, faltas, DSR e inconsistências"
        />

        <Card className="p-4 flex flex-col sm:flex-row gap-3 items-end flex-wrap">
          <div className="space-y-2 min-w-[140px] flex-1">
            <Label>Mês</Label>
            <Select value={mes} onValueChange={setMes}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{MESES.map((m, i) => <SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2 w-28">
            <Label>Ano</Label>
            <Input type="number" value={ano} onChange={(e) => setAno(e.target.value)} />
          </div>
          <div className="space-y-2 min-w-[200px] flex-1">
            <Label>Lote</Label>
            <Select value={loteId} onValueChange={onChangeLote}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os lotes do mês</SelectItem>
                {lotes.map((l) => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => gerar()} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Gerar
          </Button>
          <Button variant="outline" onClick={exportar} disabled={linhas.length === 0}>
            <Download className="h-4 w-4 mr-2" />Exportar CSV
          </Button>
        </Card>

        {linhas.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard icon={<Users className="h-5 w-5" />} label="Funcionários" value={String(kpis.funcionarios)} />
            <KpiCard icon={<Clock className="h-5 w-5" />} label="Total de horas" value={`${kpis.horas.toFixed(1)}h`} />
            <KpiCard icon={<TrendingUp className="h-5 w-5" />} label="Horas extras" value={`${kpis.he.toFixed(1)}h`} />
            <KpiCard icon={<Moon className="h-5 w-5" />} label="Adicional noturno" value={`${kpis.noturno.toFixed(1)}h`} />
            <KpiCard icon={<CalendarX className="h-5 w-5" />} label="Faltas justificadas" value={String(kpis.faltas_just)} />
            <KpiCard icon={<CalendarX className="h-5 w-5" />} label="Faltas injustificadas" value={String(kpis.faltas_injust)} tone={kpis.faltas_injust > 0 ? "warn" : "ok"} />
            <KpiCard icon={<TrendingUp className="h-5 w-5 rotate-180" />} label="DSR a descontar" value={`${kpis.dsr.toFixed(1)}h`} tone={kpis.dsr > 0 ? "warn" : "ok"} />
            <KpiCard icon={<AlertTriangle className="h-5 w-5" />} label="Inconsistências" value={String(kpis.inconsistencias)} tone={kpis.inconsistencias > 0 ? "warn" : "ok"} />
          </div>
        )}

        <Card className="overflow-hidden">
          {linhas.length === 0 ? (
            <div className="p-12 text-center">
              <FileBarChart2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-foreground font-medium">Selecione o período e clique em "Gerar"</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground sticky top-0">
                  <tr>
                    <th className="text-left px-6 py-3 font-medium">Funcionário</th>
                    <th className="text-left px-3 py-3 font-medium">CPF</th>
                    <th className="text-left px-3 py-3 font-medium">Cargo</th>
                    <th className="text-right px-3 py-3 font-medium">Dias</th>
                    <th className="text-right px-3 py-3 font-medium">Horas</th>
                    <th className="text-right px-3 py-3 font-medium">HE</th>
                    <th className="text-right px-3 py-3 font-medium">Noturno</th>
                    <th className="text-right px-3 py-3 font-medium">Faltantes</th>
                    <th className="text-right px-3 py-3 font-medium">F.Just</th>
                    <th className="text-right px-3 py-3 font-medium">F.Injust</th>
                    <th className="text-right px-3 py-3 font-medium">DSR</th>
                    <th className="text-right px-3 py-3 font-medium">Inc.</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {linhas.map((l) => (
                    <tr key={l.employee_id} className="hover:bg-muted/30">
                      <td className="px-6 py-3 font-medium">{l.nome}</td>
                      <td className="px-3 py-3 text-muted-foreground text-xs">{l.cpf ?? "—"}</td>
                      <td className="px-3 py-3 text-muted-foreground text-xs">{l.cargo ?? "—"}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{l.dias_trabalhados}</td>
                      <td className="px-3 py-3 text-right tabular-nums font-semibold">{l.total_horas.toFixed(1)}h</td>
                      <td className="px-3 py-3 text-right tabular-nums">{l.horas_extras.toFixed(1)}h</td>
                      <td className="px-3 py-3 text-right tabular-nums">{l.adicional_noturno_horas.toFixed(1)}h</td>
                      <td className="px-3 py-3 text-right tabular-nums">{l.horas_faltantes.toFixed(1)}h</td>
                      <td className="px-3 py-3 text-right tabular-nums">{l.faltas_justificadas}</td>
                      <td className={`px-3 py-3 text-right tabular-nums ${l.faltas_injustificadas > 0 ? "text-warning font-semibold" : ""}`}>{l.faltas_injustificadas}</td>
                      <td className={`px-3 py-3 text-right tabular-nums ${l.dsr_horas_descontar > 0 ? "text-warning font-semibold" : ""}`}>{l.dsr_horas_descontar.toFixed(1)}h</td>
                      <td className="px-3 py-3 text-right tabular-nums">{l.inconsistencias}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}

function KpiCard({ icon, label, value, tone = "ok" }: { icon: React.ReactNode; label: string; value: string; tone?: "ok" | "warn" }) {
  return (
    <Card className="p-4 flex items-center gap-3">
      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${tone === "warn" ? "bg-warning/15 text-warning" : "bg-primary/10 text-primary"}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground truncate">{label}</div>
        <div className="text-xl font-bold text-foreground tabular-nums">{value}</div>
      </div>
    </Card>
  );
}
