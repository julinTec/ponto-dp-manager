import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, FileBarChart2, Shield, LogOut, Clock,
  UserCog, UserPlus, FileText, Building2, MapPin, CalendarCheck2, Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { signOut, useAuth } from "@/hooks/useAuth";
import { ReactNode } from "react";

type NavItem = { to: string; label: string; icon: any };

const SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "Visão geral",
    items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Pessoas",
    items: [
      { to: "/funcionarios", label: "Funcionários", icon: Users },
      { to: "/admissoes", label: "Admissões", icon: UserPlus },
      { to: "/documentos", label: "Documentos", icon: FileText },
      { to: "/aprovacoes", label: "Aprovações", icon: Inbox },
    ],
  },
  {
    title: "Ponto",
    items: [
      { to: "/gestor/relatorios-ponto", label: "Gestão de ponto", icon: MapPin },
      { to: "/fechamento", label: "Fechamento mensal", icon: CalendarCheck2 },
      { to: "/relatorios", label: "Relatórios", icon: FileBarChart2 },
    ],
  },
  {
    title: "Empresa",
    items: [{ to: "/gestor/empresa", label: "Configurações", icon: Building2 }],
  },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const { profile, isSuperAdmin, isAdmin, isDp, isGestor } = useAuth();
  const { pathname } = useLocation();

  const isActive = (to: string) =>
    to === "/" ? pathname === "/" : pathname.startsWith(to);

  const showUsuarios = isAdmin || isSuperAdmin || isDp;

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-64 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border/40">
        <div className="p-5 border-b border-sidebar-border/60">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-sidebar-primary to-sidebar-primary/70 flex items-center justify-center shadow-lg shadow-sidebar-primary/20">
              <Clock className="h-5 w-5 text-sidebar-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-base leading-tight text-sidebar-foreground">Fluxor DP</h1>
              <p className="text-[11px] text-sidebar-foreground/60">Plataforma de pessoal</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-5 overflow-y-auto">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <p className="px-3 pb-1 text-[10px] uppercase tracking-wider text-sidebar-foreground/40 font-semibold">
                {section.title}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.to);
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}

          {(showUsuarios || isSuperAdmin) && (
            <div>
              <p className="px-3 pb-1 text-[10px] uppercase tracking-wider text-sidebar-foreground/40 font-semibold">
                Administração
              </p>
              <div className="space-y-0.5">
                {showUsuarios && (
                  <NavLink
                    to="/usuarios"
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                      pathname.startsWith("/usuarios")
                        ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
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
                      pathname.startsWith("/admin")
                        ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                    )}
                  >
                    <Shield className="h-4 w-4" />
                    Super Admin
                  </NavLink>
                )}
              </div>
            </div>
          )}
        </nav>

        <div className="p-3 border-t border-sidebar-border/60">
          <div className="px-3 py-2 mb-2">
            <p className="text-sm font-medium truncate text-sidebar-foreground">{profile?.nome ?? "Usuário"}</p>
            <p className="text-xs text-sidebar-foreground/60 truncate">{profile?.email}</p>
            <p className="text-[10px] uppercase tracking-wide text-sidebar-foreground/50 mt-1">
              {isSuperAdmin ? "Super Admin" : isAdmin ? "Administrador" : isDp ? "DP" : "Equipe"}
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
