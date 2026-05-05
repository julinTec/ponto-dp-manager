import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, FileStack, Users, FileBarChart2, Shield, LogOut, Clock, UserCog, UserPlus, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { signOut, useAuth } from "@/hooks/useAuth";
import { ReactNode } from "react";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/lotes", label: "Lotes", icon: FileStack },
  { to: "/admissoes", label: "Admissões", icon: UserPlus },
  { to: "/funcionarios", label: "Funcionários", icon: Users },
  { to: "/documentos", label: "Documentos", icon: FileText },
  { to: "/relatorios", label: "Relatórios", icon: FileBarChart2 },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const { profile, isSuperAdmin, isAdmin } = useAuth();
  const location = useLocation();

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-64 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-sidebar-primary flex items-center justify-center">
              <Clock className="h-5 w-5 text-sidebar-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-base leading-tight text-sidebar-foreground">Fluxor Ponto</h1>
              <p className="text-[11px] text-sidebar-foreground/60">Departamento Pessoal</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            );
          })}
          {(isAdmin || isSuperAdmin) && (
            <NavLink
              to="/usuarios"
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                location.pathname.startsWith("/usuarios")
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <UserCog className="h-4 w-4" />
              Usuários
            </NavLink>
          )}
          {isSuperAdmin && (
            <NavLink
              to="/admin"
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                location.pathname.startsWith("/admin")
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <Shield className="h-4 w-4" />
              Super Admin
            </NavLink>
          )}
        </nav>

        <div className="p-3 border-t border-sidebar-border">
          <div className="px-3 py-2 mb-2">
            <p className="text-sm font-medium truncate text-sidebar-foreground">{profile?.nome ?? "Usuário"}</p>
            <p className="text-xs text-sidebar-foreground/60 truncate">{profile?.email}</p>
            <p className="text-[10px] uppercase tracking-wide text-sidebar-foreground/50 mt-1">
              {isSuperAdmin ? "Super Admin" : isAdmin ? "Administrador" : "Revisor"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-auto">{children}</main>
    </div>
  );
}
