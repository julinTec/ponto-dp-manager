import { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Clock, History, FileText, FileCheck2, CalendarDays, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { signOut, useAuth } from "@/hooks/useAuth";
import fluxorLogo from "@/assets/fluxor-logo.png";

const NAV = [
  { to: "/ponto", label: "Ponto", icon: Clock },
  { to: "/meu-historico", label: "Histórico", icon: History },
  { to: "/minhas-justificativas", label: "Justif.", icon: FileCheck2 },
  { to: "/minhas-solicitacoes", label: "Pedidos", icon: CalendarDays },
  { to: "/meus-documentos", label: "Docs", icon: FileText },
];

function initials(name?: string | null) {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "U";
}

export function FuncionarioLayout({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen flex flex-col page-bg">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-card/85 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 px-2.5 rounded-xl bg-white border border-border flex items-center justify-center shadow-sm shrink-0">
              <img src={fluxorLogo} alt="Fluxor" className="h-5 w-auto" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm leading-tight text-foreground truncate">{profile?.nome ?? "Funcionário"}</p>
              <p className="text-[11px] text-muted-foreground truncate">{profile?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex h-9 w-9 rounded-full bg-gradient-primary text-primary-foreground items-center justify-center text-xs font-semibold">
              {initials(profile?.nome)}
            </div>
            <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground hover:text-foreground">
              <LogOut className="h-4 w-4 mr-1" /> Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto p-4 pb-28 animate-fade-in-up">{children}</main>

      <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-border/70 bg-card/90 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-3xl mx-auto grid grid-cols-5 px-2 py-2">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-medium transition-colors",
                  active ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <Icon className={cn("h-[20px] w-[20px]", active && "text-primary")} />
                {item.label}
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
