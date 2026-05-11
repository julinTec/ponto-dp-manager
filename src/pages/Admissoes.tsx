import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
import { Plus, UserPlus, FileText, Loader2, Upload, X } from "lucide-react";
import { CompanyFilter, CompanyPicker } from "@/components/CompanyFilter";
import { toast } from "sonner";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
        // dispara OCR em background
        supabase.functions.invoke("ocr-admission-doc", { body: { admission_document_id: docRow.id } }).catch(console.error);
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

  return (
    <AppLayout>
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <PageHeader
          title="Admissão de Funcionários"
          subtitle="Envio de documentos com leitura automática para cadastro do funcionário"
          actions={
            <div className="flex items-center gap-2">
              <CompanyFilter value={companyFilter} onChange={setCompanyFilter} />
              {canEdit && <Button onClick={() => { setCreateCompanyId(null); setOpen(true); }}><Plus className="h-4 w-4 mr-2" />Nova admissão</Button>}
            </div>
          }
        />

        <Card className="overflow-hidden">
          {loading ? (
            <div className="p-12 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>
          ) : list.length === 0 ? (
            <div className="p-12 text-center">
              <UserPlus className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-foreground font-medium">Nenhuma admissão em andamento</p>
              <p className="text-sm text-muted-foreground mt-1">Inicie uma nova admissão enviando os documentos do candidato.</p>
            </div>
          ) : (
            <div className="divide-y">
              {list.map((a) => (
                <Link key={a.id} to={`/admissoes/${a.id}`} className="flex items-center justify-between px-6 py-4 hover:bg-muted/40">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-md bg-accent flex items-center justify-center text-accent-foreground shrink-0">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {a.dados_extraidos?.nome ?? "Aguardando leitura..."}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(a.created_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                        {a.dados_extraidos?.cargo && ` · ${a.dados_extraidos.cargo}`}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline">{STATUS_LABEL[a.status] ?? a.status}</Badge>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setFiles([]); }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Nova admissão</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <Label>Documentos</Label>
              <label htmlFor="adm-files" className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg py-8 cursor-pointer hover:border-primary hover:bg-accent/30 transition-colors"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); addFiles(Array.from(e.dataTransfer.files)); }}
              >
                <Upload className="h-7 w-7 text-muted-foreground mb-2" />
                <p className="text-sm font-medium">Selecione ou arraste documentos</p>
                <p className="text-xs text-muted-foreground mt-1">PDF/JPG/PNG · até 20MB cada</p>
                <input id="adm-files" type="file" multiple accept="application/pdf,image/*" className="hidden"
                  onChange={(e) => addFiles(Array.from(e.target.files ?? []))} />
              </label>
              {files.length > 0 && (
                <div className="space-y-2 max-h-64 overflow-auto">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 bg-muted/40 rounded-md">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm flex-1 truncate">{f.file.name}</span>
                      <Select value={f.tipo} onValueChange={(v) => setFiles((p) => p.map((x, j) => j === i ? { ...x, tipo: v } : x))}>
                        <SelectTrigger className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                      </Select>
                      <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={criar} disabled={submitting}>
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
