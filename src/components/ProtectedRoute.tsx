import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth, AppRole } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface Props {
  children: ReactNode;
  allow?: AppRole[];
}

export function ProtectedRoute({ children, allow }: Props) {
  const { user, loading, roles } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  if (allow && allow.length > 0) {
    const ok = roles.some((r) => allow.includes(r));
    if (!ok) {
      // Funcionário tentando acessar área de gestor → manda pro /ponto
      if (roles.includes("funcionario")) return <Navigate to="/ponto" replace />;
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
}
