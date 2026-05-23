import { Link, useNavigate } from "react-router-dom";
import { Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReactNode } from "react";

interface Props {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  showBack?: boolean;
  showHome?: boolean;
  eyebrow?: string;
}

export function PageHeader({ title, subtitle, actions, showBack = true, showHome = true, eyebrow }: Props) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between pb-2">
      <div className="min-w-0 flex-1">
        {(showHome || showBack) && (
          <div className="flex items-center gap-1 mb-2 -ml-2">
            {showHome && (
              <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground hover:text-foreground">
                <Link to="/"><Home className="h-3.5 w-3.5 mr-1" />Início</Link>
              </Button>
            )}
            {showBack && (
              <Button variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground hover:text-foreground" onClick={() => navigate(-1)}>
                <ArrowLeft className="h-3.5 w-3.5 mr-1" />Voltar
              </Button>
            )}
          </div>
        )}
        {eyebrow && (
          <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-primary mb-1">{eyebrow}</p>
        )}
        <h1 className="text-2xl sm:text-[28px] font-bold text-foreground truncate leading-tight tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap shrink-0">{actions}</div>}
    </div>
  );
}
