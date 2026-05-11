import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { FileText, Loader2, Upload, X, CheckCircle2, AlertTriangle, Trash2, Download } from "lucide-react";
import { CompanyFilter, CompanyPicker } from "@/components/CompanyFilter";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const TIPOS: { value: string; label: string }[] = [
  { value: "atestado", label: "Atestado médico" },
  { value: "ferias", label: "Férias" },
  { value: "advertencia", label: "Advertência" },
  { value: "suspensao", label: "Suspensão" },
  { value: "aviso_previo", label: "Aviso prévio" },
  { value: "rescisao", label: "Rescisão" },
  { value: "declaracao", label: "Declaração" },
  { value: "comprovante_pagamento", label: "Holerite/Comprovante" },
  { value: "justificativa", label: "Justificativa" },
  { value: "outro", label: "Outro" },
];

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  validado: "default",
  pendente_revisao: "secondary",
  rejeitado: "destructive",
};

interface Doc {
  id: string;
  document_type: string;
  storage_path: string;
  original_name: string | null;
  status: string;
  confianca: number | null;
  needs_review: boolean;
  document_date: string | null;
  start_date: string | null;
  end_date: string | null;
  ai_extracted_data: any;
  notes: string | null;
  employee_id: string | null;
  created_at: string;
  employees?: { id: string; nome: string; cpf: string | null } | null;
}

interface Employee { id: string; nome: string; cpf: string | null; }

export default function Documentos() {
  const { profile, isAdmin, isSuperAdmin } = useAuth();
  const canEdit = isAdmin || isSuperAdmin;
  const [docs, setDocs] = useState<Doc[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<{ file: File; tipo: string; employee_id?: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<string>("todos");
  const [editing, setEditing] = useState<Doc | null>(null);

  useEffect(() => { load(); loadEmployees(); }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("employee_documents")
      .select("*, employees(id, nome, cpf)")
      .order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar documentos");
    setDocs((data ?? []) as any);
    setLoading(false);
  }

  async function loadEmployees() {
    const { data } = await supabase.from("employees").select("id, nome, cpf").eq("status", "ativo").order("nome");
    setEmployees(data ?? []);
  }

  function pickFiles(fl: FileList | null) {
    if (!fl) return;
    const arr = Array.from(fl).map(f => ({ file: f, tipo: "atestado" }));
    setFiles(prev => [...prev, ...arr]);
  }

  async function handleUpload() {
    if (!profile?.company_id || files.length === 0) return;
    setSubmitting(true);
    try {
      for (const item of files) {
        const ext = item.file.name.split(".").pop() ?? "bin";
        const path = `${profile.company_id}/docs/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("employee-docs").upload(path, item.file, {
          contentType: item.file.type, upsert: false,
        });
        if (upErr) throw upErr;

        const { data: doc, error: insErr } = await supabase.from("employee_documents").insert({
          company_id: profile.company_id,
          employee_id: item.employee_id ?? null,
          document_type: item.tipo as any,
          storage_path: path,
          original_name: item.file.name,
          mime_type: item.file.type,
          tamanho_bytes: item.file.size,
          status: "pendente_revisao",
          needs_review: true,
        }).select().single();
        if (insErr) throw insErr;

        // dispara OCR (não aguarda)
        supabase.functions.invoke("ocr-employee-doc", { body: { employee_document_id: doc.id } });
      }
      toast.success(`${files.length} documento(s) enviado(s). Processando OCR...`);
      setFiles([]); setOpen(false);
      setTimeout(load, 1500);
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao enviar");
    } finally {
      setSubmitting(false);
    }
  }

  async function aplicarAtestado(d: Doc) {
    if (!d.employee_id || !d.start_date || !d.end_date) {
      toast.error("Documento precisa ter funcionário e período definidos.");
      return;
    }
    const { data, error } = await supabase.rpc("apply_medical_certificate", {
      _employee_id: d.employee_id, _start: d.start_date, _end: d.end_date, _document_id: d.id,
    });
    if (error) { toast.error(error.message); return; }
    await supabase.from("employee_documents").update({ status: "validado", needs_review: false }).eq("id", d.id);
    toast.success(`Atestado aplicado em ${data ?? 0} dia(s).`);
    load();
  }

  async function recalcularDsr(d: Doc) {
    if (!d.employee_id) { toast.error("Documento sem funcionário."); return; }
    const ref = d.document_date ?? d.start_date ?? d.created_at.slice(0, 10);
    const [y, m] = ref.split("-").map(Number);
    const { data, error } = await supabase.rpc("recompute_dsr_for_employee_month", {
      _employee_id: d.employee_id, _ano: y, _mes: m,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(`${data ?? 0} desconto(s) de DSR registrado(s) no mês.`);
  }

  async function validar(d: Doc) {
    await supabase.from("employee_documents").update({ status: "validado", needs_review: false }).eq("id", d.id);
    if (d.document_type === "atestado") await aplicarAtestado(d);
    else load();
  }

  async function rejeitar(d: Doc) {
    await supabase.from("employee_documents").update({ status: "rejeitado", needs_review: false }).eq("id", d.id);
    toast.success("Documento rejeitado.");
    load();
  }

  async function excluir(d: Doc) {
    if (!confirm(`Excluir o documento "${d.original_name ?? d.id}"?`)) return;
    await supabase.storage.from("employee-docs").remove([d.storage_path]);
    await supabase.from("employee_documents").delete().eq("id", d.id);
    toast.success("Documento excluído.");
    load();
  }

  async function baixar(d: Doc) {
    const { data, error } = await supabase.storage.from("employee-docs").createSignedUrl(d.storage_path, 60);
    if (error || !data) { toast.error("Falha ao gerar link"); return; }
    window.open(data.signedUrl, "_blank");
  }

  async function salvarEdicao() {
    if (!editing) return;
    const upd: any = {
      employee_id: editing.employee_id,
      document_type: editing.document_type,
      document_date: editing.document_date,
      start_date: editing.start_date,
      end_date: editing.end_date,
      notes: editing.notes,
    };
    const { error } = await supabase.from("employee_documents").update(upd).eq("id", editing.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Salvo.");
    setEditing(null); load();
  }

  const filtered = docs.filter(d => filter === "todos" ? true : filter === "pendentes" ? d.needs_review || d.status === "pendente_revisao" : d.document_type === filter);

  return (
    <AppLayout>
      <PageHeader title="Documentos Trabalhistas" subtitle="Atestados, férias, advertências, holerites e justificativas." />
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pendentes">Pendentes de revisão</SelectItem>
                {TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">{filtered.length} documento(s)</span>
          </div>
          {canEdit && (
            <Button onClick={() => setOpen(true)}><Upload className="h-4 w-4 mr-2" />Enviar documentos</Button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
            Nenhum documento encontrado.
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map(d => {
              const tipoLabel = TIPOS.find(t => t.value === d.document_type)?.label ?? d.document_type;
              return (
                <Card key={d.id} className="p-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={STATUS_VARIANT[d.status] ?? "outline"}>{d.status.replace("_", " ")}</Badge>
                        <Badge variant="outline">{tipoLabel}</Badge>
                        {d.confianca != null && <ConfidenceBadge value={d.confianca} />}
                        {d.needs_review && <Badge variant="secondary" className="gap-1"><AlertTriangle className="h-3 w-3" />Revisar</Badge>}
                      </div>
                      <p className="font-medium truncate">{d.original_name ?? "documento"}</p>
                      <p className="text-sm text-muted-foreground">
                        {d.employees ? `${d.employees.nome}${d.employees.cpf ? " • " + d.employees.cpf : ""}` : <span className="italic">Funcionário não identificado</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {d.document_date && `Emitido: ${format(new Date(d.document_date + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })}`}
                        {d.start_date && d.end_date && ` • Período: ${format(new Date(d.start_date + "T00:00:00"), "dd/MM/yyyy")} a ${format(new Date(d.end_date + "T00:00:00"), "dd/MM/yyyy")}`}
                      </p>
                      {d.notes && <p className="text-xs text-amber-600">{d.notes}</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button size="sm" variant="outline" onClick={() => baixar(d)}><Download className="h-4 w-4" /></Button>
                      {canEdit && <Button size="sm" variant="outline" onClick={() => setEditing(d)}>Editar</Button>}
                      {canEdit && d.status !== "validado" && (
                        <Button size="sm" onClick={() => validar(d)} className="gap-1">
                          <CheckCircle2 className="h-4 w-4" />Validar
                        </Button>
                      )}
                      {canEdit && d.document_type === "atestado" && d.status === "validado" && (
                        <Button size="sm" variant="secondary" onClick={() => aplicarAtestado(d)}>Reaplicar</Button>
                      )}
                      {canEdit && d.status !== "rejeitado" && (
                        <Button size="sm" variant="ghost" onClick={() => rejeitar(d)}>Rejeitar</Button>
                      )}
                      {canEdit && (
                        <Button size="sm" variant="ghost" onClick={() => recalcularDsr(d)}>Recalc. DSR</Button>
                      )}
                      {canEdit && (
                        <Button size="sm" variant="ghost" onClick={() => excluir(d)}><Trash2 className="h-4 w-4" /></Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Upload dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Enviar documentos trabalhistas</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Selecione um ou mais arquivos</Label>
            <Input type="file" multiple accept="image/*,.pdf" onChange={e => pickFiles(e.target.files)} />
            {files.length > 0 && (
              <div className="space-y-2 max-h-72 overflow-auto pr-1">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 border rounded-md p-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{f.file.name}</p>
                      <p className="text-xs text-muted-foreground">{(f.file.size / 1024).toFixed(0)} KB</p>
                    </div>
                    <Select value={f.tipo} onValueChange={v => setFiles(p => p.map((x, idx) => idx === i ? { ...x, tipo: v } : x))}>
                      <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                      <SelectContent>{TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={f.employee_id ?? "auto"} onValueChange={v => setFiles(p => p.map((x, idx) => idx === i ? { ...x, employee_id: v === "auto" ? undefined : v } : x))}>
                      <SelectTrigger className="w-52"><SelectValue placeholder="Funcionário" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Detectar automaticamente</SelectItem>
                        {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button size="icon" variant="ghost" onClick={() => setFiles(p => p.filter((_, idx) => idx !== i))}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleUpload} disabled={submitting || files.length === 0}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enviar e processar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={v => !v && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar documento</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Tipo</Label>
                <Select value={editing.document_type} onValueChange={v => setEditing({ ...editing, document_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Funcionário</Label>
                <Select value={editing.employee_id ?? ""} onValueChange={v => setEditing({ ...editing, employee_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Data emissão</Label>
                  <Input type="date" value={editing.document_date ?? ""} onChange={e => setEditing({ ...editing, document_date: e.target.value || null })} />
                </div>
                <div>
                  <Label>Início</Label>
                  <Input type="date" value={editing.start_date ?? ""} onChange={e => setEditing({ ...editing, start_date: e.target.value || null })} />
                </div>
                <div>
                  <Label>Fim</Label>
                  <Input type="date" value={editing.end_date ?? ""} onChange={e => setEditing({ ...editing, end_date: e.target.value || null })} />
                </div>
              </div>
              <div>
                <Label>Observações</Label>
                <Input value={editing.notes ?? ""} onChange={e => setEditing({ ...editing, notes: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={salvarEdicao}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
