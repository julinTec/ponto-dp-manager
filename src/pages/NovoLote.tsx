import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Loader2, FileText, X } from "lucide-react";
import { toast } from "sonner";

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

export default function NovoLote() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [files, setFiles] = useState<File[]>([]);
  const [nome, setNome] = useState("");
  const [mes, setMes] = useState<string>(String(new Date().getMonth() + 1));
  const [ano, setAno] = useState<string>(String(new Date().getFullYear()));
  const [submitting, setSubmitting] = useState(false);

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []);
    addFiles(list);
  }

  function addFiles(list: File[]) {
    const valid = list.filter((f) => /pdf|image\//.test(f.type) && f.size <= 20 * 1024 * 1024);
    if (valid.length !== list.length) toast.warning("Alguns arquivos foram ignorados (apenas PDF/imagem até 20MB).");
    setFiles((prev) => [...prev, ...valid]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile?.company_id) return toast.error("Empresa não encontrada");
    if (files.length === 0) return toast.error("Selecione ao menos um arquivo");
    if (!nome.trim()) return toast.error("Dê um nome ao lote");

    setSubmitting(true);
    try {
      const { data: batch, error: bErr } = await supabase
        .from("timesheet_batches")
        .insert({
          company_id: profile.company_id,
          criado_por: profile.id,
          nome: nome.trim(),
          mes_referencia: parseInt(mes),
          ano_referencia: parseInt(ano),
          status: "enviado",
        })
        .select()
        .single();
      if (bErr) throw bErr;

      for (const file of files) {
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

      // Dispara processamento
      supabase.functions.invoke("process-batch", { body: { batch_id: batch.id } }).catch(console.error);
      toast.success("Lote criado! Processamento iniciado.");
      navigate(`/lotes/${batch.id}/revisao`);
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao criar lote");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppLayout>
      <div className="p-8 max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Novo lote</h1>
          <p className="text-sm text-muted-foreground mt-1">Envie PDFs ou imagens de folhas de ponto para processamento automático</p>
        </div>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
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
                <input id="files" type="file" multiple accept="application/pdf,image/*" className="hidden" onChange={handleSelect} />
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
      </div>
    </AppLayout>
  );
}
