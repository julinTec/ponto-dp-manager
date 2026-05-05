// Processa um lote: para cada arquivo (imagem ou PDF), cria UMA página numerada
// sequencialmente e dispara o OCR. Idempotente: limpa páginas/marcações anteriores
// do lote antes de recriar, evitando duplicatas em reprocessamentos.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { batch_id } = await req.json();
    if (!batch_id) throw new Error("batch_id é obrigatório");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    await admin.from("timesheet_batches").update({ status: "processando" }).eq("id", batch_id);
    await admin.from("processing_logs").insert({ batch_id, nivel: "info", mensagem: "Iniciando processamento" });

    // Limpa estado anterior do lote (idempotência)
    const { data: oldPages } = await admin.from("timesheet_pages").select("id").eq("batch_id", batch_id);
    const oldIds = (oldPages ?? []).map((p) => p.id);
    if (oldIds.length > 0) {
      await admin.from("time_entries").delete().in("page_id", oldIds);
    }
    await admin.from("time_entries").delete().eq("batch_id", batch_id);
    await admin.from("timesheet_pages").delete().eq("batch_id", batch_id);
    await admin.from("processing_logs").insert({
      batch_id, nivel: "info",
      mensagem: `Estado anterior limpo (${oldIds.length} página(s))`,
    });

    // Busca arquivos do lote em ordem estável
    const { data: files, error: fErr } = await admin
      .from("timesheet_files")
      .select("*")
      .eq("batch_id", batch_id)
      .order("created_at", { ascending: true })
      .order("original_name", { ascending: true });
    if (fErr) throw fErr;

    let totalPaginas = 0;

    for (const file of files ?? []) {
      // Cada arquivo (PDF ou imagem) vira UMA página numerada sequencialmente.
      totalPaginas++;
      const { data: page, error: pErr } = await admin.from("timesheet_pages").insert({
        file_id: file.id,
        batch_id,
        numero_pagina: totalPaginas,
        image_path: file.storage_path,
        ocr_status: "pendente",
      }).select().single();
      if (pErr) throw pErr;

      // Dispara OCR (não aguarda)
      fetch(`${supabaseUrl}/functions/v1/ocr-page`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
        body: JSON.stringify({ page_id: page.id }),
      }).catch(console.error);
    }

    await admin.from("timesheet_batches").update({
      total_paginas: totalPaginas,
      total_marcacoes: 0,
      status: "aguardando_revisao",
    }).eq("id", batch_id);

    return new Response(JSON.stringify({ ok: true, total_paginas: totalPaginas }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("process-batch error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
