import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { listarPontosEmpresa } from "@/services/punch";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Download, FileUp } from "lucide-react";

const LABEL: Record<string, string> = {
  entrada: "Entrada",
  saida_intervalo: "Saída intervalo",
  retorno_intervalo: "Retorno intervalo",
  saida_final: "Saída final",
};

export default function RelatoriosPonto() {
  const { profile } = useAuth();
  const today = new Date();
  const [from, setFrom] = useState(new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));
  const [employeeId, setEmployeeId] = useState<string>("all");
  const [employees, setEmployees] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!profile?.company_id) return;
    supabase
      .from("employees")
      .select("id, nome")
      .eq("company_id", profile.company_id)
      .order("nome")
      .then(({ data }) => setEmployees(data ?? []));
  }, [profile?.company_id]);

  async function load() {
    if (!profile?.company_id) return;
    setLoading(true);
    try {
      const data = await listarPontosEmpresa(
        profile.company_id,
        new Date(from + "T00:00:00"),
        new Date(to + "T23:59:59"),
        employeeId === "all" ? undefined : employeeId
      );
      setRows(data ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [profile?.company_id]);

  function exportCsv() {
    const header = ["Data/Hora", "Funcionário", "Tipo", "Distância (m)", "Dentro do raio", "Origem", "Latitude", "Longitude"];
    const lines = rows.map((r) => [
      new Date(r.registrado_em).toLocaleString("pt-BR"),
      r.employees?.nome ?? "",
      LABEL[r.tipo] ?? r.tipo,
      r.distancia_metros != null ? Math.round(r.distancia_metros) : "",
      r.dentro_do_raio ? "Sim" : "Não",
      r.origem,
      r.latitude ?? "",
      r.longitude ?? "",
    ]);
    const csv = [header, ...lines].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pontos_${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppLayout>
      <PageHeader 
        title="Relatórios de ponto" 
        subtitle="Registros de batida de ponto por geolocalização" 
        actions={
          <Button asChild className="bg-gradient-primary shadow-sm">
            <Link to="/lotes">
              <FileUp className="h-4 w-4 mr-2" />
              Subir Folhas de Ponto
            </Link>
          </Button>
        }
      />
      <div className="p-6 space-y-4">
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <div>
              <Label className="text-xs">De</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Até</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Funcionário</Label>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={load} disabled={loading} className="flex-1">
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Buscar
              </Button>
              <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr className="text-left">
                  <th className="p-2">Data/Hora</th>
                  <th className="p-2">Funcionário</th>
                  <th className="p-2">Tipo</th>
                  <th className="p-2">Distância</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Origem</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Nenhum registro</td></tr>
                ) : rows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-2">{new Date(r.registrado_em).toLocaleString("pt-BR")}</td>
                    <td className="p-2">{r.employees?.nome ?? "—"}</td>
                    <td className="p-2">{LABEL[r.tipo] ?? r.tipo}</td>
                    <td className="p-2">{r.distancia_metros != null ? `${Math.round(r.distancia_metros)} m` : "—"}</td>
                    <td className="p-2">
                      <Badge variant={r.dentro_do_raio ? "default" : "destructive"}>
                        {r.dentro_do_raio ? "Dentro" : "Fora"}
                      </Badge>
                    </td>
                    <td className="p-2 text-muted-foreground">{r.origem}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
