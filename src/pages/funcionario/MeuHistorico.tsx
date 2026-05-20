import { useEffect, useState } from "react";
import { FuncionarioLayout } from "@/components/FuncionarioLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listarMeusPontos } from "@/services/punch";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

const LABEL: Record<string, string> = {
  entrada: "Entrada",
  saida_intervalo: "Saída intervalo",
  retorno_intervalo: "Retorno intervalo",
  saida_final: "Saída final",
};

export default function MeuHistorico() {
  const today = new Date();
  const [mes, setMes] = useState(today.getMonth() + 1);
  const [ano, setAno] = useState(today.getFullYear());
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const from = new Date(ano, mes - 1, 1);
      const to = new Date(ano, mes, 0, 23, 59, 59, 999);
      try {
        const data = await listarMeusPontos(from, to);
        setRows(data ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, [mes, ano]);

  // group by date
  const byDate = rows.reduce<Record<string, any[]>>((acc, r) => {
    const d = new Date(r.registrado_em).toLocaleDateString("pt-BR");
    (acc[d] ??= []).push(r);
    return acc;
  }, {});

  return (
    <FuncionarioLayout>
      <h1 className="text-xl font-bold mb-4">Meu histórico</h1>

      <Card className="p-3 mb-4 grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="mes" className="text-xs">Mês</Label>
          <Input id="mes" type="number" min={1} max={12} value={mes} onChange={(e) => setMes(Number(e.target.value))} />
        </div>
        <div>
          <Label htmlFor="ano" className="text-xs">Ano</Label>
          <Input id="ano" type="number" value={ano} onChange={(e) => setAno(Number(e.target.value))} />
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : Object.keys(byDate).length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum registro encontrado.</p>
      ) : (
        <div className="space-y-3">
          {Object.entries(byDate).map(([d, items]) => (
            <Card key={d} className="p-3">
              <p className="font-medium text-sm mb-2">{d}</p>
              <div className="space-y-1">
                {items.map((r) => (
                  <div key={r.id} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                    <div>
                      <span className="font-medium">{LABEL[r.tipo] ?? r.tipo}</span>
                      <span className="text-muted-foreground ml-2">
                        {new Date(r.registrado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {r.distancia_metros != null && <span>{Math.round(r.distancia_metros)} m</span>}
                      {r.dentro_do_raio ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </FuncionarioLayout>
  );
}
