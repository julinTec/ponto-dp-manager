import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { FuncionarioLayout } from "@/components/FuncionarioLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Plus, Upload, FileText } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const TIPOS = [
  { value: "atestado", label: "Atestado médico" },
  { value: "falta_justificada", label: "Falta justificada" },
  { value: "atraso", label: "Atraso" },
  { value: "saida_antecipada", label: "Saída antecipada" },
  { value: "outro", label: "Outro" },
];

const STATUS_TONE: Record<string, string> = {
  pendente: "bg-warning/15 text-warning border-warning/30",
  aprovada: "bg-success/15 text-success border-success/30",
  recusada: "bg-destructive/15 text-destructive border-destructive/30",
  cancelada: "bg-muted text-muted-foreground",
};

export default function MinhasJustificativas() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState("atestado");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [motivo, setMotivo] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [emp, setEmp] = useState<{ id: string; company_id: string } | null>(null);

  useEffect(() => { if (user) init(); }, [user]);

  async function init() {
    const { data: e } = await supabase
      .from("employees").select("id, company_id").eq("user_id", user!.id).maybeSingle();
    setEmp(e ?? null);
    await load(e?.id);
  }

  async function load(empId?: string) {
    setLoading(true);
    if (!empId) { setItems([]); setLoading(false); return; }
    const { data } = await supabase.from("employee_justifications")
      .select("*").eq("employee_id", empId).order("created_at", { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  }

  async function enviar() {
    if (!emp) return toast.error("Funcionário não vinculado");
    if (!inicio || !fim) return toast.error("Informe o período");
    if (new Date(fim) < new Date(inicio)) return toast.error("Data final inválida");
    setSaving(true);
    try {
      let attachment_path: string | null = null;
      if (file) {
        const path = `${emp.company_id}/justifications/${emp.id}/${crypto.randomUUID()}-${file.name}`;
        const { error } = await supabase.storage.from("employee-docs").upload(path, file, { contentType: file.type });
        if (error) throw error;
        attachment_path = path;
      }
      const { error } = await supabase.from("employee_justifications").insert({
        company_id: emp.company_id, employee_id: emp.id, user_id: user!.id,
        tipo: tipo as any, data_inicio: inicio, data_fim: fim,
        motivo: motivo || null, attachment_path,
      });
      if (error) throw error;
      toast.success("Justificativa enviada");
      setOpen(false); setMotivo(""); setFile(null); setInicio(""); setFim("");
      load(emp.id);
    } catch (e: any) {
      toast.error(e.message ?? "Erro");
    } finally { setSaving(false); }
  }

  return (
    <FuncionarioLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Justificativas</h1>
            <p className="text-sm text-muted-foreground">Envie atestados e justifique ausências</p>
          </div>
          <Button onClick={() => setOpen(true)} size="sm" className="bg-gradient-primary shadow-sm rounded-full"><Plus className="h-4 w-4 mr-1" />Nova</Button>
        </div>

        <Card className="overflow-hidden">
          {loading ? (
            <div className="p-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma justificativa enviada.</div>
          ) : (
            <div className="divide-y">
              {items.map((j) => (
                <div key={j.id} className="p-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm capitalize">{TIPOS.find((t) => t.value === j.tipo)?.label ?? j.tipo}</p>
                      <Badge variant="outline" className={STATUS_TONE[j.status]}>{j.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(j.data_inicio), "dd/MM/yyyy")} → {format(new Date(j.data_fim), "dd/MM/yyyy")}
                    </p>
                    {j.motivo && <p className="text-xs mt-1.5 text-foreground/80">{j.motivo}</p>}
                    {j.reviewer_comment && (
                      <p className="text-xs mt-1 italic text-muted-foreground">Resposta: {j.reviewer_comment}</p>
                    )}
                  </div>
                  {j.attachment_path && <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova justificativa</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><Label>Início</Label><Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} /></div>
                <div className="space-y-1"><Label>Fim</Label><Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} /></div>
              </div>
              <div className="space-y-1">
                <Label>Motivo (opcional)</Label>
                <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} maxLength={500} />
              </div>
              <div className="space-y-1">
                <Label>Anexo (atestado/documento)</Label>
                <label className="flex items-center justify-center border-2 border-dashed rounded-md py-4 cursor-pointer hover:bg-accent/30">
                  <Upload className="h-4 w-4 mr-2 text-muted-foreground" />
                  <span className="text-sm">{file ? file.name : "Selecionar arquivo"}</span>
                  <input type="file" className="hidden" accept="application/pdf,image/*"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={enviar} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Enviar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </FuncionarioLayout>
  );
}
