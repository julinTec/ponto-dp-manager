import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, FileText, Clock, CalendarCheck2, IdCard, Mail, Phone, MapPin, Briefcase, Calendar, Building2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

function initials(name?: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

const STATUS_TONE: Record<string, string> = {
  ativo: "bg-success/10 text-success border-success/20",
  pendente_validacao: "bg-warning/10 text-warning border-warning/20",
  inativo: "bg-muted text-muted-foreground border-border",
};

export default function FichaFuncionario() {
  const { id } = useParams<{ id: string }>();
  const [emp, setEmp] = useState<any>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [occurrences, setOccurrences] = useState<any[]>([]);
  const [closures, setClosures] = useState<any[]>([]);
  const [admissions, setAdmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (id) load(id); }, [id]);

  async function load(empId: string) {
    setLoading(true);
    const [e, d, t, a, o, c, ad] = await Promise.all([
      supabase.from("employees").select("*").eq("id", empId).single(),
      supabase.from("employee_documents").select("*").eq("employee_id", empId).order("created_at", { ascending: false }),
      supabase.from("time_entries").select("*").eq("employee_id", empId).order("data", { ascending: false }).limit(60),
      supabase.from("payroll_adjustments").select("*").eq("employee_id", empId).order("data", { ascending: false }).limit(30),
      supabase.from("employee_occurrences").select("*").eq("employee_id", empId).order("data", { ascending: false }).limit(50),
      supabase.from("monthly_closures").select("*").eq("employee_id", empId).order("ano", { ascending: false }).order("mes", { ascending: false }).limit(24),
      supabase.from("employee_admissions").select("*").eq("employee_id", empId).order("created_at", { ascending: false }),
    ]);
    setEmp(e.data);
    setDocs(d.data ?? []);
    setEntries(t.data ?? []);
    setAdjustments(a.data ?? []);
    setOccurrences(o.data ?? []);
    setClosures(c.data ?? []);
    setAdmissions(ad.data ?? []);
    setLoading(false);
  }

  if (loading) {
    return <AppLayout><div className="p-16 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div></AppLayout>;
  }
  if (!emp) {
    return <AppLayout><div className="p-16 text-center text-muted-foreground">Funcionário não encontrado.</div></AppLayout>;
  }

  const docsPendentes = docs.filter((d) => d.status === "pendente_revisao").length;
  const adverts = adjustments.filter((a) => /adverten|suspens/i.test(a.tipo ?? "")).length;
  const atestados = adjustments.filter((a) => /atestado/i.test(a.tipo ?? "")).length;

  return (
    <AppLayout>
      <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-6">
        <Link to="/funcionarios" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground -mb-1">
          <ArrowLeft className="h-4 w-4 mr-1" /> Funcionários
        </Link>

        {/* CRM header */}
        <section className="surface-card overflow-hidden">
          <div className="h-24 bg-gradient-hero" />
          <div className="px-6 pb-6 -mt-12">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4">
              <div className="h-24 w-24 rounded-2xl bg-gradient-primary text-primary-foreground border-4 border-card shadow-premium flex items-center justify-center text-2xl font-bold shrink-0">
                {initials(emp.nome)}
              </div>
              <div className="flex-1 min-w-0 sm:pb-1">
                <h1 className="text-2xl sm:text-[28px] font-bold text-foreground tracking-tight leading-tight">{emp.nome}</h1>
                <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                  <Briefcase className="h-3.5 w-3.5" />
                  {emp.cargo ?? emp.funcao ?? "Sem cargo"}
                  {emp.cpf && <span className="text-muted-foreground/60">· CPF {emp.cpf}</span>}
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className={cn("chip", STATUS_TONE[emp.status] ?? STATUS_TONE.inativo)}>
                    <span className="h-1.5 w-1.5 rounded-full bg-current" /> {String(emp.status).replace("_", " ")}
                  </span>
                  {docsPendentes > 0 && (
                    <span className="chip bg-warning/10 text-warning border-warning/20">
                      <AlertTriangle className="h-3 w-3" /> {docsPendentes} doc(s) pendente(s)
                    </span>
                  )}
                  {atestados > 0 && (
                    <span className="chip bg-info/10 text-info border-info/20">{atestados} atestado(s)</span>
                  )}
                  {adverts > 0 && (
                    <span className="chip bg-destructive/10 text-destructive border-destructive/20">
                      <AlertTriangle className="h-3 w-3" /> {adverts} ocorrência(s) disciplinar(es)
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 sm:pb-1">
                <Button asChild variant="outline" size="sm">
                  <Link to={`/fechamento?employee=${emp.id}`}><CalendarCheck2 className="h-4 w-4 mr-2" />Fechamento</Link>
                </Button>
              </div>
            </div>

            {/* Quick facts */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
              <QuickFact icon={Mail} label="E-mail" value={emp.email} />
              <QuickFact icon={Phone} label="Telefone" value={emp.telefone} />
              <QuickFact icon={Calendar} label="Admissão" value={emp.admission_date ? format(new Date(emp.admission_date), "dd/MM/yyyy") : null} />
              <QuickFact icon={Clock} label="Jornada" value={`${emp.jornada_padrao_horas ?? 8}h/dia`} />
            </div>
          </div>
        </section>

        <Tabs defaultValue="cadastro">
          <TabsList className="bg-muted/60 p-1 rounded-xl flex-wrap h-auto">
            <TabsTrigger value="cadastro" className="rounded-lg"><IdCard className="h-3.5 w-3.5 mr-1.5" />Cadastro</TabsTrigger>
            <TabsTrigger value="documentos" className="rounded-lg"><FileText className="h-3.5 w-3.5 mr-1.5" />Documentos ({docs.length})</TabsTrigger>
            <TabsTrigger value="ponto" className="rounded-lg"><Clock className="h-3.5 w-3.5 mr-1.5" />Ponto</TabsTrigger>
            <TabsTrigger value="ocorrencias" className="rounded-lg">Ocorrências ({occurrences.length + adjustments.length})</TabsTrigger>
            <TabsTrigger value="fechamentos" className="rounded-lg"><CalendarCheck2 className="h-3.5 w-3.5 mr-1.5" />Fechamentos ({closures.length})</TabsTrigger>
            <TabsTrigger value="admissoes" className="rounded-lg"><Building2 className="h-3.5 w-3.5 mr-1.5" />Admissões ({admissions.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="cadastro" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <SectionCard title="Dados pessoais" className="lg:col-span-2">
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                  <Field label="Nome" value={emp.nome} />
                  <Field label="CPF" value={emp.cpf} />
                  <Field label="RG" value={emp.rg} />
                  <Field label="Data de nascimento" value={emp.data_nascimento ? format(new Date(emp.data_nascimento), "dd/MM/yyyy") : null} />
                  <Field label="E-mail" value={emp.email} />
                  <Field label="Telefone" value={emp.telefone} />
                  <Field label="Endereço" value={emp.endereco} className="md:col-span-2" />
                </div>
              </SectionCard>
              <SectionCard title="Contrato">
                <div className="p-6 space-y-4 text-sm">
                  <Field label="Cargo" value={emp.cargo} />
                  <Field label="Função" value={emp.funcao} />
                  <Field label="Admissão" value={emp.admission_date ? format(new Date(emp.admission_date), "dd/MM/yyyy") : null} />
                  <Field label="Salário" value={emp.salario != null ? `R$ ${Number(emp.salario).toFixed(2)}` : null} />
                  <Field label="Jornada padrão" value={`${emp.jornada_padrao_horas ?? 8}h/dia`} />
                  <Field label="Tipo de jornada" value={emp.work_schedule_type} />
                </div>
              </SectionCard>
            </div>
          </TabsContent>

          <TabsContent value="documentos" className="mt-4">
            <SectionCard title="Documentos do funcionário" description={`${docs.length} registros`}>
              {docs.length === 0 ? (
                <EmptyState icon={FileText} title="Nenhum documento" description="Os documentos enviados aparecerão aqui." />
              ) : (
                <div className="divide-y divide-border/70">
                  {docs.map((d) => (
                    <div key={d.id} className="flex items-center justify-between px-6 py-3.5 text-sm hover:bg-muted/30">
                      <div className="min-w-0 flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate text-foreground">{d.original_name ?? d.document_type}</p>
                          <p className="text-xs text-muted-foreground capitalize">{d.document_type}{d.document_date && ` · ${format(new Date(d.document_date), "dd/MM/yyyy")}`}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {d.needs_review && (
                          <span className="chip bg-warning/10 text-warning border-warning/20">
                            <AlertTriangle className="h-3 w-3" /> Revisar
                          </span>
                        )}
                        {d.confianca != null && (
                          <span className="chip bg-muted text-muted-foreground border-border tabular-nums">
                            {Math.round(Number(d.confianca) * 100)}%
                          </span>
                        )}
                        <span className={cn("chip capitalize", d.status === "pendente_revisao" ? "bg-warning/10 text-warning border-warning/20" : "bg-muted text-muted-foreground border-border")}>
                          {String(d.status ?? "").replace("_", " ")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </TabsContent>

          <TabsContent value="ponto" className="mt-4">
            <SectionCard title="Histórico de ponto" description="Últimos 60 dias">
              {entries.length === 0 ? (
                <EmptyState icon={Clock} title="Sem marcações registradas" />
              ) : (
                <div className="overflow-x-auto">
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
                    <tbody className="divide-y divide-border/70">
                      {entries.map((e) => (
                        <tr key={e.id} className="hover:bg-muted/30">
                          <td className="px-6 py-2.5">{e.data ? format(new Date(e.data + "T00:00:00"), "dd/MM (EEE)", { locale: ptBR }) : "—"}</td>
                          <td className="px-3 py-2.5 tabular-nums">{e.entrada ?? "—"}</td>
                          <td className="px-3 py-2.5 tabular-nums">{e.saida_final ?? "—"}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{Number(e.worked_hours ?? 0).toFixed(2)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{Number(e.overtime_hours ?? 0).toFixed(2)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{Number(e.missing_hours ?? 0).toFixed(2)}</td>
                          <td className="px-4 py-2.5"><span className="chip bg-muted text-muted-foreground border-border capitalize">{e.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          </TabsContent>

          <TabsContent value="ocorrencias" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SectionCard title="Ocorrências" description={`${occurrences.length} registros`}>
                {occurrences.length === 0 ? (
                  <EmptyState icon={AlertTriangle} title="Sem ocorrências" />
                ) : (
                  <div className="divide-y divide-border/70">
                    {occurrences.map((o) => (
                      <div key={o.id} className="px-6 py-3.5 text-sm hover:bg-muted/30">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-foreground">{o.titulo}</p>
                          <span className="chip bg-muted text-muted-foreground border-border capitalize">{String(o.tipo).replace("_", " ")}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{o.data ? format(new Date(o.data), "dd/MM/yyyy") : ""}{o.descricao ? ` · ${o.descricao}` : ""}</p>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
              <SectionCard title="Ajustes de folha">
                {adjustments.length === 0 ? (
                  <EmptyState icon={CalendarCheck2} title="Sem ajustes" />
                ) : (
                  <div className="divide-y divide-border/70">
                    {adjustments.map((a) => (
                      <div key={a.id} className="px-6 py-3.5 text-sm flex items-center justify-between hover:bg-muted/30">
                        <div className="min-w-0">
                          <p className="font-medium capitalize text-foreground">{String(a.tipo).replace("_", " ")}</p>
                          <p className="text-xs text-muted-foreground">{a.data ? format(new Date(a.data), "dd/MM/yyyy") : ""}{a.notes ? ` · ${a.notes}` : ""}</p>
                        </div>
                        <span className="tabular-nums text-sm font-medium text-foreground">{Number(a.valor_horas ?? 0).toFixed(2)}h</span>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </div>
          </TabsContent>

          <TabsContent value="fechamentos" className="mt-4">
            <SectionCard title="Fechamentos mensais" description={`${closures.length} períodos`}>
              {closures.length === 0 ? (
                <EmptyState icon={CalendarCheck2} title="Sem fechamentos" description="Os fechamentos mensais aparecerão aqui." />
              ) : (
                <div className="divide-y divide-border/70">
                  {closures.map((c) => {
                    const totais = (c.totais ?? {}) as any;
                    return (
                      <div key={c.id} className="px-6 py-3.5 text-sm hover:bg-muted/30 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-medium text-foreground">{String(c.mes).padStart(2, "0")}/{c.ano}</p>
                          <p className="text-xs text-muted-foreground">
                            {totais.worked_hours != null && `${Number(totais.worked_hours).toFixed(1)}h trabalhadas`}
                            {totais.overtime_hours != null && ` · ${Number(totais.overtime_hours).toFixed(1)}h extras`}
                            {totais.missing_hours != null && ` · ${Number(totais.missing_hours).toFixed(1)}h faltantes`}
                          </p>
                          {c.observacoes && <p className="text-xs text-muted-foreground mt-1 italic">{c.observacoes}</p>}
                        </div>
                        <span className={cn("chip capitalize", c.status === "fechado" ? "bg-success/10 text-success border-success/20" : "bg-warning/10 text-warning border-warning/20")}>
                          {c.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          </TabsContent>

          <TabsContent value="admissoes" className="mt-4">
            <SectionCard title="Processos de admissão" description={`${admissions.length} registros`}>
              {admissions.length === 0 ? (
                <EmptyState icon={Building2} title="Sem processos de admissão" />
              ) : (
                <div className="divide-y divide-border/70">
                  {admissions.map((a) => (
                    <Link to={`/admissoes/${a.id}`} key={a.id} className="px-6 py-3.5 text-sm flex items-center justify-between hover:bg-muted/30 block">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">Admissão · {format(new Date(a.created_at), "dd/MM/yyyy", { locale: ptBR })}</p>
                        {a.notes && <p className="text-xs text-muted-foreground mt-1">{a.notes}</p>}
                      </div>
                      <span className={cn("chip capitalize", a.status === "aprovada" ? "bg-success/10 text-success border-success/20" : a.status === "rejeitada" ? "bg-destructive/10 text-destructive border-destructive/20" : "bg-warning/10 text-warning border-warning/20")}>
                        {String(a.status).replace("_", " ")}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </SectionCard>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function QuickFact({ icon: Icon, label, value }: { icon: any; label: string; value: any }) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/30 p-3 flex items-start gap-3">
      <div className="h-9 w-9 rounded-lg bg-card border border-border/70 flex items-center justify-center text-muted-foreground shrink-0">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</p>
        <p className="text-sm text-foreground mt-0.5 truncate">{value || <span className="text-muted-foreground">—</span>}</p>
      </div>
    </div>
  );
}

function Field({ label, value, className }: { label: string; value: any; className?: string }) {
  return (
    <div className={className}>
      <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground font-semibold">{label}</p>
      <p className="mt-1 text-foreground">{value || <span className="text-muted-foreground">—</span>}</p>
    </div>
  );
}
