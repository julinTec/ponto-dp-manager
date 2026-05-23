// Fechamento mensal de ponto — consolida totais por funcionário
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body {
  employee_id: string;
  ano: number;
  mes: number;
  action?: "preview" | "fechar" | "reabrir";
  observacoes?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("não autenticado");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    const user = userRes?.user;
    if (!user) throw new Error("sessão inválida");

    const admin = createClient(supabaseUrl, service);

    const body = (await req.json()) as Body;
    const { employee_id, ano, mes, action = "preview", observacoes } = body;
    if (!employee_id || !ano || !mes) throw new Error("employee_id, ano e mes são obrigatórios");

    const { data: emp, error: eErr } = await admin
      .from("employees")
      .select("id, nome, company_id, jornada_padrao_horas")
      .eq("id", employee_id)
      .single();
    if (eErr) throw eErr;

    // Verifica permissão (membro da empresa)
    const { data: profile } = await admin
      .from("profiles").select("company_id").eq("id", user.id).single();
    const { data: roles } = await admin
      .from("user_roles").select("role").eq("user_id", user.id);
    const isSuper = roles?.some((r) => r.role === "super_admin");
    const isDp = roles?.some((r) => ["admin", "dp"].includes(r.role as string));
    if (!isSuper && profile?.company_id !== emp.company_id) throw new Error("sem permissão");

    const inicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
    const fim = new Date(ano, mes, 0).toISOString().slice(0, 10);

    const { data: entries } = await admin
      .from("time_entries")
      .select("data,worked_hours,overtime_hours,missing_hours,night_hours,is_absence,absence_type,has_medical_certificate,is_justified,status,dsr_discount_applicable")
      .eq("employee_id", employee_id)
      .gte("data", inicio)
      .lte("data", fim);

    const { data: adjustments } = await admin
      .from("payroll_adjustments")
      .select("tipo,valor_horas,valor_monetario,data")
      .eq("employee_id", employee_id)
      .gte("data", inicio)
      .lte("data", fim);

    const totais = {
      dias_trabalhados: 0,
      horas_trabalhadas: 0,
      horas_extras: 0,
      horas_faltantes: 0,
      horas_noturnas: 0,
      faltas: 0,
      faltas_justificadas: 0,
      atestados: 0,
      folgas: 0,
      feriados: 0,
      dsr_descontos_horas: 0,
      ajustes_horas: 0,
      ajustes_monetarios: 0,
    };

    for (const e of entries ?? []) {
      totais.horas_trabalhadas += Number(e.worked_hours ?? 0);
      totais.horas_extras += Number(e.overtime_hours ?? 0);
      totais.horas_faltantes += Number(e.missing_hours ?? 0);
      totais.horas_noturnas += Number(e.night_hours ?? 0);
      if (e.status === "ok") totais.dias_trabalhados += 1;
      if (e.status === "falta") {
        totais.faltas += 1;
        if (e.is_justified) totais.faltas_justificadas += 1;
      }
      if (e.has_medical_certificate || e.absence_type === "atestado") totais.atestados += 1;
      if (e.status === "folga") totais.folgas += 1;
      if (e.status === "feriado") totais.feriados += 1;
    }

    for (const a of adjustments ?? []) {
      if (a.tipo === "dsr_desconto") totais.dsr_descontos_horas += Number(a.valor_horas ?? 0);
      else {
        totais.ajustes_horas += Number(a.valor_horas ?? 0);
        totais.ajustes_monetarios += Number(a.valor_monetario ?? 0);
      }
    }

    const round = (n: number) => Math.round(n * 100) / 100;
    for (const k of Object.keys(totais) as (keyof typeof totais)[]) {
      if (typeof totais[k] === "number") totais[k] = round(totais[k] as number);
    }

    if (action === "preview") {
      return new Response(JSON.stringify({ ok: true, totais, periodo: { inicio, fim } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isSuper && !isDp) throw new Error("apenas DP/Admin pode fechar ou reabrir");

    if (action === "fechar") {
      const { data: existing } = await admin
        .from("monthly_closures")
        .select("id")
        .eq("employee_id", employee_id).eq("ano", ano).eq("mes", mes).maybeSingle();

      const payload = {
        company_id: emp.company_id,
        employee_id,
        ano, mes,
        status: "fechado",
        totais,
        observacoes: observacoes ?? null,
        fechado_em: new Date().toISOString(),
        fechado_por: user.id,
      };

      const { data: saved, error: sErr } = existing
        ? await admin.from("monthly_closures").update(payload).eq("id", existing.id).select().single()
        : await admin.from("monthly_closures").insert(payload).select().single();
      if (sErr) throw sErr;

      return new Response(JSON.stringify({ ok: true, closure: saved, totais }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reabrir") {
      const { data: saved, error: sErr } = await admin
        .from("monthly_closures")
        .update({ status: "reaberto", fechado_em: null, fechado_por: null })
        .eq("employee_id", employee_id).eq("ano", ano).eq("mes", mes)
        .select().single();
      if (sErr) throw sErr;
      return new Response(JSON.stringify({ ok: true, closure: saved }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("ação inválida");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro";
    console.error("monthly-closure:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
