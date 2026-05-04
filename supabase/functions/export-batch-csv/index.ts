// Exporta um lote em CSV e marca como exportado
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { batch_id } = await req.json();
    if (!batch_id) throw new Error("batch_id obrigatório");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("não autorizado");

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claims } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (!claims?.claims) throw new Error("não autenticado");

    const { data: entries, error } = await userClient
      .from("time_entries")
      .select("nome_lido, cpf_lido, funcao_lida, data, dia_semana, entrada, saida_intervalo, retorno_intervalo, saida_final, status, observacoes, confianca")
      .eq("batch_id", batch_id)
      .order("data", { nullsFirst: false });
    if (error) throw error;

    const header = ["Funcionário","CPF","Função","Data","Dia","Entrada","Saída intervalo","Retorno intervalo","Saída final","Status","Observações","Confiança"].join(";");
    const rows = (entries ?? []).map((e) => [
      e.nome_lido ?? "", e.cpf_lido ?? "", e.funcao_lida ?? "",
      e.data ?? "", e.dia_semana ?? "", e.entrada ?? "", e.saida_intervalo ?? "",
      e.retorno_intervalo ?? "", e.saida_final ?? "", e.status ?? "",
      (e.observacoes ?? "").replace(/[\r\n;]/g, " "),
      e.confianca != null ? `${Math.round((e.confianca as number) * 100)}%` : "",
    ].join(";"));
    const csv = "\uFEFF" + [header, ...rows].join("\n");

    await userClient.from("timesheet_batches").update({ status: "exportado" }).eq("id", batch_id);

    return new Response(JSON.stringify({ csv }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
