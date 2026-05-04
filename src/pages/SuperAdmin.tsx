import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Loader2, Building2 } from "lucide-react";
import { Navigate } from "react-router-dom";

export default function SuperAdmin() {
  const { isSuperAdmin, loading: authLoading } = useAuth();
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (isSuperAdmin) load(); }, [isSuperAdmin]);

  async function load() {
    const { data } = await supabase.from("companies").select("*").order("created_at", { ascending: false });
    setCompanies(data ?? []);
    setLoading(false);
  }

  if (authLoading) return <AppLayout><div className="p-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div></AppLayout>;
  if (!isSuperAdmin) return <Navigate to="/" />;

  return (
    <AppLayout>
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Super Admin</h1>
          <p className="text-sm text-muted-foreground mt-1">Visão global de todas as empresas</p>
        </div>
        <Card className="overflow-hidden">
          {loading ? <div className="p-12 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
            : companies.length === 0 ? <div className="p-12 text-center"><Building2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" /><p>Nenhuma empresa</p></div>
            : (
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr><th className="text-left px-6 py-3">Empresa</th><th className="text-left px-4 py-3">CNPJ</th><th className="text-left px-4 py-3">Status</th><th className="text-left px-4 py-3">Criada em</th></tr>
                </thead>
                <tbody className="divide-y">
                  {companies.map((c) => (
                    <tr key={c.id}>
                      <td className="px-6 py-3 font-medium">{c.nome}</td>
                      <td className="px-4 py-3 text-muted-foreground">{c.cnpj ?? "—"}</td>
                      <td className="px-4 py-3">{c.ativo ? "Ativa" : "Suspensa"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{new Date(c.created_at).toLocaleDateString("pt-BR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </Card>
      </div>
    </AppLayout>
  );
}
