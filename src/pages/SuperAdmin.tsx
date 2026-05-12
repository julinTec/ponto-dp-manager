import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Building2, Plus, Pencil, Trash2, Power } from "lucide-react";
import { Navigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { clearCompaniesCache } from "@/components/CompanyFilter";

interface Company {
  id: string;
  nome: string;
  cnpj: string | null;
  ativo: boolean;
  created_at: string;
}

function maskCnpj(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export default function SuperAdmin() {
  const { isSuperAdmin, loading: authLoading } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [saving, setSaving] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<Company | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { if (isSuperAdmin) load(); }, [isSuperAdmin]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("companies").select("*").order("created_at", { ascending: false });
    setCompanies((data ?? []) as Company[]);
    setLoading(false);
  }

  function openNew() {
    setEditing(null);
    setNome(""); setCnpj(""); setAtivo(true);
    setDialogOpen(true);
  }

  function openEdit(c: Company) {
    setEditing(c);
    setNome(c.nome); setCnpj(c.cnpj ?? ""); setAtivo(c.ativo);
    setDialogOpen(true);
  }

  async function handleSave() {
    const nomeTrim = nome.trim();
    if (nomeTrim.length < 2) {
      toast({ title: "Nome inválido", description: "Mínimo 2 caracteres.", variant: "destructive" });
      return;
    }
    const cnpjDigits = cnpj.replace(/\D/g, "");
    if (cnpjDigits && cnpjDigits.length !== 14) {
      toast({ title: "CNPJ inválido", description: "Deve ter 14 dígitos.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      nome: nomeTrim,
      cnpj: cnpjDigits ? maskCnpj(cnpjDigits) : null,
      ativo,
    };
    const { error } = editing
      ? await supabase.from("companies").update(payload).eq("id", editing.id)
      : await supabase.from("companies").insert(payload);
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: editing ? "Empresa atualizada" : "Empresa criada" });
    setDialogOpen(false);
    clearCompaniesCache();
    load();
  }

  async function toggleAtivo(c: Company) {
    const { error } = await supabase.from("companies").update({ ativo: !c.ativo }).eq("id", c.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    clearCompaniesCache();
    load();
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    const cid = confirmDelete.id;
    // Verifica vínculos
    const [{ count: pCount }, { count: eCount }, { count: bCount }] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("company_id", cid),
      supabase.from("employees").select("*", { count: "exact", head: true }).eq("company_id", cid),
      supabase.from("timesheet_batches").select("*", { count: "exact", head: true }).eq("company_id", cid),
    ]);
    const total = (pCount ?? 0) + (eCount ?? 0) + (bCount ?? 0);
    if (total > 0) {
      setDeleting(false);
      setConfirmDelete(null);
      toast({
        title: "Não é possível excluir",
        description: `Empresa tem ${pCount ?? 0} usuário(s), ${eCount ?? 0} funcionário(s) e ${bCount ?? 0} lote(s) vinculados.`,
        variant: "destructive",
      });
      return;
    }
    const { error } = await supabase.from("companies").delete().eq("id", cid);
    setDeleting(false);
    setConfirmDelete(null);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Empresa excluída" });
    clearCompaniesCache();
    load();
  }

  if (authLoading) return <AppLayout><div className="p-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div></AppLayout>;
  if (!isSuperAdmin) return <Navigate to="/" />;

  return (
    <AppLayout>
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Super Admin</h1>
            <p className="text-sm text-muted-foreground mt-1">Gestão global de empresas</p>
          </div>
          <Button onClick={openNew}><Plus className="h-4 w-4" /> Nova empresa</Button>
        </div>

        <Card className="overflow-hidden">
          {loading ? (
            <div className="p-12 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
          ) : companies.length === 0 ? (
            <div className="p-12 text-center">
              <Building2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Nenhuma empresa cadastrada</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-6 py-3">Empresa</th>
                  <th className="text-left px-4 py-3">CNPJ</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Criada em</th>
                  <th className="text-right px-6 py-3">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {companies.map((c) => (
                  <tr key={c.id}>
                    <td className="px-6 py-3 font-medium">{c.nome}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.cnpj ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={c.ativo ? "text-green-600" : "text-muted-foreground"}>
                        {c.ativo ? "Ativa" : "Suspensa"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(c.created_at).toLocaleDateString("pt-BR")}</td>
                    <td className="px-6 py-3">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => toggleAtivo(c)} title={c.ativo ? "Suspender" : "Ativar"}>
                          <Power className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => openEdit(c)} title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setConfirmDelete(c)} title="Excluir">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar empresa" : "Nova empresa"}</DialogTitle>
            <DialogDescription>
              {editing ? "Atualize os dados da empresa." : "Cadastre uma nova empresa no sistema."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} placeholder="Razão social ou nome fantasia" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input id="cnpj" value={cnpj} onChange={(e) => setCnpj(maskCnpj(e.target.value))} placeholder="00.000.000/0000-00" />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="ativo">Empresa ativa</Label>
              <Switch id="ativo" checked={ativo} onCheckedChange={setAtivo} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir empresa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. A empresa "{confirmDelete?.nome}" será removida permanentemente.
              Só é possível excluir empresas sem usuários, funcionários ou lotes vinculados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
