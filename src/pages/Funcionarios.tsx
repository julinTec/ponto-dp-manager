import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, Users as UsersIcon, CheckCircle2, Trash2 } from "lucide-react";
import { CompanyFilter, CompanyPicker } from "@/components/CompanyFilter";
import { toast } from "sonner";

interface Employee {
  id: string; nome: string; cpf: string | null; funcao: string | null;
  status: "ativo" | "pendente_validacao" | "inativo";
  jornada_padrao_horas: number | null;
}

export default function Funcionarios() {
  const { profile, isAdmin, isSuperAdmin } = useAuth();
  const canEdit = isAdmin || isSuperAdmin;
  const [list, setList] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [companyFilter, setCompanyFilter] = useState<string | null>(null);
  const [createCompanyId, setCreateCompanyId] = useState<string | null>(null);

  useEffect(() => { load(); }, [companyFilter]);

  async function load() {
    setLoading(true);
    let q = supabase.from("employees").select("*").order("nome");
    if (companyFilter) q = q.eq("company_id", companyFilter);
    const { data } = await q;
    setList((data ?? []) as Employee[]);
    setLoading(false);
  }

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      nome: String(fd.get("nome") ?? "").trim(),
      cpf: String(fd.get("cpf") ?? "").trim() || null,
      funcao: String(fd.get("funcao") ?? "").trim() || null,
      jornada_padrao_horas: parseFloat(String(fd.get("jornada") ?? "8")) || 8,
      status: "ativo" as const,
    };
    if (!payload.nome) return toast.error("Nome obrigatório");
    if (editing) {
      const { error } = await supabase.from("employees").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
    } else {
      const company_id = isSuperAdmin ? createCompanyId : profile?.company_id;
      if (!company_id) return toast.error("Selecione a empresa");
      const { error } = await supabase.from("employees").insert({ ...payload, company_id });
      if (error) return toast.error(error.message);
    }
    toast.success("Funcionário salvo");
    setOpen(false); setEditing(null); setCreateCompanyId(null); load();
  }

  async function validar(emp: Employee) {
    await supabase.from("employees").update({ status: "ativo" }).eq("id", emp.id);
    toast.success("Funcionário validado");
    load();
  }

  async function remover(emp: Employee) {
    if (!confirm(`Excluir ${emp.nome}?`)) return;
    const { error } = await supabase.from("employees").delete().eq("id", emp.id);
    if (error) return toast.error(error.message);
    toast.success("Removido");
    load();
  }

  const ativos = list.filter((e) => e.status === "ativo");
  const pendentes = list.filter((e) => e.status === "pendente_validacao");

  function renderTable(items: Employee[], pendentesView = false) {
    if (loading) return <div className="p-12 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>;
    if (items.length === 0) return (
      <div className="p-12 text-center">
        <UsersIcon className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-foreground font-medium">{pendentesView ? "Nenhum funcionário pendente" : "Nenhum funcionário cadastrado"}</p>
      </div>
    );
    return (
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="text-left px-6 py-3 font-medium">Nome</th>
            <th className="text-left px-4 py-3 font-medium">CPF</th>
            <th className="text-left px-4 py-3 font-medium">Função</th>
            <th className="text-left px-4 py-3 font-medium">Jornada</th>
            <th className="text-right px-4 py-3 font-medium">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((e) => (
            <tr key={e.id} className="hover:bg-muted/30">
              <td className="px-6 py-3 font-medium text-foreground">
                {e.nome}
                {e.status === "pendente_validacao" && <Badge variant="outline" className="ml-2 bg-warning/15 text-warning border-warning/30">Pendente</Badge>}
              </td>
              <td className="px-4 py-3 text-muted-foreground">{e.cpf ?? "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">{e.funcao ?? "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">{e.jornada_padrao_horas ?? 8}h</td>
              <td className="px-4 py-3 text-right space-x-2">
                {canEdit && pendentesView && (
                  <Button size="sm" variant="outline" onClick={() => validar(e)}>
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Validar
                  </Button>
                )}
                {canEdit && (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => { setEditing(e); setOpen(true); }}>Editar</Button>
                    <Button size="sm" variant="ghost" onClick={() => remover(e)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <AppLayout>
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <PageHeader
          title="Funcionários"
          subtitle="Cadastro e validação de funcionários"
          actions={
            <div className="flex items-center gap-2">
              <CompanyFilter value={companyFilter} onChange={setCompanyFilter} />
              {canEdit && <Button onClick={() => { setEditing(null); setCreateCompanyId(null); setOpen(true); }}><Plus className="h-4 w-4 mr-2" />Novo</Button>}
            </div>
          }
        />

        <Tabs defaultValue="ativos">
          <TabsList>
            <TabsTrigger value="ativos">Ativos ({ativos.length})</TabsTrigger>
            <TabsTrigger value="pendentes">Pendentes de validação ({pendentes.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="ativos"><Card className="overflow-hidden">{renderTable(ativos)}</Card></TabsContent>
          <TabsContent value="pendentes"><Card className="overflow-hidden">{renderTable(pendentes, true)}</Card></TabsContent>
        </Tabs>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Editar funcionário" : "Novo funcionário"}</DialogTitle></DialogHeader>
            <form onSubmit={save} className="space-y-4">
              {!editing && isSuperAdmin && (
                <div className="space-y-2">
                  <Label>Empresa</Label>
                  <CompanyPicker value={createCompanyId} onChange={setCreateCompanyId} />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="nome">Nome</Label>
                <Input id="nome" name="nome" defaultValue={editing?.nome} required maxLength={150} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="cpf">CPF</Label>
                  <Input id="cpf" name="cpf" defaultValue={editing?.cpf ?? ""} maxLength={14} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="funcao">Função</Label>
                  <Input id="funcao" name="funcao" defaultValue={editing?.funcao ?? ""} maxLength={100} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="jornada">Jornada padrão (horas/dia)</Label>
                <Input id="jornada" name="jornada" type="number" step="0.5" defaultValue={editing?.jornada_padrao_horas ?? 8} />
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit">Salvar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
