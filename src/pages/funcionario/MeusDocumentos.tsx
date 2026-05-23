import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { FuncionarioLayout } from "@/components/FuncionarioLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, Download } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export default function MeusDocumentos() {
  const { user } = useAuth();
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (user) load(); }, [user]);

  async function load() {
    setLoading(true);
    const { data: emp } = await supabase
      .from("employees").select("id").eq("user_id", user!.id).maybeSingle();
    if (!emp) { setDocs([]); setLoading(false); return; }
    const { data } = await supabase.from("employee_documents")
      .select("*").eq("employee_id", emp.id).order("created_at", { ascending: false });
    setDocs(data ?? []);
    setLoading(false);
  }

  async function abrir(d: any) {
    const { data, error } = await supabase.storage.from("employee-docs")
      .createSignedUrl(d.storage_path, 300);
    if (error || !data) return toast.error("Não foi possível abrir o documento");
    window.open(data.signedUrl, "_blank");
  }

  return (
    <FuncionarioLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Meus documentos</h1>
          <p className="text-sm text-muted-foreground">Visualização da sua pasta digital</p>
        </div>

        <Card className="overflow-hidden">
          {loading ? (
            <div className="p-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
          ) : docs.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Nenhum documento disponível.</div>
          ) : (
            <div className="divide-y">
              {docs.map((d) => (
                <div key={d.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{d.original_name ?? d.document_type}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {String(d.document_type).replace("_", " ")}
                        {d.document_date && ` · ${format(new Date(d.document_date), "dd/MM/yyyy")}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="capitalize">{String(d.status).replace("_", " ")}</Badge>
                    <Button size="sm" variant="ghost" onClick={() => abrir(d)}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </FuncionarioLayout>
  );
}
