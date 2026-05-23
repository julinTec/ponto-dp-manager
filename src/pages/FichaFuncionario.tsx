import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, FileText, Clock, CalendarCheck2, IdCard } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function FichaFuncionario() {
  const { id } = useParams<{ id: string }>();
  const [emp, setEmp] = useState<any>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (id) load(id); }, [id]);

  async function load(empId: string) {
    setLoading(true);
    const [e, d, t, a] = await Promise.all([
      supabase.from("employees").select("*").eq("id", empId).single(),
      supabase.from("employee_documents").select("*").eq("employee_id", empId).order("created_at", { ascending: false }),
      supabase.from("time_entries").select("*").eq("employee_id", empId).order("data", { ascending: false }).limit(60),
      supabase.from("payroll_adjustments").select("*").eq("employee_id", empId).order("data", { ascending: false }).limit(30),
    ]);
    setEmp(e.data);
    setDocs(d.data ?? []);
    setEntries(t.data ?? []);
    setAdjustments(a.data ?? []);
    setLoading(false);
  }

  if (loading) {
    return <AppLayout><div className="p-12 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div></AppLayout>;
  }
  if (!emp) {
    return <AppLayout><div className="p-12 text-center text-muted-foreground">Funcionário não encontrado.</div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <Link to="/funcionarios" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Link>

        <PageHeader
          title={emp.nome}
          subtitle={`${emp.cargo ?? emp.funcao ?? "—"} · ${emp.cpf ?? "Sem CPF"}`}
          actions={
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="capitalize">{emp.status}</Badge>
              <Button asChild variant="outline" size="sm">
                <Link to={`/fechamento?employee=${emp.id}`}><CalendarCheck2 className="h-4 w-4 mr-2" />Fechamento</Link>
              </Button>
            </div>
          }
        />

        <Tabs defaultValue="cadastro">
          <TabsList>
            <TabsTrigger value="cadastro"><IdCard className="h-3.5 w-3.5 mr-1.5" />Cadastro</TabsTrigger>
            <TabsTrigger value="documentos"><FileText className="h-3.5 w-3.5 mr-1.5" />Documentos ({docs.length})</TabsTrigger>
            <TabsTrigger value="ponto"><Clock className="h-3.5 w-3.5 mr-1.5" />Ponto</TabsTrigger>
            <TabsTrigger value="ocorrencias">Ocorrências ({adjustments.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="cadastro">
            <Card className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
              <Field label="Nome" value={emp.nome} />
              <Field label="CPF" value={emp.cpf} />
              <Field label="RG" value={emp.rg} />
              <Field label="Data de nascimento" value={emp.data_nascimento ? format(new Date(emp.data_nascimento), "dd/MM/yyyy") : null} />
              <Field label="E-mail" value={emp.email} />
              <Field label="Telefone" value={emp.telefone} />
              <Field label="Endereço" value={emp.endereco} className="md:col-span-2" />
              <Field label="Cargo" value={emp.cargo} />
              <Field label="Função" value={emp.funcao} />
              <Field label="Admissão" value={emp.admission_date ? format(new Date(emp.admission_date), "dd/MM/yyyy") : null} />
              <Field label="Salário" value={emp.salario != null ? `R$ ${Number(emp.salario).toFixed(2)}` : null} />
              <Field label="Jornada padrão" value={`${emp.jornada_padrao_horas ?? 8}h/dia`} />
              <Field label="Tipo de jornada" value={emp.work_schedule_type} />
            </Card>
          </TabsContent>

          <TabsContent value="documentos">
            <Card className="overflow-hidden">
              {docs.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">Nenhum documento.</div>
              ) : (
                <div className="divide-y">
                  {docs.map((d) => (
                    <div key={d.id} className="flex items-center justify-between px-6 py-3 text-sm">
                      <div className="min-w-0 flex items-center gap-3">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium truncate">{d.original_name ?? d.document_type}</p>
                          <p className="text-xs text-muted-foreground capitalize">{d.document_type}{d.document_date && ` · ${format(new Date(d.document_date), "dd/MM/yyyy")}`}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="capitalize">{d.status?.replace("_", " ")}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="ponto">
            <Card className="overflow-hidden">
              {entries.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">Sem marcações registradas.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="text-left px-6 py-3 font-medium">Data</th>
                      <th className="text-left px-3 py-3 font-medium">Entrada</th>
                      <th className="text-left px-3 py-3 font-medium">Saída</th>
                      <th className="text-right px-3 py-3 font-medium">Trabalhadas</th>
                      <th className="text-right px-3 py-3 font-medium">Extras</th>
                      <th className="text-right px-3 py-3 font-medium">Faltantes</th>
                      <th className="text-left px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {entries.map((e) => (
                      <tr key={e.id} className="hover:bg-muted/30">
                        <td className="px-6 py-2.5">{e.data ? format(new Date(e.data + "T00:00:00"), "dd/MM (EEE)", { locale: ptBR }) : "—"}</td>
                        <td className="px-3 py-2.5 tabular-nums">{e.entrada ?? "—"}</td>
                        <td className="px-3 py-2.5 tabular-nums">{e.saida_final ?? "—"}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{Number(e.worked_hours ?? 0).toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{Number(e.overtime_hours ?? 0).toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{Number(e.missing_hours ?? 0).toFixed(2)}</td>
                        <td className="px-4 py-2.5"><Badge variant="outline" className="capitalize">{e.status}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="ocorrencias">
            <Card className="overflow-hidden">
              {adjustments.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">Sem ocorrências.</div>
              ) : (
                <div className="divide-y">
                  {adjustments.map((a) => (
                    <div key={a.id} className="px-6 py-3 text-sm flex items-center justify-between">
                      <div>
                        <p className="font-medium capitalize">{String(a.tipo).replace("_", " ")}</p>
                        <p className="text-xs text-muted-foreground">{a.data ? format(new Date(a.data), "dd/MM/yyyy") : ""} {a.notes ? ` · ${a.notes}` : ""}</p>
                      </div>
                      <span className="tabular-nums text-muted-foreground">
                        {Number(a.valor_horas ?? 0).toFixed(2)}h
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function Field({ label, value, className }: { label: string; value: any; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{label}</p>
      <p className="mt-0.5 text-foreground">{value || <span className="text-muted-foreground">—</span>}</p>
    </div>
  );
}
