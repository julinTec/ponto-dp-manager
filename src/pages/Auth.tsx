import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Clock, Loader2, ShieldCheck, Sparkles, BarChart3 } from "lucide-react";
import fluxorLogo from "@/assets/fluxor-logo.png";

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
    const { data: roles } = await supabase
      .from("user_roles").select("role").eq("user_id", signIn.user.id);
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
    <div className="min-h-screen grid lg:grid-cols-2 page-bg">
      {/* Left: brand panel */}
      <aside className="relative hidden lg:flex flex-col justify-between bg-gradient-hero text-primary-foreground p-12 overflow-hidden">
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-primary-glow/30 blur-3xl" />
        <div className="absolute -left-16 -bottom-20 h-72 w-72 rounded-full bg-premium/20 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <div className="h-12 flex items-center justify-center">
            <img src={fluxorLogo} alt="Fluxor" className="h-10 w-auto brightness-0 invert" />
          </div>
          <div>
            <p className="text-xs text-white/70 leading-tight">Departamento Pessoal</p>
            <p className="text-[11px] text-white/50 leading-tight">Inteligência · Gestão · Crescimento</p>
          </div>
        </div>

        <div className="relative max-w-md">
          <span className="inline-flex items-center gap-2 chip bg-white/10 border-white/15 text-white/90 mb-5">
            <Sparkles className="h-3 w-3" /> SaaS premium para DP
          </span>
          <h2 className="text-3xl font-bold leading-tight tracking-tight">
            O Departamento Pessoal moderno, em um único lugar.
          </h2>
          <p className="mt-3 text-white/70 text-sm">
            Admissão com IA, ponto geolocalizado, fechamento mensal e aprovações
            — tudo com o rigor que a CLT exige e a fluidez que o seu time espera.
          </p>

          <ul className="mt-6 space-y-3 text-sm">
            {[
              { icon: ShieldCheck, label: "Conformidade CLT e LGPD por padrão" },
              { icon: BarChart3, label: "Indicadores em tempo real" },
              { icon: Sparkles, label: "Admissão automatizada com IA" },
            ].map((f) => (
              <li key={f.label} className="flex items-center gap-3 text-white/80">
                <span className="h-7 w-7 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center">
                  <f.icon className="h-3.5 w-3.5" />
                </span>
                {f.label}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-[11px] text-white/40">© {new Date().getFullYear()} Fluxor · Todos os direitos reservados</p>
      </aside>

      {/* Right: form */}
      <main className="flex flex-col items-center justify-center p-6 sm:p-12">
        <div className="lg:hidden flex items-center gap-3 mb-8">
          <div className="h-12 flex items-center justify-center">
            <img src={fluxorLogo} alt="Fluxor" className="h-10 w-auto" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground leading-tight">Departamento Pessoal</p>
            <p className="text-[11px] text-muted-foreground/70 leading-tight">Inteligência · Gestão · Crescimento</p>
          </div>
        </div>

        <div className="w-full max-w-md">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-foreground tracking-tight">Entrar na plataforma</h2>
            <p className="text-sm text-muted-foreground mt-1.5">Use seu e-mail corporativo para acessar o painel.</p>
          </div>

          <div className="surface-elevated p-6 sm:p-7">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium">E-mail</Label>
                <Input id="email" name="email" type="email" required autoComplete="email" placeholder="voce@empresa.com" className="h-11" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-medium">Senha</Label>
                <Input id="password" name="password" type="password" required autoComplete="current-password" placeholder="••••••••" className="h-11" />
              </div>
              <Button type="submit" className="w-full h-11 bg-gradient-primary hover:opacity-95 shadow-sm" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Entrar
              </Button>
            </form>
          </div>

          <p className="text-xs text-muted-foreground text-center mt-6">
            O acesso é criado pelo administrador da sua empresa.
          </p>
        </div>
      </main>
    </div>
  );
}
