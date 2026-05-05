import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Loader2, UserPlus, Trash2, Users as UsersIcon } from "lucide-react";

type DbRole = "admin" | "revisor";
type UiRole = "Admin" | "Gerencial";

const dbToUi = (r: DbRole): UiRole => (r === "admin" ? "Admin" : "Gerencial");
const uiToDb = (r: UiRole): DbRole => (r === "Admin" ? "admin" : "revisor");

interface Row {
  user_id: string;
  nome: string | null;
  email: string | null;
  role: DbRole;
  created_at: string;
}

export default function Usuarios() {
  const { isAdmin, isSuperAdmin, profile, loading: authLoading, user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<Row | null>(null);

  // form
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [perfil, setPerfil] = useState<UiRole>("Gerencial");

  const canAccess = isAdmin || isSuperAdmin;

  useEffect(() => {
    if (canAccess && profile?.company_id) load();
  }, [canAccess, profile?.company_id]);

  async function load() {
    setLoading(true);
    const companyId = profile?.company_id;
    if (!companyId) { setLoading(false); return; }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role, created_at, company_id")
      .eq("company_id", companyId)
      .in("role", ["admin", "revisor"]);

    const userIds = Array.from(new Set((roles ?? []).map((r: any) => r.user_id)));
    const { data: profs } = userIds.length
      ? await supabase.from("profiles").select("id, nome, email").in("id", userIds)
      : { data: [] as any[] };

    const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
    const list: Row[] = (roles ?? []).map((r: any) => ({
      user_id: r.user_id,
      role: r.role as DbRole,
      created_at: r.created_at,
      nome: map.get(r.user_id)?.nome ?? null,
      email: map.get(r.user_id)?.email ?? null,
    }));
    list.sort((a, b) => (a.nome ?? "").localeCompare(b.nome ?? ""));
    setRows(list);
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim() || !email.trim() || password.length < 6) {
      toast.error("Preencha todos os campos (senha mínima 6).");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("admin-create-user", {
      body: { nome: nome.trim(), email: email.trim(), password, role: uiToDb(perfil) },
    });
    setSaving(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? "Falha ao criar usuário");
      return;
    }
    toast.success("Usuário criado com sucesso");
    setOpen(false);
    setNome(""); setEmail(""); setPassword(""); setPerfil("Gerencial");
    load();
  }

  async function handleChangeRole(row: Row, novo: UiRole) {
    const novaDb = uiToDb(novo);
    if (novaDb === row.role) return;
    const { error } = await supabase
      .from("user_roles")
      .update({ role: novaDb })
      .eq("user_id", row.user_id)
      .eq("company_id", profile?.company_id ?? "");
    if (error) { toast.error("Falha ao alterar perfil"); return; }
    toast.success("Perfil atualizado");
    load();
  }

  async function handleRemove() {
    if (!removing) return;
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", removing.user_id)
      .eq("company_id", profile?.company_id ?? "");
    setRemoving(null);
    if (error) { toast.error("Falha ao remover acesso"); return; }
    toast.success("Acesso removido");
    load();
  }

  if (authLoading) {
    return <AppLayout><div className="p-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div></AppLayout>;
  }
  if (!canAccess) return <Navigate to="/" replace />;

  return (
    <AppLayout>
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Usuários</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gerencie quem tem acesso à sua empresa.
            </p>
          </div>
          <Button onClick={() => setOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" /> Adicionar usuário
          </Button>
        </div>

        <Card className="overflow-hidden">
          {loading ? (
            <div className="p-12 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center">
              <UsersIcon className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum usuário cadastrado.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-6 py-3">Nome</th>
                  <th className="text-left px-4 py-3">E-mail</th>
                  <th className="text-left px-4 py-3">Perfil</th>
                  <th className="text-left px-4 py-3">Criado em</th>
                  <th className="text-right px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => {
                  const isMe = r.user_id === user?.id;
                  return (
                    <tr key={r.user_id}>
                      <td className="px-6 py-3 font-medium">
                        {r.nome ?? "—"} {isMe && <span className="text-xs text-muted-foreground ml-1">(você)</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{r.email ?? "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Badge variant={r.role === "admin" ? "default" : "secondary"}>
                            {dbToUi(r.role)}
                          </Badge>
                          {!isMe && (
                            <Select
                              value={dbToUi(r.role)}
                              onValueChange={(v) => handleChangeRole(r, v as UiRole)}
                            >
                              <SelectTrigger className="h-7 w-32 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Admin">Admin</SelectItem>
                                <SelectItem value="Gerencial">Gerencial</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!isMe && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setRemoving(r)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>

        <Card className="p-4 bg-muted/30 text-xs text-muted-foreground">
          <p><strong>Admin:</strong> acesso total, incluindo esta página de Usuários.</p>
          <p><strong>Gerencial:</strong> acesso a Lotes, Funcionários e Relatórios. Não vê esta página.</p>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar usuário</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="u-nome">Nome</Label>
              <Input id="u-nome" value={nome} onChange={(e) => setNome(e.target.value)} required maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="u-email">E-mail</Label>
              <Input id="u-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="u-pwd">Senha temporária</Label>
              <Input id="u-pwd" type="text" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
              <p className="text-xs text-muted-foreground">Mínimo 6 caracteres. Compartilhe com o usuário para o primeiro acesso.</p>
            </div>
            <div className="space-y-2">
              <Label>Perfil</Label>
              <Select value={perfil} onValueChange={(v) => setPerfil(v as UiRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Admin">Admin — acesso total</SelectItem>
                  <SelectItem value="Gerencial">Gerencial — sem acesso a Usuários</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Criar usuário
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover acesso?</AlertDialogTitle>
            <AlertDialogDescription>
              {removing?.nome ?? removing?.email} perderá acesso à empresa. A conta continua existindo, mas sem permissões aqui.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
