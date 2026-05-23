import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { StatusBadge, BatchStatus } from "@/components/StatusBadge";
import { MetricCard } from "@/components/ui-kit/MetricCard";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { Timeline, TimelineItem } from "@/components/ui-kit/Timeline";
import {
  FileStack, Clock, Plus, Loader2,
  Users, FileText, CalendarX, TrendingUp, AlertTriangle, UserPlus, Sparkles, Activity,
} from "lucide-react";
import { CompanyFilter } from "@/components/CompanyFilter";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Batch {
  id: string;
  nome: string;
  status: BatchStatus;
  total_paginas: number;
  total_marcacoes: number;
  created_at: string;
}

export default function Dashboard() {
  const { profile, isSuperAdmin } = useAuth();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [funcionariosCount, setFuncionariosCount] = useState(0);
  const [docsPendentes, setDocsPendentes] = useState(0);
  const [admissoesAbertas, setAdmissoesAbertas] = useState(0);
  const [stats, setStats] = useState({
    faltas_just: 0, faltas_injust: 0, he: 0, dsr: 0, inconsistencias: 0,
  });
  const [loading, setLoading] = useState(true);
  const [companyFilter, setCompanyFilter] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.company_id && !isSuperAdmin) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.company_id, isSuperAdmin, companyFilter]);

  async function load() {
    setLoading(true);
    const hoje = new Date();
    const mes = hoje.getMonth() + 1;
    const ano = hoje.getFullYear();
    const inicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
    const fim = mes === 12 ? `${ano + 1}-01-01` : `${ano}-${String(mes + 1).padStart(2, "0")}-01`;

    const filterCompany = <T extends { eq: (col: string, val: any) => T }>(q: T) =>
      companyFilter ? q.eq("company_id", companyFilter) : q;

    let batchIdsForEntries: string[] | null = null;
    if (companyFilter) {
      const { data: bs } = await supabase
        .from("timesheet_batches").select("id").eq("company_id", companyFilter);
      batchIdsForEntries = (bs ?? []).map((b: any) => b.id);
    }

    let entriesQ = supabase
      .from("time_entries")
      .select("status, is_absence, is_justified, has_medical_certificate, overtime_hours")
      .gte("data", inicio).lt("data", fim);
    if (batchIdsForEntries) {
      if (batchIdsForEntries.length === 0) {
        entriesQ = entriesQ.eq("batch_id", "00000000-0000-0000-0000-000000000000");
      } else {
        entriesQ = entriesQ.in("batch_id", batchIdsForEntries);
      }
    }

    const [
      { data: batchesData },
      { count: empCount },
      { count: docsCount },
      { count: admCount },
      { data: entries },
      { data: adjustments },
    ] = await Promise.all([
      filterCompany(supabase.from("timesheet_batches").select("id, nome, status, total_paginas, total_marcacoes, created_at").order("created_at", { ascending: false }).limit(8) as any),
      filterCompany(supabase.from("employees").select("id", { count: "exact", head: true }).eq("status", "ativo") as any),
      filterCompany(supabase.from("employee_documents").select("id", { count: "exact", head: true }).eq("status", "pendente_revisao") as any),
      filterCompany(supabase.from("employee_admissions").select("id", { count: "exact", head: true }).neq("status", "aprovado") as any),
      entriesQ,
      filterCompany(supabase.from("payroll_adjustments").select("tipo, valor_horas").eq("tipo", "dsr_desconto").gte("data", inicio).lt("data", fim) as any),
    ]);

    setBatches((batchesData ?? []) as Batch[]);
    setFuncionariosCount(empCount ?? 0);
    setDocsPendentes(docsCount ?? 0);
    setAdmissoesAbertas(admCount ?? 0);

    let fj = 0, fi = 0, he = 0, inc = 0;
    for (const e of entries ?? []) {
      he += Number(e.overtime_hours ?? 0);
      if (e.status === "inconsistente") inc++;
      if (e.status === "falta" || e.is_absence) {
        if (e.is_justified || e.has_medical_certificate) fj++;
        else fi++;
      }
    }
    const dsr = (adjustments ?? []).reduce((s: number, r: any) => s + Number(r.valor_horas ?? 0), 0);
    setStats({ faltas_just: fj, faltas_injust: fi, he, dsr, inconsistencias: inc });

    setLoading(false);
  }

  const mesLabel = format(new Date(), "MMMM 'de' yyyy", { locale: ptBR });

  const timelineItems: TimelineItem[] = batches.slice(0, 5).map((b) => ({
    id: b.id,
    title: b.nome,
    description: `${b.total_paginas} págs · ${b.total_marcacoes} marcações`,
    time: format(new Date(b.created_at), "dd 'de' MMM, HH:mm", { locale: ptBR }),
    tone: b.status === "revisado" || b.status === "exportado" ? "premium" : b.status === "aguardando_revisao" ? "warning" : "primary",
  }));

  return (
    <AppLayout>
      <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-8">
        {/* Hero header */}
        <section className="relative overflow-hidden rounded-2xl bg-gradient-hero text-primary-foreground p-6 sm:p-8 shadow-premium">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary-glow/30 blur-3xl" />
          <div className="absolute -left-10 -bottom-16 h-44 w-44 rounded-full bg-premium/20 blur-3xl" />
          <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 chip bg-white/10 border-white/15 text-white/90 mb-3">
                <Sparkles className="h-3 w-3" /> Painel executivo · {mesLabel}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Bem-vindo{profile?.nome ? `, ${profile.nome.split(" ")[0]}` : ""}
              </h1>
              <p className="text-sm text-white/70 mt-2 max-w-xl">
                Visão consolidada de pessoas, ponto e fechamento. Acompanhe pendências e tome decisões em segundos.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="bg-white/10 border border-white/15 rounded-xl">
                <CompanyFilter value={companyFilter} onChange={setCompanyFilter} />
              </div>
              <Button asChild className="bg-white text-foreground hover:bg-white/90 shadow-sm">
                <Link to="/admissoes"><Plus className="h-4 w-4 mr-2" />Nova admissão</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Metrics */}
        <section>
          <div className="flex items-end justify-between mb-3">
            <h2 className="section-title">Indicadores do mês</h2>
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard label="Funcionários ativos" value={funcionariosCount} icon={Users} tone="primary" to="/funcionarios" />
            <MetricCard label="Admissões em andamento" value={admissoesAbertas} icon={UserPlus} tone="info" to="/admissoes" />
            <MetricCard label="Documentos pendentes" value={docsPendentes} icon={FileText} tone="warning" to="/documentos" />
            <MetricCard label="Atestados/Faltas just." value={stats.faltas_just} icon={CalendarX} tone="muted" to="/aprovacoes" />
            <MetricCard label="Faltas injustificadas" value={stats.faltas_injust} icon={CalendarX} tone={stats.faltas_injust > 0 ? "destructive" : "muted"} />
            <MetricCard label="Horas extras" value={`${stats.he.toFixed(1)}h`} icon={TrendingUp} tone="premium" />
            <MetricCard label="DSR a descontar" value={`${stats.dsr.toFixed(1)}h`} icon={Activity} tone={stats.dsr > 0 ? "warning" : "muted"} />
            <MetricCard label="Inconsistências" value={stats.inconsistencias} icon={AlertTriangle} tone={stats.inconsistencias > 0 ? "warning" : "muted"} to="/relatorios" />
          </div>
        </section>

        {/* Lower grid */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SectionCard
            className="lg:col-span-2"
            title="Processamentos recentes"
            description="Lotes de folhas de ponto importadas"
            actions={
              <Button asChild variant="ghost" size="sm" className="text-primary hover:text-primary">
                <Link to="/lotes">Ver todos</Link>
              </Button>
            }
          >
            {loading ? (
              <div className="p-12 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
            ) : batches.length === 0 ? (
              <EmptyState
                icon={FileStack}
                title="Nenhum lote processado ainda"
                description="As folhas de ponto importadas aparecerão aqui assim que forem enviadas."
              />
            ) : (
              <div className="divide-y divide-border/70">
                {batches.slice(0, 5).map((b) => (
                  <Link
                    key={b.id}
                    to={`/lotes/${b.id}/revisao`}
                    className="flex items-center justify-between px-6 py-3.5 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Clock className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{b.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(b.created_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                          {" · "}{b.total_paginas} pág · {b.total_marcacoes} marcações
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={b.status} />
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Atividades recentes" description="Últimos eventos do sistema">
            <div className="p-6">
              {timelineItems.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sem atividade recente.</p>
              ) : (
                <Timeline items={timelineItems} />
              )}
            </div>
          </SectionCard>
        </section>
      </div>
    </AppLayout>
  );
}
