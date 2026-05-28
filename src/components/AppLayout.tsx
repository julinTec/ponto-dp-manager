import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, FileBarChart2, Shield, LogOut, Clock,
  UserCog, UserPlus, FileText, Building2, MapPin, CalendarCheck2, Inbox,
  Search, Bell, Menu, X, ChevronsLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { signOut, useAuth } from "@/hooks/useAuth";
import { ReactNode, useState } from "react";
import fluxorLogo from "@/assets/fluxor-logo.png";
import { CompanySwitcher } from "@/components/CompanySwitcher";

type NavItem = { to: string; label: string; icon: any };

const SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "Visão geral",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/", label: "Empresa / Configurações", icon: Building2 },
    ],
  },
  {
    title: "Pessoas",
    items: [
      { to: "/admissoes", label: "Admissões", icon: UserPlus },
      { to: "/funcionarios", label: "Funcionários", icon: Users },
      { to: "/documentos", label: "Documentos", icon: FileText },
      { to: "/aprovacoes", label: "Aprovações", icon: Inbox },
    ],
  },
  {
    title: "Ponto",
    items: [
      { to: "/gestor/relatorios-ponto", label: "Gestão de ponto", icon: MapPin },
      { to: "/lotes", label: "Lotes de folhas", icon: FileStack },
      { to: "/fechamento", label: "Fechamento mensal", icon: CalendarCheck2 },
      { to: "/relatorios", label: "Relatórios", icon: FileBarChart2 },
    ],
  },
];

function initials(name?: string | null) {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "U";
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { profile, isSuperAdmin, isAdmin, isDp, isGestor } = useAuth();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (to: string) =>
    to === "/" ? pathname === "/" : pathname.startsWith(to);

  const showUsuarios = isAdmin || isSuperAdmin || isDp;
  const roleLabel = isSuperAdmin ? "Super Admin" : isAdmin ? "Administrador" : isDp ? "DP" : isGestor ? "Gestor" : "Equipe";

  const Nav = (
    <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto nice-scroll">
      {SECTIONS.map((section) => (
        <div key={section.title}>
          <p className="px-3 pb-2 text-[10px] uppercase tracking-[0.12em] text-sidebar-foreground/40 font-semibold">
            {section.title}
          </p>
          <div className="space-y-1">
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.to);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "group relative flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                      : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                  )}
                >
                  {active && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-sidebar-primary" />
                  )}
                  <Icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-sidebar-primary" : "text-sidebar-foreground/60 group-hover:text-sidebar-foreground")} />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        </div>
      ))}

      {(showUsuarios || isSuperAdmin) && (
        <div>
          <p className="px-3 pb-2 text-[10px] uppercase tracking-[0.12em] text-sidebar-foreground/40 font-semibold">
            Administração
          </p>
          <div className="space-y-1">
            {showUsuarios && (
              <NavLink
                to="/usuarios"
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "group relative flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all",
                  pathname.startsWith("/usuarios")
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                )}
              >
                {pathname.startsWith("/usuarios") && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-sidebar-primary" />
                )}
                <UserCog className="h-[18px] w-[18px] shrink-0" />
                Usuários
              </NavLink>
            )}
            {isSuperAdmin && (
              <NavLink
                to="/admin"
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "group relative flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all",
                  pathname.startsWith("/admin")
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                )}
              >
                {pathname.startsWith("/admin") && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-sidebar-primary" />
                )}
                <Shield className="h-[18px] w-[18px] shrink-0" />
                Super Admin
              </NavLink>
            )}
          </div>
        </div>
      )}
    </nav>
  );

  const Brand = (
    <div className="px-5 pt-5 pb-4 border-b border-sidebar-border/60">
      <div className="flex items-center gap-3">
        <div className="h-12 flex items-center justify-center">
          <img src={fluxorLogo} alt="Fluxor" className="h-9 w-auto brightness-0 invert" />
        </div>
        <div>
          <p className="text-[11px] text-sidebar-foreground/50 leading-tight">Departamento Pessoal</p>
          <p className="text-[11px] text-sidebar-foreground/40 leading-tight">Inteligência · Gestão · Crescimento</p>
        </div>
      </div>
    </div>
  );

  const Footer = (
    <div className="p-3 border-t border-sidebar-border/60">
      <div className="flex items-center gap-3 px-2 py-2 rounded-xl">
        <div className="h-9 w-9 rounded-full bg-gradient-primary text-primary-foreground flex items-center justify-center text-sm font-semibold shrink-0 shadow-sm">
          {initials(profile?.nome)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate text-sidebar-foreground">{profile?.nome ?? "Usuário"}</p>
          <p className="text-[11px] text-sidebar-foreground/50 truncate">{roleLabel}</p>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={signOut}
        className="w-full justify-start text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground mt-1"
      >
        <LogOut className="h-4 w-4 mr-2" />
        Sair
      </Button>
    </div>
  );

  return (
    <div className="flex min-h-screen page-bg">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 bg-gradient-sidebar text-sidebar-foreground flex-col border-r border-sidebar-border/40 sticky top-0 h-screen">
        {Brand}
        {Nav}
        {Footer}
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-72 bg-gradient-sidebar text-sidebar-foreground flex flex-col h-full shadow-2xl animate-fade-in-up">
            <div className="flex items-center justify-between px-5 pt-4">
              <span className="text-xs uppercase tracking-wider text-sidebar-foreground/50">Menu</span>
              <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)} className="h-8 w-8 text-sidebar-foreground/70 hover:bg-sidebar-accent">
                <X className="h-4 w-4" />
              </Button>
            </div>
            {Brand}
            {Nav}
            {Footer}
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Topbar */}
        <header className="h-16 sticky top-0 z-30 bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/70 border-b border-border/70 flex items-center gap-3 px-4 sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden h-9 w-9" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="hidden md:flex items-center gap-2 flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="search"
                placeholder="Buscar funcionários, documentos, lotes…"
                className="w-full h-9 pl-9 pr-3 rounded-xl bg-muted/60 border border-transparent text-sm placeholder:text-muted-foreground focus:bg-card focus:border-border focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all"
              />
            </div>
          </div>
          <div className="flex-1 md:hidden" />
          <div className="flex items-center gap-2">
            <CompanySwitcher />
            <Button variant="ghost" size="icon" className="h-9 w-9 relative">
              <Bell className="h-4 w-4" />
            </Button>
            <div className="hidden sm:flex items-center gap-2 pl-2 ml-1 border-l border-border/70">
              <div className="h-8 w-8 rounded-full bg-gradient-primary text-primary-foreground flex items-center justify-center text-xs font-semibold">
                {initials(profile?.nome)}
              </div>
              <div className="hidden xl:block leading-tight">
                <p className="text-xs font-medium text-foreground truncate max-w-[140px]">{profile?.nome ?? "Usuário"}</p>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{roleLabel}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 min-w-0 overflow-auto nice-scroll">
          <div className="animate-fade-in-up">{children}</div>
        </main>
      </div>
    </div>
  );
}
