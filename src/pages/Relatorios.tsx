import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Download, FileBarChart2 } from "lucide-react";
import { toast } from "sonner";

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

interface Linha {
  employee_id: string;
  nome: string;
  total_horas: number;
  faltas: number;
  folgas: number;
  feriados: number;
  dias_sem_almoco: number;
  inconsistencias: number;
}

export default function Relatorios() {
  const [mes, setMes] = useState(String(new Date().getMonth() + 1));
  const [ano, setAno] = useState(String(new Date().getFullYear()));
  const [loading, setLoading] = useState(false);
  const [linhas, setLinhas] = useState<Linha[]>([]);

  async function gerar() {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("monthly-report", {
      body: { mes: parseInt(mes), ano: parseInt(ano) },
    });
    setLoading(false);
    if (error) return toast.error("Erro ao gerar relatório");
    setLinhas((data?.linhas ?? []) as Linha[]);
  }

  function exportar() {
    if (linhas.length === 0) return;
    const header = "Funcionário;Total horas;Faltas;Folgas;Feriados;Dias sem almoço;Inconsistências";
    const rows = linhas.map((l) => [l.nome, l.total_horas.toFixed(2), l.faltas, l.folgas, l.feriados, l.dias_sem_almoco, l.inconsistencias].join(";"));
    const blob = new Blob(["\uFEFF" + [header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `relatorio_${ano}_${mes}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppLayout>
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Relatórios mensais</h1>
          <p className="text-sm text-muted-foreground mt-1">Total de horas, folgas, feriados, faltas e inconsistências</p>
        </div>

        <Card className="p-4 flex flex-col sm:flex-row gap-3 items-end">
          <div className="space-y-2 flex-1">
            <Label>Mês</Label>
            <Select value={mes} onValueChange={setMes}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{MESES.map((m, i) => <SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2 w-32">
            <Label>Ano</Label>
            <Input type="number" value={ano} onChange={(e) => setAno(e.target.value)} />
          </div>
          <Button onClick={gerar} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Gerar
          </Button>
          <Button variant="outline" onClick={exportar} disabled={linhas.length === 0}>
            <Download className="h-4 w-4 mr-2" />Exportar CSV
          </Button>
        </Card>

        <Card className="overflow-hidden">
          {linhas.length === 0 ? (
            <div className="p-12 text-center">
              <FileBarChart2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-foreground font-medium">Selecione o período e clique em "Gerar"</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left px-6 py-3 font-medium">Funcionário</th>
                  <th className="text-right px-4 py-3 font-medium">Total horas</th>
                  <th className="text-right px-4 py-3 font-medium">Faltas</th>
                  <th className="text-right px-4 py-3 font-medium">Folgas</th>
                  <th className="text-right px-4 py-3 font-medium">Feriados</th>
                  <th className="text-right px-4 py-3 font-medium">Sem almoço</th>
                  <th className="text-right px-4 py-3 font-medium">Inconsistências</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {linhas.map((l) => (
                  <tr key={l.employee_id} className="hover:bg-muted/30">
                    <td className="px-6 py-3 font-medium">{l.nome}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{l.total_horas.toFixed(2)}h</td>
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
