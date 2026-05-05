// Gera relatório mensal por funcionário
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function parseTime(t: string | null): number | null {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { mes, ano, batch_id } = await req.json();
    if (!batch_id && (!mes || !ano)) throw new Error("informe batch_id OU mes+ano");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("não autorizado");

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    let query = userClient
      .from("time_entries")
      .select("employee_id, nome_lido, data, entrada, saida_intervalo, retorno_intervalo, saida_final, status");

    if (batch_id) {
      query = query.eq("batch_id", batch_id);
    } else {
      const inicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
      const proxMes = mes === 12 ? `${ano + 1}-01-01` : `${ano}-${String(mes + 1).padStart(2, "0")}-01`;
      query = query.gte("data", inicio).lt("data", proxMes);
    }

    const { data: entries, error } = await query;
    if (error) throw error;

    const { data: emps } = await userClient.from("employees").select("id, nome");
    const nomeMap = new Map<string, string>();
    (emps ?? []).forEach((e: any) => nomeMap.set(e.id, e.nome));

    const agg = new Map<string, any>();
    for (const e of entries ?? []) {
      const key = e.employee_id ?? `__${e.nome_lido ?? "sem_nome"}`;
      if (!agg.has(key)) agg.set(key, {
        employee_id: e.employee_id ?? key,
        nome: nomeMap.get(e.employee_id ?? "") ?? e.nome_lido ?? "Sem nome",
        total_horas: 0, dias_trabalhados: 0, faltas: 0, folgas: 0, feriados: 0, dias_sem_almoco: 0, inconsistencias: 0,
      });
      const a = agg.get(key);
      if (e.status === "falta") a.faltas++;
      else if (e.status === "folga") a.folgas++;
      else if (e.status === "feriado") a.feriados++;
      else if (e.status === "inconsistente") a.inconsistencias++;
      else {
        const ent = parseTime(e.entrada);
        const sai = parseTime(e.saida_final);
        const intS = parseTime(e.saida_intervalo);
        const intR = parseTime(e.retorno_intervalo);
        if (ent != null && sai != null && sai > ent) {
          let mins = sai - ent;
          if (intS != null && intR != null && intR > intS) mins -= (intR - intS);
          else a.dias_sem_almoco++;
          a.total_horas += mins / 60;
          a.dias_trabalhados++;
        } else {
          a.inconsistencias++;
        }
      }
    }

    const linhas = Array.from(agg.values()).sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR"));
    return new Response(JSON.stringify({ linhas }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
