// Gera relatório mensal por funcionário (ampliado: HE, noturno, faltas, DSR)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { mes, ano, batch_id, company_id } = await req.json();
    if (!batch_id && (!mes || !ano)) throw new Error("informe batch_id OU mes+ano");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("não autorizado");

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    let inicio: string;
    let fimExclusivo: string;

    let q = userClient
      .from("time_entries")
      .select("employee_id, nome_lido, data, status, worked_hours, overtime_hours, night_hours, missing_hours, is_absence, is_justified, has_medical_certificate, dsr_discount_applicable");

    if (batch_id) {
      q = q.eq("batch_id", batch_id);
      // tenta detectar período do batch para somar payroll_adjustments
      const { data: b } = await userClient
        .from("timesheet_batches")
        .select("mes_referencia, ano_referencia")
        .eq("id", batch_id)
        .single();
      if (b?.mes_referencia && b?.ano_referencia) {
        const m = b.mes_referencia, a = b.ano_referencia;
        inicio = `${a}-${String(m).padStart(2, "0")}-01`;
        fimExclusivo = m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, "0")}-01`;
      } else {
        inicio = "1900-01-01"; fimExclusivo = "2999-01-01";
      }
    } else {
      inicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
      fimExclusivo = mes === 12 ? `${ano + 1}-01-01` : `${ano}-${String(mes + 1).padStart(2, "0")}-01`;
      q = q.gte("data", inicio).lt("data", fimExclusivo);
      if (company_id) {
        const { data: bs } = await userClient
          .from("timesheet_batches").select("id").eq("company_id", company_id);
        const ids = (bs ?? []).map((b: any) => b.id);
        if (ids.length === 0) {
          // sem lotes para essa empresa neste critério: força resultado vazio
          q = q.eq("batch_id", "00000000-0000-0000-0000-000000000000");
        } else {
          q = q.in("batch_id", ids);
        }
      }
    }

    const { data: entries, error } = await q;
    if (error) throw error;

    let empsQ = userClient.from("employees").select("id, nome, cpf, cargo, funcao");
    if (company_id) empsQ = empsQ.eq("company_id", company_id);
    const { data: emps } = await empsQ;
    const empMap = new Map<string, any>();
    (emps ?? []).forEach((e: any) => empMap.set(e.id, e));

    const agg = new Map<string, any>();
    function ensure(key: string, fallbackNome: string) {
      if (!agg.has(key)) {
        const e = empMap.get(key);
        agg.set(key, {
          employee_id: key,
          nome: e?.nome ?? fallbackNome ?? "Sem nome",
          cpf: e?.cpf ?? null,
          cargo: e?.cargo ?? e?.funcao ?? null,
          total_horas: 0,
          horas_extras: 0,
          adicional_noturno_horas: 0,
          horas_faltantes: 0,
          dias_trabalhados: 0,
          faltas_justificadas: 0,
          faltas_injustificadas: 0,
          folgas: 0,
          feriados: 0,
          inconsistencias: 0,
          dsr_horas_descontar: 0,
        });
      }
      return agg.get(key);
    }

    for (const e of entries ?? []) {
      const key = e.employee_id ?? `__${e.nome_lido ?? "sem_nome"}`;
      const a = ensure(key, e.nome_lido ?? "Sem nome");
      const wh = Number(e.worked_hours ?? 0);
      a.total_horas += wh;
      a.horas_extras += Number(e.overtime_hours ?? 0);
      a.adicional_noturno_horas += Number(e.night_hours ?? 0);
      a.horas_faltantes += Number(e.missing_hours ?? 0);
      if (wh > 0) a.dias_trabalhados++;
      if (e.status === "folga") a.folgas++;
      else if (e.status === "feriado") a.feriados++;
      else if (e.status === "inconsistente") a.inconsistencias++;
      else if (e.status === "falta" || e.is_absence) {
        if (e.is_justified || e.has_medical_certificate) a.faltas_justificadas++;
        else a.faltas_injustificadas++;
      }
    }

    // soma DSR a partir de payroll_adjustments do período
    const empIds = Array.from(agg.keys()).filter((k) => !k.startsWith("__"));
    if (empIds.length > 0) {
      const { data: adj } = await userClient
        .from("payroll_adjustments")
        .select("employee_id, tipo, valor_horas, data")
        .in("employee_id", empIds)
        .gte("data", inicio)
        .lt("data", fimExclusivo);
      for (const r of adj ?? []) {
        const a = agg.get(r.employee_id);
        if (!a) continue;
        if (r.tipo === "dsr_desconto") a.dsr_horas_descontar += Number(r.valor_horas ?? 0);
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
