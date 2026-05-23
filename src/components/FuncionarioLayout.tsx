import { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Clock, History, FileText, FileCheck2, CalendarDays, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { signOut, useAuth } from "@/hooks/useAuth";

const NAV = [
  { to: "/ponto", label: "Ponto", icon: Clock },
  { to: "/meu-historico", label: "Histórico", icon: History },
  { to: "/minhas-justificativas", label: "Justif.", icon: FileCheck2 },
  { to: "/minhas-solicitacoes", label: "Pedidos", icon: CalendarDays },
  { to: "/meus-documentos", label: "Docs", icon: FileText },
];

export function FuncionarioLayout({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-card">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
              <Clock className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <p className="font-semibold text-sm leading-tight">{profile?.nome ?? "Funcionário"}</p>
              <p className="text-[11px] text-muted-foreground">{profile?.email}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-1" /> Sair
          </Button>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto p-4 pb-24">{children}</main>

      <nav className="fixed bottom-0 inset-x-0 border-t bg-card">
        <div className="max-w-3xl mx-auto grid grid-cols-5">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-col items-center gap-1 py-3 text-xs font-medium",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
