import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge, BatchStatus } from "@/components/StatusBadge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Search, Loader2, FileStack, FileUp, Trash2 } from "lucide-react";
import { CompanyFilter } from "@/components/CompanyFilter";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface Batch {
  id: string;
  nome: string;
  status: BatchStatus;
  total_paginas: number;
  total_marcacoes: number;
  created_at: string;
  mes_referencia: number | null;
  ano_referencia: number | null;
}

export default function Lotes() {
  const navigate = useNavigate();
  const { isAdmin, isSuperAdmin } = useAuth();
  const canDelete = isAdmin || isSuperAdmin;
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [confirmDel, setConfirmDel] = useState<Batch | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("timesheet_batches").select("*").order("created_at", { ascending: false });
    setBatches((data ?? []) as Batch[]);
    setLoading(false);
  }

  async function doDelete() {
    if (!confirmDel) return;
    setDeleting(true);
    const { error } = await supabase.functions.invoke("delete-batch", { body: { batch_id: confirmDel.id } });
    setDeleting(false);
    if (error) { toast.error("Erro ao excluir lote"); return; }
    toast.success(`Lote "${confirmDel.nome}" excluído`);
    setConfirmDel(null);
    load();
  }

  const filtered = batches.filter((b) => {
    if (statusFilter !== "todos" && b.status !== statusFilter) return false;
    if (search && !b.nome.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <AppLayout>
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <PageHeader
          title="Lotes de folhas de ponto"
          subtitle="Gerencie todos os lotes enviados"
          actions={
            <>
              <Button asChild variant="outline"><Link to="/lotes/novo?modo=single"><FileUp className="h-4 w-4 mr-2" />Folha única</Link></Button>
              <Button asChild><Link to="/lotes/novo?modo=lote"><Plus className="h-4 w-4 mr-2" />Novo lote</Link></Button>
            </>
          }
        />

        <Card className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="enviado">Enviado</SelectItem>
              <SelectItem value="processando">Processando</SelectItem>
              <SelectItem value="aguardando_revisao">Aguardando revisão</SelectItem>
              <SelectItem value="revisado">Revisado</SelectItem>
              <SelectItem value="exportado">Exportado</SelectItem>
            </SelectContent>
          </Select>
        </Card>

        <Card className="overflow-hidden">
          {loading ? (
            <div className="p-12 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <FileStack className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-foreground font-medium">Nenhum lote encontrado</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left px-6 py-3 font-medium">Lote</th>
                  <th className="text-left px-4 py-3 font-medium">Referência</th>
                  <th className="text-left px-4 py-3 font-medium">Páginas</th>
                  <th className="text-left px-4 py-3 font-medium">Marcações</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Criado</th>
                  <th className="text-right px-4 py-3 font-medium w-20">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((b) => (
                  <tr key={b.id} className="hover:bg-muted/30">
                    <td className="px-6 py-3 font-medium text-foreground cursor-pointer" onClick={() => navigate(`/lotes/${b.id}/revisao`)}>{b.nome}</td>
                    <td className="px-4 py-3 text-muted-foreground cursor-pointer" onClick={() => navigate(`/lotes/${b.id}/revisao`)}>
                      {b.mes_referencia && b.ano_referencia ? `${String(b.mes_referencia).padStart(2,"0")}/${b.ano_referencia}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground cursor-pointer" onClick={() => navigate(`/lotes/${b.id}/revisao`)}>{b.total_paginas}</td>
                    <td className="px-4 py-3 text-muted-foreground cursor-pointer" onClick={() => navigate(`/lotes/${b.id}/revisao`)}>{b.total_marcacoes}</td>
                    <td className="px-4 py-3 cursor-pointer" onClick={() => navigate(`/lotes/${b.id}/revisao`)}><StatusBadge status={b.status} /></td>
                    <td className="px-4 py-3 text-muted-foreground cursor-pointer" onClick={() => navigate(`/lotes/${b.id}/revisao`)}>
                      {format(new Date(b.created_at), "dd MMM yyyy", { locale: ptBR })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canDelete && (
                        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setConfirmDel(b); }}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir lote?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. Todos os arquivos, páginas, marcações e logs do lote
                <strong> "{confirmDel?.nome}"</strong> serão removidos permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={doDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Excluir definitivamente
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
