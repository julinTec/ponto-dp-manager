import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Clock, Loader2 } from "lucide-react";

const signInSchema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(6, "Mínimo 6 caracteres").max(100),
});

export default function Auth() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = signInSchema.safeParse({
      email: fd.get("email"),
      password: fd.get("password"),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { data: signIn, error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (error || !signIn.user) {
      setLoading(false);
      return toast.error("E-mail ou senha inválidos");
    }
    // Decide destino conforme role
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", signIn.user.id);
    setLoading(false);
    const list = (roles ?? []).map((r: any) => r.role as string);
    const gestaoRoles = ["admin", "super_admin", "dp", "gestor", "revisor"];
    if (list.includes("funcionario") && !list.some((r) => gestaoRoles.includes(r))) {
      navigate("/ponto");
    } else {
      navigate("/");
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-background to-accent/30 p-4">
      <div className="flex items-center gap-3 mb-8">
        <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center shadow-lg">
          <Clock className="h-7 w-7 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Fluxor Ponto</h1>
          <p className="text-sm text-muted-foreground">Gestão de folhas de ponto para DP</p>
        </div>
      </div>

      <Card className="w-full max-w-md p-6 shadow-xl">
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input id="password" name="password" type="password" required autoComplete="current-password" />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Entrar
          </Button>
        </form>
        <p className="text-xs text-muted-foreground text-center mt-6">
          O acesso é criado pelo administrador da sua empresa.
        </p>
      </Card>
    </div>
  );
}
