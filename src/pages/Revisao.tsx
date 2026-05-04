import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge, BatchStatus } from "@/components/StatusBadge";
import { ArrowLeft, ChevronLeft, ChevronRight, Download, Loader2, Save, CheckCircle2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Page { id: string; numero_pagina: number; image_path: string | null; ocr_status: string; }
interface Entry {
  id: string; page_id: string | null; nome_lido: string | null; cpf_lido: string | null;
  funcao_lida: string | null; data: string | null; dia_semana: string | null;
  entrada: string | null; saida_intervalo: string | null; retorno_intervalo: string | null;
  saida_final: string | null; status: string; observacoes: string | null;
  confianca: number | null; revisado: boolean; _dirty?: boolean;
}

const COLS: { key: keyof Entry; label: string; type?: string; w?: string }[] = [
  { key: "nome_lido", label: "Funcionário", w: "min-w-[160px]" },
  { key: "cpf_lido", label: "CPF", w: "w-32" },
  { key: "funcao_lida", label: "Função", w: "w-32" },
  { key: "data", label: "Data", type: "date", w: "w-32" },
  { key: "dia_semana", label: "Dia", w: "w-20" },
  { key: "entrada", label: "Entrada", type: "time", w: "w-24" },
  { key: "saida_intervalo", label: "Saída int.", type: "time", w: "w-24" },
  { key: "retorno_intervalo", label: "Retorno int.", type: "time", w: "w-24" },
  { key: "saida_final", label: "Saída final", type: "time", w: "w-24" },
];

export default function Revisao() {
  const { id: batchId } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const [batch, setBatch] = useState<any>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [pageIdx, setPageIdx] = useState(0);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (batchId) load(); }, [batchId]);

  // Realtime: atualizar entries enquanto OCR processa
  useEffect(() => {
    if (!batchId) return;
    const ch = supabase
      .channel(`batch-${batchId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "time_entries", filter: `batch_id=eq.${batchId}` }, () => load(true))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "timesheet_batches", filter: `id=eq.${batchId}` }, () => load(true))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [batchId]);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    const [{ data: b }, { data: p }, { data: e }] = await Promise.all([
      supabase.from("timesheet_batches").select("*").eq("id", batchId!).single(),
      supabase.from("timesheet_pages").select("*").eq("batch_id", batchId!).order("numero_pagina"),
      supabase.from("time_entries").select("*").eq("batch_id", batchId!).order("data", { nullsFirst: false }),
    ]);
    setBatch(b);
    setPages((p ?? []) as Page[]);
    setEntries(((e ?? []) as Entry[]).map((x) => ({ ...x, _dirty: false })));
    if (!silent) setLoading(false);
  }

  const currentPage = pages[pageIdx];
  useEffect(() => {
    (async () => {
      if (!currentPage?.image_path) { setImageUrl(null); return; }
      const { data } = await supabase.storage.from("timesheets").createSignedUrl(currentPage.image_path, 3600);
      setImageUrl(data?.signedUrl ?? null);
    })();
  }, [currentPage?.image_path]);

  const visibleEntries = useMemo(
    () => entries.filter((e) => !currentPage || e.page_id === currentPage.id),
    [entries, currentPage]
  );

  function updateEntry(id: string, key: keyof Entry, value: any) {
    setEntries((prev) => prev.map((e) => e.id === id ? { ...e, [key]: value, _dirty: true } : e));
  }

  async function saveAll() {
    const dirty = entries.filter((e) => e._dirty);
    if (dirty.length === 0) return toast.info("Nada para salvar");
    setSaving(true);
    for (const e of dirty) {
      const { _dirty, ...row } = e;
      await supabase.from("time_entries").update({
        nome_lido: row.nome_lido, cpf_lido: row.cpf_lido, funcao_lida: row.funcao_lida,
        data: row.data, dia_semana: row.dia_semana, entrada: row.entrada,
        saida_intervalo: row.saida_intervalo, retorno_intervalo: row.retorno_intervalo,
        saida_final: row.saida_final, status: row.status as any, observacoes: row.observacoes,
        revisado: true, revisado_por: profile?.id, revisado_em: new Date().toISOString(),
      }).eq("id", e.id);
    }
    setSaving(false);
    toast.success(`${dirty.length} marcação(ões) salvas`);
    load(true);
  }

  async function marcarRevisado() {
    await saveAll();
    await supabase.from("timesheet_batches").update({ status: "revisado" }).eq("id", batchId!);
    toast.success("Lote marcado como revisado");
    load(true);
  }

  async function exportarCSV() {
    const { data, error } = await supabase.functions.invoke("export-batch-csv", { body: { batch_id: batchId } });
    if (error) return toast.error("Erro ao exportar");
    const blob = new Blob([data.csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${batch.nome.replace(/\s+/g,"_")}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado");
    load(true);
  }

  async function reprocessar() {
    await supabase.functions.invoke("process-batch", { body: { batch_id: batchId } });
    toast.info("Reprocessamento iniciado");
    load(true);
  }

  function confidenceClass(c: number | null) {
    if (c == null) return "bg-muted text-muted-foreground";
    if (c >= 0.9) return "bg-success/15 text-success";
    if (c >= 0.7) return "bg-warning/15 text-warning";
    return "bg-destructive/15 text-destructive";
  }

  if (loading) return <AppLayout><div className="p-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div></AppLayout>;
  if (!batch) return <AppLayout><div className="p-12">Lote não encontrado</div></AppLayout>;

  return (
    <AppLayout>
      <div className="flex flex-col h-screen">
        <div className="px-6 py-3 border-b bg-card flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Button asChild variant="ghost" size="sm"><Link to="/lotes"><ArrowLeft className="h-4 w-4" /></Link></Button>
            <div className="min-w-0">
              <h1 className="font-semibold text-foreground truncate">{batch.nome}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <StatusBadge status={batch.status as BatchStatus} />
                <span className="text-xs text-muted-foreground">{pages.length} pág · {entries.length} marcações</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={reprocessar}><RefreshCw className="h-4 w-4 mr-1" />Reprocessar</Button>
            <Button variant="outline" size="sm" onClick={saveAll} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Salvar
            </Button>
            <Button variant="outline" size="sm" onClick={marcarRevisado}><CheckCircle2 className="h-4 w-4 mr-1" />Marcar revisado</Button>
            <Button size="sm" onClick={exportarCSV}><Download className="h-4 w-4 mr-1" />Exportar CSV</Button>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-2 min-h-0">
          {/* Imagem */}
          <div className="bg-muted/30 border-r flex flex-col min-h-0">
            <div className="px-4 py-2 border-b bg-card flex items-center justify-between">
              <span className="text-sm font-medium">
                Página {currentPage ? currentPage.numero_pagina : "—"} de {pages.length}
              </span>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => setPageIdx(Math.max(0, pageIdx - 1))} disabled={pageIdx === 0}><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="ghost" size="sm" onClick={() => setPageIdx(Math.min(pages.length - 1, pageIdx + 1))} disabled={pageIdx >= pages.length - 1}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-start justify-center">
              {imageUrl ? (
                <img src={imageUrl} alt={`Página ${currentPage?.numero_pagina}`} className="max-w-full shadow-lg rounded" />
              ) : (
                <div className="text-center text-muted-foreground py-12">
                  {pages.length === 0 ? "Aguardando processamento..." : "Sem imagem disponível"}
                </div>
              )}
            </div>
          </div>

          {/* Tabela editável */}
          <div className="flex flex-col min-h-0 bg-background">
            <div className="px-4 py-2 border-b bg-card text-sm font-medium">
              Marcações da página · {visibleEntries.length}
            </div>
            <div className="flex-1 overflow-auto">
              {visibleEntries.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  Nenhuma marcação nesta página ainda.
                </div>
              ) : (
                <table className="text-xs w-full">
                  <thead className="bg-muted/50 sticky top-0 z-10">
                    <tr>
                      {COLS.map((c) => <th key={c.key} className={cn("text-left px-2 py-2 font-medium text-muted-foreground", c.w)}>{c.label}</th>)}
                      <th className="text-left px-2 py-2 font-medium text-muted-foreground w-32">Status</th>
                      <th className="text-left px-2 py-2 font-medium text-muted-foreground w-20">Conf.</th>
                      <th className="text-left px-2 py-2 font-medium text-muted-foreground min-w-[140px]">Obs.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {visibleEntries.map((e) => (
                      <tr key={e.id} className={cn(e.revisado && "bg-success/5", !e.revisado && (e.confianca ?? 1) < 0.7 && "bg-destructive/5")}>
                        {COLS.map((c) => (
                          <td key={c.key} className="px-1 py-1">
                            <Input
                              type={c.type as any}
                              value={(e[c.key] as any) ?? ""}
                              onChange={(ev) => updateEntry(e.id, c.key, ev.target.value || null)}
                              className="h-8 text-xs px-2"
                            />
                          </td>
                        ))}
                        <td className="px-1 py-1">
                          <Select value={e.status} onValueChange={(v) => updateEntry(e.id, "status", v)}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ok">OK</SelectItem>
                              <SelectItem value="inconsistente">Inconsistente</SelectItem>
                              <SelectItem value="falta">Falta</SelectItem>
                              <SelectItem value="folga">Folga</SelectItem>
                              <SelectItem value="feriado">Feriado</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-1 py-1">
                          <span className={cn("inline-block px-2 py-1 rounded text-[10px] font-medium", confidenceClass(e.confianca))}>
                            {e.confianca != null ? `${Math.round(e.confianca * 100)}%` : "—"}
                          </span>
                        </td>
                        <td className="px-1 py-1">
                          <Input value={e.observacoes ?? ""} onChange={(ev) => updateEntry(e.id, "observacoes", ev.target.value || null)} className="h-8 text-xs px-2" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
