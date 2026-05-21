import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Copy, CheckCircle2 } from "lucide-react";

interface EmployeeOpt {
  id: string;
  nome: string;
  cargo: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}

export function AddFuncionarioDialog({ open, onOpenChange, onCreated }: Props) {
  const { profile } = useAuth();
  const [tab, setTab] = useState<"existente" | "novo">("existente");
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState<EmployeeOpt[]>([]);
  const [loadingEmps, setLoadingEmps] = useState(false);

  // form
  const [employeeId, setEmployeeId] = useState("");
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [cargo, setCargo] = useState("");
  const [jornada, setJornada] = useState("8");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);

  useEffect(() => {
    if (open && profile?.company_id) loadAvailableEmployees();
    if (!open) reset();
  }, [open, profile?.company_id]);

  function reset() {
    setTab("existente");
    setEmployeeId(""); setNome(""); setCpf(""); setCargo("");
    setJornada("8"); setEmail(""); setPassword("");
    setCredentials(null);
  }

  async function loadAvailableEmployees() {
    setLoadingEmps(true);
    const { data } = await supabase
      .from("employees")
      .select("id, nome, cargo")
      .eq("company_id", profile!.company_id!)
      .is("user_id", null)
      .order("nome");
    setEmployees((data ?? []) as EmployeeOpt[]);
    setLoadingEmps(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || password.length < 6) {
      toast.error("Informe e-mail e senha (mínimo 6 caracteres).");
      return;
    }

    let payload: any = {
      email: email.trim(),
      password,
      role: "funcionario",
    };

    if (tab === "existente") {
      if (!employeeId) return toast.error("Selecione um funcionário");
      const emp = employees.find((e) => e.id === employeeId);
      payload.nome = emp?.nome ?? "Funcionário";
      payload.employee_id = employeeId;
    } else {
      if (!nome.trim()) return toast.error("Informe o nome");
      payload.nome = nome.trim();
      payload.employee_data = {
        nome: nome.trim(),
        cpf: cpf.trim() || null,
        cargo: cargo.trim() || null,
        jornada_padrao_horas: parseFloat(jornada) || 8,
      };
    }

    setSaving(true);
    const { data, error } = await supabase.functions.invoke("admin-create-user", {
      body: payload,
    });
    setSaving(false);

    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? "Falha ao criar funcionário");
      return;
    }
    toast.success("Funcionário criado com sucesso");
    setCredentials({ email: email.trim(), password });
    onCreated();
  }

  function copyInstructions() {
    if (!credentials) return;
    const link = `${window.location.origin}/auth`;
    const text =
`Seu acesso ao sistema de ponto:

Link: ${link}
E-mail: ${credentials.email}
Senha temporária: ${credentials.password}

Acesse pelo celular e bata seu ponto quando estiver no local da empresa.`;
    navigator.clipboard.writeText(text);
    toast.success("Instruções copiadas");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {credentials ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                Acesso criado
              </DialogTitle>
              <DialogDescription>
                Envie estas credenciais ao funcionário. Ele poderá bater ponto pelo celular.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="rounded-md border bg-muted/30 p-3 space-y-2 text-sm">
                <div><span className="text-muted-foreground">Link: </span><span className="font-mono">{window.location.origin}/auth</span></div>
                <div><span className="text-muted-foreground">E-mail: </span><span className="font-medium">{credentials.email}</span></div>
                <div><span className="text-muted-foreground">Senha: </span><span className="font-mono">{credentials.password}</span></div>
              </div>
              <Button type="button" variant="outline" className="w-full" onClick={copyInstructions}>
                <Copy className="h-4 w-4 mr-2" /> Copiar instruções
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Concluir</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Adicionar funcionário</DialogTitle>
              <DialogDescription>
                Cria um acesso para o funcionário bater ponto pelo celular.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="existente">Vincular existente</TabsTrigger>
                  <TabsTrigger value="novo">Criar novo</TabsTrigger>
                </TabsList>

                <TabsContent value="existente" className="space-y-2 pt-3">
                  <Label>Funcionário</Label>
                  {loadingEmps ? (
                    <div className="text-sm text-muted-foreground py-2 flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
                    </div>
                  ) : employees.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhum funcionário sem acesso. Cadastre em Funcionários ou use "Criar novo".
                    </p>
                  ) : (
                    <Select value={employeeId} onValueChange={setEmployeeId}>
                      <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                      <SelectContent>
                        {employees.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.nome}{e.cargo ? ` — ${e.cargo}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </TabsContent>

                <TabsContent value="novo" className="space-y-3 pt-3">
                  <div className="space-y-2">
                    <Label htmlFor="f-nome">Nome</Label>
                    <Input id="f-nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={100} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="f-cpf">CPF</Label>
                      <Input id="f-cpf" value={cpf} onChange={(e) => setCpf(e.target.value)} maxLength={20} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="f-jornada">Jornada (h)</Label>
                      <Input id="f-jornada" type="number" step="0.5" min="1" max="24" value={jornada} onChange={(e) => setJornada(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="f-cargo">Cargo</Label>
                    <Input id="f-cargo" value={cargo} onChange={(e) => setCargo(e.target.value)} maxLength={100} />
                  </div>
                </TabsContent>
              </Tabs>

              <div className="border-t pt-3 space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="f-email">E-mail de acesso</Label>
                  <Input id="f-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="f-pwd">Senha temporária</Label>
                  <Input id="f-pwd" type="text" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
                  <p className="text-xs text-muted-foreground">Mínimo 6 caracteres. Você poderá copiar e enviar ao funcionário no próximo passo.</p>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Criar acesso
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
