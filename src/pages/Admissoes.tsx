import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, UserPlus, FileText, Loader2, Upload, X, Sparkles } from "lucide-react";
import { CompanyFilter, CompanyPicker } from "@/components/CompanyFilter";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const TIPOS = [
  { value: "ficha", label: "Ficha de admissão" },
  { value: "rg", label: "RG" },
  { value: "cpf", label: "CPF" },
  { value: "comprovante_residencia", label: "Comp. residência" },
  { value: "ctps", label: "CTPS" },
  { value: "contrato", label: "Contrato" },
  { value: "exame_admissional", label: "Exame admissional" },
  { value: "outro", label: "Outro" },
];

const STATUS_LABEL: Record<string, string> = {
  em_analise: "Em análise", aprovado: "Aprovado", rejeitado: "Rejeitado",
};

interface Admission {
  id: string; status: string; dados_extraidos: any; created_at: string; employee_id: string | null;
}

export default function Admissoes() {
  const { profile, isAdmin, isSuperAdmin } = useAuth();
  const canEdit = isAdmin || isSuperAdmin;
  const navigate = useNavigate();
  const [list, setList] = useState<Admission[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<{ file: File; tipo: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [companyFilter, setCompanyFilter] = useState<string | null>(null);
  const [createCompanyId, setCreateCompanyId] = useState<string | null>(null);

  useEffect(() => { load(); }, [companyFilter]);

  async function load() {
    setLoading(true);
    let q = supabase.from("employee_admissions").select("*").order("created_at", { ascending: false });
    if (companyFilter) q = q.eq("company_id", companyFilter);
    const { data } = await q;
    setList((data ?? []) as Admission[]);
    setLoading(false);
  }

  function addFiles(arr: File[]) {
    const valid = arr.filter((f) => /pdf|image\//.test(f.type) && f.size <= 20 * 1024 * 1024);
    if (valid.length !== arr.length) toast.warning("Alguns arquivos foram ignorados (PDF/imagem até 20MB).");
    setFiles((p) => [...p, ...valid.map((file) => ({ file, tipo: "ficha" }))]);
  }

  async function criar() {
    const company_id = isSuperAdmin ? createCompanyId : profile?.company_id;
    if (!company_id) return toast.error("Selecione a empresa");
    if (files.length === 0) return toast.error("Adicione ao menos um documento");
    setSubmitting(true);
    try {
      const { data: adm, error } = await supabase
        .from("employee_admissions")
        .insert({ company_id, created_by: profile?.id, status: "em_analise" })
        .select().single();
      if (error) throw error;

      for (const item of files) {
        const path = `${company_id}/admissions/${adm.id}/${crypto.randomUUID()}-${item.file.name}`;
        const { error: upErr } = await supabase.storage.from("employee-docs").upload(path, item.file, { contentType: item.file.type });
        if (upErr) throw upErr;
        const { data: docRow, error: insErr } = await supabase.from("admission_documents").insert({
          admission_id: adm.id,
          tipo: item.tipo as any,
          storage_path: path,
          original_name: item.file.name,
          mime_type: item.file.type,
          tamanho_bytes: item.file.size,
        }).select().single();
        if (insErr) throw insErr;
        // PDF -> OpenAI (admission-pdf-extract); imagem -> Gemini (ocr-admission-doc)
        const fn = item.file.type === "application/pdf" ? "admission-pdf-extract" : "ocr-admission-doc";
        supabase.functions.invoke(fn, { body: { admission_document_id: docRow.id } }).catch(console.error);
      }

      toast.success("Admissão criada. OCR em andamento.");
      setOpen(false);
      setFiles([]);
      load();
      navigate(`/admissoes/${adm.id}`);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao criar admissão");
    } finally {
      setSubmitting(false);
    }
  }

  const statusTone = (s: string) =>
    s === "aprovado" ? "bg-success/10 text-success border-success/20"
    : s === "rejeitado" ? "bg-destructive/10 text-destructive border-destructive/20"
    : "bg-warning/10 text-warning border-warning/20";

  return (
    <AppLayout>
      <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-6">
        <PageHeader
          title="Admissão de funcionários"
          subtitle="Envio de documentos com leitura automática por IA"
          eyebrow="Pessoas"
          actions={
            <div className="flex items-center gap-2">
              <CompanyFilter value={companyFilter} onChange={setCompanyFilter} />
              {canEdit && (
                <Button onClick={() => { setCreateCompanyId(null); setOpen(true); }} className="bg-gradient-primary shadow-sm hover:opacity-95">
                  <Plus className="h-4 w-4 mr-2" />Nova admissão
                </Button>
              )}
            </div>
          }
        />

        <SectionCard
          title="Admissões em andamento"
          description="Acompanhe leitura por IA, revisão do DP e aprovação"
        >
          {loading ? (
            <div className="p-12 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>
          ) : list.length === 0 ? (
            <EmptyState
              icon={UserPlus}
              title="Nenhuma admissão em andamento"
              description="Inicie uma nova admissão enviando os documentos do candidato. A IA extrai os dados automaticamente."
              action={canEdit ? <Button onClick={() => { setCreateCompanyId(null); setOpen(true); }} className="bg-gradient-primary"><Plus className="h-4 w-4 mr-2" />Nova admissão</Button> : null}
            />
          ) : (
            <div className="divide-y divide-border/70">
              {list.map((a) => (
                <Link key={a.id} to={`/admissoes/${a.id}`} className="flex items-center justify-between px-6 py-4 hover:bg-muted/40 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate flex items-center gap-2">
                        {a.dados_extraidos?.nome ?? "Aguardando leitura…"}
                        {!a.dados_extraidos?.nome && (
                          <span className="chip bg-info/10 text-info border-info/20"><Sparkles className="h-3 w-3" /> IA processando</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {format(new Date(a.created_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                        {a.dados_extraidos?.cargo && ` · ${a.dados_extraidos.cargo}`}
                      </p>
                    </div>
                  </div>
                  <span className={cn("chip", statusTone(a.status))}>
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {STATUS_LABEL[a.status] ?? a.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>

        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setFiles([]); }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Nova admissão</DialogTitle></DialogHeader>
            <div className="space-y-4">
              {isSuperAdmin && (
                <div className="space-y-2">
                  <Label>Empresa</Label>
                  <CompanyPicker value={createCompanyId} onChange={setCreateCompanyId} />
                </div>
              )}
              <Label>Documentos do candidato</Label>
              <label
                htmlFor="adm-files"
                className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-2xl py-10 cursor-pointer hover:border-primary hover:bg-primary/5 transition-all bg-muted/30"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); addFiles(Array.from(e.dataTransfer.files)); }}
              >
                <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3">
                  <Upload className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-foreground">Arraste arquivos ou clique para enviar</p>
                <p className="text-xs text-muted-foreground mt-1">PDF, JPG ou PNG · até 20MB cada</p>
                <input id="adm-files" type="file" multiple accept="application/pdf,image/*" className="hidden"
                  onChange={(e) => addFiles(Array.from(e.target.files ?? []))} />
              </label>
              {files.length > 0 && (
                <div className="space-y-2 max-h-64 overflow-auto nice-scroll">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 p-2.5 bg-muted/40 rounded-xl border border-border/70">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <FileText className="h-4 w-4" />
                      </div>
                      <span className="text-sm flex-1 truncate font-medium text-foreground">{f.file.name}</span>
                      <Select value={f.tipo} onValueChange={(v) => setFiles((p) => p.map((x, j) => j === i ? { ...x, tipo: v } : x))}>
                        <SelectTrigger className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                      </Select>
                      <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive p-1">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={criar} disabled={submitting} className="bg-gradient-primary">
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Criar admissão
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
