import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, BatchStatus } from "@/components/StatusBadge";
import {
  FileStack, Clock, CheckCircle2, AlertCircle, Plus, Loader2, FileUp,
  Users, FileText, CalendarX, TrendingUp, AlertTriangle,
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
  const [counts, setCounts] = useState<Record<BatchStatus, number>>({
    enviado: 0, processando: 0, aguardando_revisao: 0, revisado: 0, exportado: 0,
  });
  const [funcionariosCount, setFuncionariosCount] = useState(0);
  const [docsPendentes, setDocsPendentes] = useState(0);
  const [stats, setStats] = useState({
    faltas_just: 0, faltas_injust: 0, he: 0, dsr: 0, inconsistencias: 0,
  });
  const [loading, setLoading] = useState(true);
  const [companyFilter, setCompanyFilter] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.company_id && !isSuperAdmin) return;
    load();
  }, [profile?.company_id, isSuperAdmin, companyFilter]);

  async function load() {
    setLoading(true);

    // Período: mês corrente
    const hoje = new Date();
    const mes = hoje.getMonth() + 1;
    const ano = hoje.getFullYear();
    const inicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
    const fim = mes === 12 ? `${ano + 1}-01-01` : `${ano}-${String(mes + 1).padStart(2, "0")}-01`;

    const filterCompany = <T extends { eq: (col: string, val: any) => T }>(q: T) =>
      companyFilter ? q.eq("company_id", companyFilter) : q;

    // batch_ids do filtro de empresa (para filtrar time_entries via batch)
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
      { data: allStatus },
      { count: empCount },
      { count: docsCount },
      { data: entries },
      { data: adjustments },
    ] = await Promise.all([
      filterCompany(supabase.from("timesheet_batches").select("id, nome, status, total_paginas, total_marcacoes, created_at").order("created_at", { ascending: false }).limit(8) as any),
      filterCompany(supabase.from("timesheet_batches").select("status") as any),
      filterCompany(supabase.from("employees").select("id", { count: "exact", head: true }).eq("status", "ativo") as any),
      filterCompany(supabase.from("employee_documents").select("id", { count: "exact", head: true }).eq("status", "pendente_revisao") as any),
      entriesQ,
      filterCompany(supabase.from("payroll_adjustments").select("tipo, valor_horas").eq("tipo", "dsr_desconto").gte("data", inicio).lt("data", fim) as any),
    ]);

    setBatches((batchesData ?? []) as Batch[]);

    const c: any = { enviado: 0, processando: 0, aguardando_revisao: 0, revisado: 0, exportado: 0 };
    (allStatus ?? []).forEach((b: any) => { c[b.status] = (c[b.status] ?? 0) + 1; });
    setCounts(c);

    setFuncionariosCount(empCount ?? 0);
    setDocsPendentes(docsCount ?? 0);

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

  const cardsLote = [
    { label: "Aguardando revisão", value: counts.aguardando_revisao, icon: AlertCircle, color: "text-warning" },
    { label: "Processando", value: counts.processando, icon: Loader2, color: "text-info" },
    { label: "Revisados", value: counts.revisado, icon: CheckCircle2, color: "text-success" },
    { label: "Total de lotes", value: Object.values(counts).reduce((a, b) => a + b, 0), icon: FileStack, color: "text-primary" },
  ];
  const cardsDP = [
    { label: "Funcionários ativos", value: funcionariosCount, icon: Users, color: "text-primary", to: "/funcionarios" },
    { label: "Documentos pendentes", value: docsPendentes, icon: FileText, color: "text-warning", to: "/documentos" },
    { label: "Faltas justificadas (mês)", value: stats.faltas_just, icon: CalendarX, color: "text-muted-foreground" },
    { label: "Faltas injustificadas (mês)", value: stats.faltas_injust, icon: CalendarX, color: stats.faltas_injust > 0 ? "text-destructive" : "text-muted-foreground" },
    { label: "Horas extras (mês)", value: `${stats.he.toFixed(1)}h`, icon: TrendingUp, color: "text-success" },
    { label: "DSR a descontar (mês)", value: `${stats.dsr.toFixed(1)}h`, icon: TrendingUp, color: stats.dsr > 0 ? "text-warning" : "text-muted-foreground" },
    { label: "Inconsistências (mês)", value: stats.inconsistencias, icon: AlertTriangle, color: stats.inconsistencias > 0 ? "text-warning" : "text-muted-foreground" },
  ];

  return (
    <AppLayout>
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">Visão geral do Departamento Pessoal — mês de referência</p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to="/lotes/novo?modo=single"><FileUp className="h-4 w-4 mr-2" />Folha única</Link>
            </Button>
            <Button asChild>
              <Link to="/lotes/novo?modo=lote"><Plus className="h-4 w-4 mr-2" />Novo lote</Link>
            </Button>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">Lotes</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {cardsLote.map((c) => {
              const Icon = c.icon;
              return (
                <Card key={c.label} className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{c.label}</p>
                      <p className="text-3xl font-bold text-foreground mt-2">{c.value}</p>
                    </div>
                    <div className={`h-10 w-10 rounded-lg bg-muted flex items-center justify-center ${c.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">Departamento Pessoal</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {cardsDP.map((c) => {
              const Icon = c.icon;
              const inner = (
                <Card className="p-5 h-full hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{c.label}</p>
                      <p className="text-2xl font-bold text-foreground mt-2 tabular-nums">{c.value}</p>
                    </div>
                    <div className={`h-10 w-10 rounded-lg bg-muted flex items-center justify-center ${c.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                </Card>
              );
              return c.to ? <Link key={c.label} to={c.to}>{inner}</Link> : <div key={c.label}>{inner}</div>;
            })}
          </div>
        </div>

        <Card className="overflow-hidden">
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Lotes recentes</h2>
            <Button asChild variant="ghost" size="sm"><Link to="/lotes">Ver todos</Link></Button>
          </div>
          {loading ? (
            <div className="p-12 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
          ) : batches.length === 0 ? (
            <div className="p-12 text-center">
              <FileStack className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-foreground font-medium">Nenhum lote ainda</p>
              <p className="text-sm text-muted-foreground mt-1">Crie seu primeiro lote enviando uma folha de ponto.</p>
              <Button asChild className="mt-4"><Link to="/lotes/novo"><Plus className="h-4 w-4 mr-2" />Novo lote</Link></Button>
            </div>
          ) : (
            <div className="divide-y">
              {batches.map((b) => (
                <Link key={b.id} to={`/lotes/${b.id}/revisao`} className="flex items-center justify-between px-6 py-4 hover:bg-muted/40 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-md bg-accent flex items-center justify-center text-accent-foreground shrink-0">
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
        </Card>
      </div>
    </AppLayout>
  );
}
