import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Download, FileBarChart2, Users, Clock, AlertTriangle, CalendarX } from "lucide-react";
import { toast } from "sonner";

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

interface Linha {
  employee_id: string;
  nome: string;
  total_horas: number;
  dias_trabalhados: number;
  faltas: number;
  folgas: number;
  feriados: number;
  dias_sem_almoco: number;
  inconsistencias: number;
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

  // Carrega lotes do mês/ano
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

  // Se vier ?lote= na URL, descobre o mês/ano dele e gera automaticamente
  useEffect(() => {
    if (!loteParam || autoRan) return;
    (async () => {
      const { data } = await supabase
        .from("timesheet_batches")
        .select("mes_referencia, ano_referencia")
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
    const body: any = useLote
      ? { batch_id: useLote }
      : { mes: parseInt(mes), ano: parseInt(ano) };
    const { data, error } = await supabase.functions.invoke("monthly-report", { body });
    setLoading(false);
    if (error) {
      console.error(error);
      return toast.error("Erro ao gerar relatório");
    }
    const arr = (data?.linhas ?? []) as Linha[];
    setLinhas(arr);
    if (arr.length === 0) toast.info("Nenhuma marcação encontrada para o filtro selecionado");
  }

  function onChangeLote(v: string) {
    setLoteId(v);
    if (v === "todos") {
      params.delete("lote"); setParams(params, { replace: true });
    } else {
      params.set("lote", v); setParams(params, { replace: true });
    }
  }

  function exportar() {
    if (linhas.length === 0) return;
    const header = "Funcionário;Dias trabalhados;Total horas;Faltas;Folgas;Feriados;Dias sem almoço;Inconsistências";
    const rows = linhas.map((l) => [l.nome, l.dias_trabalhados, l.total_horas.toFixed(2), l.faltas, l.folgas, l.feriados, l.dias_sem_almoco, l.inconsistencias].join(";"));
    const blob = new Blob(["\uFEFF" + [header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `consolidado_${ano}_${mes}${loteId !== "todos" ? "_lote" : ""}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const kpis = useMemo(() => {
    return linhas.reduce(
      (acc, l) => ({
        funcionarios: acc.funcionarios + 1,
        horas: acc.horas + l.total_horas,
        faltas: acc.faltas + l.faltas,
        inconsistencias: acc.inconsistencias + l.inconsistencias,
      }),
      { funcionarios: 0, horas: 0, faltas: 0, inconsistencias: 0 }
    );
  }, [linhas]);

  return (
    <AppLayout>
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Relatórios mensais</h1>
          <p className="text-sm text-muted-foreground mt-1">Consolidado por funcionário: horas, folgas, feriados, faltas e inconsistências</p>
        </div>

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
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Gerar
          </Button>
          <Button variant="outline" onClick={exportar} disabled={linhas.length === 0}>
            <Download className="h-4 w-4 mr-2" />Exportar CSV
          </Button>
        </Card>

        {linhas.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard icon={<Users className="h-5 w-5" />} label="Funcionários" value={String(kpis.funcionarios)} />
            <KpiCard icon={<Clock className="h-5 w-5" />} label="Total de horas" value={`${kpis.horas.toFixed(1)}h`} />
            <KpiCard icon={<CalendarX className="h-5 w-5" />} label="Faltas" value={String(kpis.faltas)} />
            <KpiCard icon={<AlertTriangle className="h-5 w-5" />} label="Inconsistências" value={String(kpis.inconsistencias)} tone={kpis.inconsistencias > 0 ? "warn" : "ok"} />
          </div>
        )}

        <Card className="overflow-hidden">
          {linhas.length === 0 ? (
            <div className="p-12 text-center">
              <FileBarChart2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-foreground font-medium">Selecione o período e clique em "Gerar"</p>
              <p className="text-xs text-muted-foreground mt-1">Você também pode filtrar por um lote específico.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left px-6 py-3 font-medium">Funcionário</th>
                  <th className="text-right px-4 py-3 font-medium">Dias trab.</th>
                  <th className="text-right px-4 py-3 font-medium">Total horas</th>
                  <th className="text-right px-4 py-3 font-medium">Faltas</th>
                  <th className="text-right px-4 py-3 font-medium">Folgas</th>
                  <th className="text-right px-4 py-3 font-medium">Feriados</th>
                  <th className="text-right px-4 py-3 font-medium">Sem almoço</th>
                  <th className="text-right px-4 py-3 font-medium">Inconsist.</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {linhas.map((l) => (
                  <tr key={l.employee_id} className="hover:bg-muted/30">
                    <td className="px-6 py-3 font-medium">{l.nome}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{l.dias_trabalhados}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold">{l.total_horas.toFixed(2)}h</td>
                    <td className="px-4 py-3 text-right tabular-nums">{l.faltas}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{l.folgas}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{l.feriados}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{l.dias_sem_almoco}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{l.inconsistencias}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-xl font-bold text-foreground tabular-nums">{value}</div>
      </div>
    </Card>
  );
}
