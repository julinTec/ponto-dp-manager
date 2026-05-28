import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveCompany } from "@/contexts/CompanyContext";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, UserPlus, FileText, Loader2, Upload, X, Sparkles, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { ocrDocument } from "@/lib/ocr/tesseractClient";
import { cleanOcrText } from "@/lib/ocr/textCleaner";

const TIPOS = [
  { value: "ficha", label: "Ficha de admissão" },
  { value: "rg", label: "RG" },
  { value: "cpf", label: "CPF" },
  { value: "cnh", label: "CNH" },
  { value: "ctps", label: "CTPS" },
  { value: "comprovante_residencia", label: "Comp. residência" },
  { value: "certidao_nascimento", label: "Cert. nascimento" },
  { value: "certidao_casamento", label: "Cert. casamento" },
  { value: "certificado_escolar", label: "Cert. escolar" },
  { value: "titulo_eleitor", label: "Título de eleitor" },
  { value: "pis_pasep", label: "PIS/PASEP" },
  { value: "reservista", label: "Reservista" },
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
  const { activeCompanyId } = useActiveCompany();
  const canEdit = isAdmin || isSuperAdmin;
  const navigate = useNavigate();
  const [list, setList] = useState<Admission[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [files, setFiles] = useState<{ file: File; tipo: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<string>("");

  useEffect(() => { if (activeCompanyId) load(); }, [activeCompanyId]);

  async function load() {
    if (!activeCompanyId) return;
    setLoading(true);
    const { data } = await supabase
      .from("employee_admissions")
      .select("*")
      .eq("company_id", activeCompanyId)
      .order("created_at", { ascending: false });
    setList((data ?? []) as Admission[]);
    setLoading(false);
  }

  function addFiles(arr: File[]) {
    const valid = arr.filter((f) => /pdf|image\//.test(f.type) && f.size <= 20 * 1024 * 1024);
    if (valid.length !== arr.length) toast.warning("Alguns arquivos foram ignorados (PDF/imagem até 20MB).");
    setFiles((p) => [...p, ...valid.map((file) => ({ file, tipo: "ficha" }))]);
  }

  async function criar() {
    const company_id = activeCompanyId;
    if (!company_id) return toast.error("Selecione a empresa no topo");
    if (files.length === 0) return toast.error("Adicione ao menos um documento");
    setSubmitting(true);
    try {
      const { data: adm, error } = await supabase
        .from("employee_admissions")
        .insert({ company_id, created_by: profile?.id, status: "em_analise" })
        .select().single();
      if (error) throw error;

      for (let idx = 0; idx < files.length; idx++) {
        const item = files[idx];
        setProgress(`Enviando ${idx + 1}/${files.length}: ${item.file.name}`);

        const path = `${company_id}/admissoes/${adm.id}/${item.tipo}/${crypto.randomUUID()}-${item.file.name}`;
        const { error: upErr } = await supabase.storage.from("employee-docs").upload(path, item.file, { contentType: item.file.type });
        if (upErr) throw upErr;

        const { data: docRow, error: insErr } = await supabase.from("admission_documents").insert({
          admission_id: adm.id,
          tipo: item.tipo as any,
          storage_path: path,
          original_name: item.file.name,
          mime_type: item.file.type,
          tamanho_bytes: item.file.size,
          extraction_status: "processando",
          ocr_status: "processando",
        }).select().single();
        if (insErr) throw insErr;

        // Nível 1: OCR no browser → texto → edge function
        setProgress(`Lendo ${idx + 1}/${files.length}: ${item.file.name}…`);
        try {
          const ocr = await ocrDocument(item.file);
          const cleaned = cleanOcrText(ocr.text);
          await supabase.functions.invoke("admission-ocr-extract", {
            body: {
              admission_document_id: docRow.id,
              ocr_text: ocr.text,
              ocr_text_clean: cleaned,
              ocr_confidence: ocr.confidence,
            },
          });
        } catch (ocrErr: any) {
          console.error("OCR falhou:", ocrErr);
          await supabase.from("admission_documents").update({
            ocr_status: "falhou",
            extraction_status: "falhou",
            needs_review: true,
            erro: ocrErr?.message ?? "OCR no navegador falhou",
          }).eq("id", docRow.id);
        }
      }

      toast.success("Admissão criada. Documentos sendo analisados.");
      setOpen(false);
      setFiles([]);
      setProgress("");
      load();
      navigate(`/admissoes/${adm.id}`);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao criar admissão");
    } finally {
      setSubmitting(false);
      setProgress("");
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
          subtitle="Envio de documentos com OCR local + IA econômica (gpt-4o-mini)"
          eyebrow="Pessoas"
          actions={
            canEdit && (
              <Button onClick={() => setOpen(true)} className="bg-gradient-primary shadow-sm hover:opacity-95">
                <Plus className="h-4 w-4 mr-2" />Nova admissão
              </Button>
            )
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
              description="Inicie uma nova admissão enviando os documentos do candidato. O OCR roda local e a IA estrutura os dados."
              action={canEdit ? <Button onClick={() => setOpen(true)} className="bg-gradient-primary"><Plus className="h-4 w-4 mr-2" />Nova admissão</Button> : null}
            />
          ) : (
            <div className="divide-y divide-border/70">
              {list.map((a) => (
                <div key={a.id} className="group relative flex items-center justify-between hover:bg-muted/40 transition-colors">
                  <Link to={`/admissoes/${a.id}`} className="flex-1 flex items-center justify-between px-6 py-4 min-w-0">
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
                  {canEdit && (
                    <div className="pr-6 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDeleteId(a.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setFiles([]); }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Nova admissão</DialogTitle></DialogHeader>
            <div className="space-y-4">
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
              {progress && (
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" /> {progress}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>Cancelar</Button>
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
