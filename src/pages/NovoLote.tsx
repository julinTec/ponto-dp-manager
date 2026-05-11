import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Loader2, FileText, X, FileUp, FileStack } from "lucide-react";
import { CompanyPicker } from "@/components/CompanyFilter";
import { toast } from "sonner";

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

function isValid(f: File) {
  return /pdf|image\//.test(f.type) && f.size <= 20 * 1024 * 1024;
}

export default function NovoLote() {
  const { profile, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialTab = params.get("modo") === "lote" ? "lote" : "single";
  const [tab, setTab] = useState<string>(initialTab);
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => { setTab(initialTab); }, [initialTab]);

  // ---------- Estado: folha única ----------
  const [singleFile, setSingleFile] = useState<File | null>(null);
  const [singleSubmitting, setSingleSubmitting] = useState(false);

  // ---------- Estado: lote ----------
  const [files, setFiles] = useState<File[]>([]);
  const [nome, setNome] = useState("");
  const [mes, setMes] = useState<string>(String(new Date().getMonth() + 1));
  const [ano, setAno] = useState<string>(String(new Date().getFullYear()));
  const [submitting, setSubmitting] = useState(false);

  // ---------- Lógica compartilhada ----------
  async function criarLoteEEnviar(arquivos: File[], meta: { nome: string; mes: number; ano: number }) {
    if (!profile?.company_id) throw new Error("Empresa não encontrada");
    const { data: batch, error: bErr } = await supabase
      .from("timesheet_batches")
      .insert({
        company_id: profile.company_id,
        criado_por: profile.id,
        nome: meta.nome,
        mes_referencia: meta.mes,
        ano_referencia: meta.ano,
        status: "enviado",
      })
      .select()
      .single();
    if (bErr) throw bErr;

    for (const file of arquivos) {
      const path = `${profile.company_id}/${batch.id}/${crypto.randomUUID()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("timesheets").upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { error: fErr } = await supabase.from("timesheet_files").insert({
        batch_id: batch.id,
        storage_path: path,
        original_name: file.name,
        mime_type: file.type,
        tamanho_bytes: file.size,
      });
      if (fErr) throw fErr;
    }

    supabase.functions.invoke("process-batch", { body: { batch_id: batch.id } }).catch(console.error);
    return batch.id as string;
  }

  // ---------- Handlers: folha única ----------
  function pickSingle(list: File[]) {
    const f = list[0];
    if (!f) return;
    if (!isValid(f)) return toast.error("Arquivo inválido (apenas PDF/imagem até 20MB).");
    setSingleFile(f);
  }

  async function submitSingle(e: React.FormEvent) {
    e.preventDefault();
    if (!singleFile) return toast.error("Selecione uma folha de ponto");
    setSingleSubmitting(true);
    try {
      const baseName = singleFile.name.replace(/\.[^.]+$/, "").slice(0, 120) || "Folha avulsa";
      const now = new Date();
      const id = await criarLoteEEnviar([singleFile], {
        nome: baseName,
        mes: now.getMonth() + 1,
        ano: now.getFullYear(),
      });
      toast.success("Folha enviada! Processamento iniciado.");
      navigate(`/lotes/${id}/revisao`);
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao enviar folha");
    } finally {
      setSingleSubmitting(false);
    }
  }

  // ---------- Handlers: lote ----------
  function addFiles(list: File[]) {
    const valid = list.filter(isValid);
    if (valid.length !== list.length) toast.warning("Alguns arquivos foram ignorados (apenas PDF/imagem até 20MB).");
    setFiles((prev) => [...prev, ...valid]);
  }

  async function submitBatch(e: React.FormEvent) {
    e.preventDefault();
    if (files.length === 0) return toast.error("Selecione ao menos um arquivo");
    if (!nome.trim()) return toast.error("Dê um nome ao lote");
    setSubmitting(true);
    try {
      const id = await criarLoteEEnviar(files, {
        nome: nome.trim(),
        mes: parseInt(mes),
        ano: parseInt(ano),
      });
      toast.success("Lote criado! Processamento iniciado.");
      navigate(`/lotes/${id}/revisao`);
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao criar lote");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppLayout>
      <div className="p-8 max-w-3xl mx-auto space-y-6">
        <PageHeader
          title="Nova folha de ponto"
          subtitle="Envie uma folha individual ou um lote com vários arquivos para processamento automático"
        />

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-2 w-full max-w-md">
            <TabsTrigger value="single"><FileUp className="h-4 w-4 mr-2" />Folha única</TabsTrigger>
            <TabsTrigger value="lote"><FileStack className="h-4 w-4 mr-2" />Lote</TabsTrigger>
          </TabsList>

          {/* ---------------- Folha única ---------------- */}
          <TabsContent value="single" className="mt-4">
            <Card className="p-6">
              <form onSubmit={submitSingle} className="space-y-5">
                <div className="space-y-2">
                  <Label>Folha de ponto (PDF ou imagem)</Label>
                  <label
                    htmlFor="single-file"
                    className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg py-10 cursor-pointer hover:border-primary hover:bg-accent/30 transition-colors"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); pickSingle(Array.from(e.dataTransfer.files)); }}
                  >
                    <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm font-medium text-foreground">Clique para selecionar ou arraste aqui</p>
                    <p className="text-xs text-muted-foreground mt-1">Apenas 1 arquivo · PDF, JPG ou PNG · até 20MB</p>
                    <input
                      id="single-file"
                      type="file"
                      accept="application/pdf,image/*"
                      className="hidden"
                      onChange={(e) => pickSingle(Array.from(e.target.files ?? []))}
                    />
                  </label>
                </div>

                {singleFile && (
                  <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-md">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm flex-1 truncate">{singleFile.name}</span>
                    <span className="text-xs text-muted-foreground">{(singleFile.size / 1024 / 1024).toFixed(1)} MB</span>
                    <button type="button" onClick={() => setSingleFile(null)} className="text-muted-foreground hover:text-destructive">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  A folha será registrada com a data atual. Você pode ajustar mês de referência depois pela tela de revisão.
                </p>

                <Button type="submit" disabled={singleSubmitting || !singleFile} className="w-full">
                  {singleSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Enviar folha e processar
                </Button>
              </form>
            </Card>
          </TabsContent>

          {/* ---------------- Lote ---------------- */}
          <TabsContent value="lote" className="mt-4">
            <Card className="p-6">
              <form onSubmit={submitBatch} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome do lote</Label>
                  <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Folhas Filial SP - Janeiro" required maxLength={120} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Mês de referência</Label>
                    <Select value={mes} onValueChange={setMes}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MESES.map((m, i) => <SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ano">Ano</Label>
                    <Input id="ano" type="number" value={ano} onChange={(e) => setAno(e.target.value)} min={2020} max={2099} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Arquivos (PDF ou imagens)</Label>
                  <label
                    htmlFor="files"
                    className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg py-10 cursor-pointer hover:border-primary hover:bg-accent/30 transition-colors"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); addFiles(Array.from(e.dataTransfer.files)); }}
                  >
                    <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm font-medium text-foreground">Clique para selecionar ou arraste aqui</p>
                    <p className="text-xs text-muted-foreground mt-1">PDF, JPG, PNG · até 20MB cada</p>
                    <input id="files" type="file" multiple accept="application/pdf,image/*" className="hidden"
                      onChange={(e) => addFiles(Array.from(e.target.files ?? []))} />
                  </label>
                </div>

                {files.length > 0 && (
                  <div className="space-y-2">
                    {files.map((f, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-muted/40 rounded-md">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm flex-1 truncate">{f.name}</span>
                        <span className="text-xs text-muted-foreground">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                        <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Criar lote e processar
                </Button>
              </form>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
