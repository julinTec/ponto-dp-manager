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
}

export function PageHeader({ title, subtitle, actions, showBack = true, showHome = true }: Props) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          {showHome && (
            <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground">
              <Link to="/"><Home className="h-3.5 w-3.5 mr-1" />Home</Link>
            </Button>
          )}
          {showBack && (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />Voltar
            </Button>
          )}
        </div>
        <h1 className="text-2xl font-bold text-foreground truncate">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}
