// Exporta um lote em XLSX (Excel) e marca como exportado
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function b64(bytes: Uint8Array): string {
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}

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

    const [{ data: batch }, { data: entries, error }] = await Promise.all([
      userClient.from("timesheet_batches").select("nome, mes_referencia, ano_referencia").eq("id", batch_id).single(),
      userClient.from("time_entries")
        .select("nome_lido, cpf_lido, funcao_lida, data, dia_semana, entrada, saida_intervalo, retorno_intervalo, saida_final, status, observacoes, confianca, worked_hours, overtime_hours, night_hours, missing_hours")
        .eq("batch_id", batch_id)
        .order("nome_lido", { nullsFirst: false })
        .order("data", { nullsFirst: false }),
    ]);
    if (error) throw error;

    const header = [
      "Funcionário","CPF","Função","Data","Dia","Entrada","Saída intervalo","Retorno intervalo","Saída final",
      "Horas trab.","HE","Noturno","Faltantes","Status","Observações","Confiança",
    ];
    const rows = (entries ?? []).map((e: any) => [
      e.nome_lido ?? "", e.cpf_lido ?? "", e.funcao_lida ?? "",
      e.data ?? "", e.dia_semana ?? "",
      e.entrada ?? "", e.saida_intervalo ?? "", e.retorno_intervalo ?? "", e.saida_final ?? "",
      Number(e.worked_hours ?? 0), Number(e.overtime_hours ?? 0),
      Number(e.night_hours ?? 0), Number(e.missing_hours ?? 0),
      e.status ?? "",
      (e.observacoes ?? "").replace(/[\r\n]/g, " "),
      e.confianca != null ? Math.round(Number(e.confianca) * 100) / 100 : "",
    ]);

    const titulo = batch?.nome ?? "Lote";
    const referencia = batch?.mes_referencia && batch?.ano_referencia
      ? `Referência: ${String(batch.mes_referencia).padStart(2, "0")}/${batch.ano_referencia}`
      : "";

    const aoa: any[][] = [
      [titulo],
      [referencia],
      [`Gerado em: ${new Date().toLocaleString("pt-BR")}`],
      [],
      header,
      ...rows,
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [
      { wch: 28 }, { wch: 16 }, { wch: 18 }, { wch: 12 }, { wch: 14 },
      { wch: 9 }, { wch: 11 }, { wch: 12 }, { wch: 11 },
      { wch: 11 }, { wch: 8 }, { wch: 9 }, { wch: 11 },
      { wch: 14 }, { wch: 30 }, { wch: 10 },
    ];
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: header.length - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: header.length - 1 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: header.length - 1 } },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Marcações");

    const arr = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const xlsx_base64 = b64(new Uint8Array(arr));

    await userClient.from("timesheet_batches").update({ status: "exportado" }).eq("id", batch_id);

    const safeName = (titulo).replace(/[^\w\-]+/g, "_");
    return new Response(JSON.stringify({ xlsx_base64, filename: `${safeName}.xlsx` }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("export-batch-xlsx error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
