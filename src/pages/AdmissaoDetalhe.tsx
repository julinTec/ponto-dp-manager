import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, RefreshCw, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";

const STATUS_DOC: Record<string, string> = {
  recebido: "Recebido", pendente: "Pendente", rejeitado: "Rejeitado", em_analise: "Em análise",
};
const TONE_DOC: Record<string, string> = {
  recebido: "bg-success/15 text-success border-success/30",
  pendente: "bg-warning/15 text-warning border-warning/30",
  rejeitado: "bg-destructive/15 text-destructive border-destructive/30",
  em_analise: "bg-info/15 text-info border-info/30",
};
const TIPO_LABEL: Record<string, string> = {
  ficha: "Ficha", rg: "RG", cpf: "CPF", comprovante_residencia: "Comp. residência",
  ctps: "CTPS", contrato: "Contrato", exame_admissional: "Exame admissional", outro: "Outro",
};

export default function AdmissaoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [admission, setAdmission] = useState<any>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (id) load(); }, [id]);

  // Realtime: atualiza docs quando OCR concluir
  useEffect(() => {
    if (!id) return;
    const ch = supabase.channel(`adm-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "admission_documents", filter: `admission_id=eq.${id}` }, () => load(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "employee_admissions", filter: `id=eq.${id}` }, () => load(true))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    const [{ data: a }, { data: d }] = await Promise.all([
      supabase.from("employee_admissions").select("*").eq("id", id!).single(),
      supabase.from("admission_documents").select("*").eq("admission_id", id!).order("created_at"),
    ]);
    setAdmission(a);
    setDocs(d ?? []);
    if (a) {
      const ex: any = a.dados_extraidos ?? {};
      setForm((prev: any) => ({
        nome: prev.nome ?? ex.nome ?? "",
        cpf: prev.cpf ?? ex.cpf ?? "",
        rg: prev.rg ?? ex.rg ?? "",
        data_nascimento: prev.data_nascimento ?? ex.data_nascimento ?? "",
        endereco: prev.endereco ?? ex.endereco ?? "",
        telefone: prev.telefone ?? ex.telefone ?? "",
        email: prev.email ?? ex.email ?? "",
        cargo: prev.cargo ?? ex.cargo ?? "",
        admission_date: prev.admission_date ?? ex.admission_date ?? "",
        salario: prev.salario ?? ex.salario ?? "",
        jornada_padrao_horas: prev.jornada_padrao_horas ?? ex.jornada_padrao_horas ?? 8,
        work_schedule_type: prev.work_schedule_type ?? "5x2",
      }));
    }
    if (!loading && !silent) setLoading(false);
    if (!silent) setLoading(false);
  }

  async function reprocessar(docId: string) {
    await supabase.functions.invoke("ocr-admission-doc", { body: { admission_document_id: docId } });
    toast.info("Reprocessando documento...");
    load(true);
  }

  async function alterarChecklist(docId: string, status: string) {
    await supabase.from("admission_documents").update({ checklist_status: status as any }).eq("id", docId);
    load(true);
  }

  async function removerDoc(docId: string, path: string) {
    if (!confirm("Remover este documento?")) return;
    await supabase.storage.from("employee-docs").remove([path]).catch(() => null);
    await supabase.from("admission_documents").delete().eq("id", docId);
    load();
  }

  async function aprovar() {
    if (!form.nome) return toast.error("Nome obrigatório");
    if (!profile?.company_id) return;
    setSaving(true);
    try {
      const empPayload: any = {
        company_id: admission.company_id,
        nome: form.nome,
        cpf: form.cpf || null,
        rg: form.rg || null,
        data_nascimento: form.data_nascimento || null,
        endereco: form.endereco || null,
        telefone: form.telefone || null,
        email: form.email || null,
        cargo: form.cargo || null,
        funcao: form.cargo || null,
        admission_date: form.admission_date || null,
        salario: form.salario ? parseFloat(form.salario) : null,
        jornada_padrao_horas: form.jornada_padrao_horas ? parseFloat(form.jornada_padrao_horas) : 8,
        work_schedule_type: form.work_schedule_type || null,
        status: "ativo",
      };

      let employeeId = admission.employee_id;
      if (employeeId) {
        await supabase.from("employees").update(empPayload).eq("id", employeeId);
      } else {
        const { data: e, error: eErr } = await supabase.from("employees").insert(empPayload).select().single();
        if (eErr) throw eErr;
        employeeId = e.id;
      }
      await supabase.from("employee_admissions")
        .update({ status: "aprovado", employee_id: employeeId, dados_extraidos: { ...admission.dados_extraidos, ...form } })
        .eq("id", id!);
      toast.success("Admissão aprovada e funcionário cadastrado");
      navigate("/funcionarios");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao aprovar admissão");
    } finally {
      setSaving(false);
    }
  }

  async function rejeitar() {
    if (!confirm("Rejeitar esta admissão?")) return;
    await supabase.from("employee_admissions").update({ status: "rejeitado" }).eq("id", id!);
    toast.success("Admissão rejeitada");
    navigate("/admissoes");
  }

  if (loading) return <AppLayout><div className="p-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div></AppLayout>;
  if (!admission) return <AppLayout><div className="p-12">Admissão não encontrada</div></AppLayout>;

  const checklistPendentes = docs.filter((d) => d.checklist_status !== "recebido").length;

  return (
    <AppLayout>
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <PageHeader
          title={form.nome || "Admissão sem nome"}
          subtitle={`${docs.length} documento(s) · ${checklistPendentes} pendente(s)`}
          actions={
            admission.status === "em_analise" && (
              <>
                <Button variant="outline" onClick={rejeitar}>Rejeitar</Button>
                <Button onClick={aprovar} disabled={saving} className="bg-gradient-primary shadow-sm">
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <CheckCircle2 className="h-4 w-4 mr-1" />Aprovar e cadastrar
                </Button>
              </>
            )
          }
        />

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Documentos */}
          <Card className="overflow-hidden">
            <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between bg-gradient-to-r from-muted/30 to-transparent">
              <div>
                <h2 className="font-semibold">Checklist de documentos</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{docs.length} arquivos · {checklistPendentes} pendentes</p>
              </div>
            </div>
            {docs.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Nenhum documento</div>
            ) : (
              <div className="divide-y">
                {docs.map((d) => (
                  <div key={d.id} className="px-5 py-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium text-sm flex-1 truncate">{d.original_name}</span>
                      <Badge variant="outline" className="text-[10px]">{TIPO_LABEL[d.tipo] ?? d.tipo}</Badge>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={`text-[10px] ${TONE_DOC[d.checklist_status]}`}>
                        {STATUS_DOC[d.checklist_status]}
                      </Badge>
                      {d.ocr_status === "processando" && <span className="text-[11px] text-info flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Lendo...</span>}
                      {d.ocr_status === "concluido" && <ConfidenceBadge value={d.confianca} />}
                      {d.ocr_status === "falhou" && <span className="text-[11px] text-destructive">Falhou: {d.erro}</span>}
                      <Select value={d.checklist_status} onValueChange={(v) => alterarChecklist(d.id, v)}>
                        <SelectTrigger className="h-7 w-32 text-xs ml-auto"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_DOC).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => reprocessar(d.id)}><RefreshCw className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => removerDoc(d.id, d.storage_path)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Cadastro pré-preenchido */}
          <Card className="p-5 space-y-4">
            <div>
              <h2 className="font-semibold">Dados do funcionário</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Revise os dados extraídos pela IA antes de aprovar</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Field label="Nome completo *" v={form.nome} on={(v) => setForm({ ...form, nome: v })} colSpan="col-span-2" />
              <Field label="CPF" v={form.cpf} on={(v) => setForm({ ...form, cpf: v })} />
              <Field label="RG" v={form.rg} on={(v) => setForm({ ...form, rg: v })} />
              <Field label="Data de nascimento" v={form.data_nascimento} on={(v) => setForm({ ...form, data_nascimento: v })} type="date" />
              <Field label="Telefone" v={form.telefone} on={(v) => setForm({ ...form, telefone: v })} />
              <Field label="E-mail" v={form.email} on={(v) => setForm({ ...form, email: v })} type="email" colSpan="col-span-2" />
              <Field label="Endereço" v={form.endereco} on={(v) => setForm({ ...form, endereco: v })} colSpan="col-span-2" />
              <Field label="Cargo / função" v={form.cargo} on={(v) => setForm({ ...form, cargo: v })} />
              <Field label="Data de admissão" v={form.admission_date} on={(v) => setForm({ ...form, admission_date: v })} type="date" />
              <Field label="Jornada diária (h)" v={form.jornada_padrao_horas} on={(v) => setForm({ ...form, jornada_padrao_horas: v })} type="number" />
              <Field label="Salário (R$)" v={form.salario} on={(v) => setForm({ ...form, salario: v })} type="number" />
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Tipo de escala</Label>
                <Select value={form.work_schedule_type ?? "5x2"} onValueChange={(v) => setForm({ ...form, work_schedule_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5x2">5x2</SelectItem>
                    <SelectItem value="6x1">6x1</SelectItem>
                    <SelectItem value="12x36">12x36</SelectItem>
                    <SelectItem value="escala">Escala</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}

function Field({ label, v, on, type = "text", colSpan = "" }: { label: string; v: any; on: (v: string) => void; type?: string; colSpan?: string; }) {
  return (
    <div className={`space-y-1.5 ${colSpan}`}>
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={v ?? ""} onChange={(e) => on(e.target.value)} className="h-9" />
    </div>
  );
}
