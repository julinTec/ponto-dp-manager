import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, BatchStatus } from "@/components/StatusBadge";
import { FileStack, Clock, CheckCircle2, AlertCircle, Plus, Loader2 } from "lucide-react";
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
  const { profile } = useAuth();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [counts, setCounts] = useState<Record<BatchStatus, number>>({
    enviado: 0, processando: 0, aguardando_revisao: 0, revisado: 0, exportado: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.company_id) return;
    load();
  }, [profile?.company_id]);

  async function load() {
    const { data } = await supabase
      .from("timesheet_batches")
      .select("id, nome, status, total_paginas, total_marcacoes, created_at")
      .order("created_at", { ascending: false })
      .limit(8);
    const all = (data ?? []) as Batch[];
    setBatches(all);
    const { data: allStatus } = await supabase
      .from("timesheet_batches")
      .select("status");
    const c: any = { enviado: 0, processando: 0, aguardando_revisao: 0, revisado: 0, exportado: 0 };
    (allStatus ?? []).forEach((b: any) => { c[b.status] = (c[b.status] ?? 0) + 1; });
    setCounts(c);
    setLoading(false);
  }

  const cards = [
    { label: "Aguardando revisão", value: counts.aguardando_revisao, icon: AlertCircle, color: "text-warning" },
    { label: "Processando", value: counts.processando, icon: Loader2, color: "text-info" },
    { label: "Revisados", value: counts.revisado, icon: CheckCircle2, color: "text-success" },
    { label: "Total de lotes", value: Object.values(counts).reduce((a, b) => a + b, 0), icon: FileStack, color: "text-primary" },
  ];

  return (
    <AppLayout>
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">Visão geral dos lotes de folhas de ponto</p>
          </div>
          <Button asChild>
            <Link to="/lotes/novo"><Plus className="h-4 w-4 mr-2" />Novo lote</Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((c) => {
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

        <Card className="overflow-hidden">
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Lotes recentes</h2>
            <Button asChild variant="ghost" size="sm"><Link to="/lotes">Ver todos</Link></Button>
          </div>
          {loading ? (
            <div className="p-12 text-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mx-auto" />
            </div>
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
