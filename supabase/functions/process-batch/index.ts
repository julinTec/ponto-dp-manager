// Processa um lote: para cada arquivo (imagem ou PDF), cria páginas e dispara OCR
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

    const { data: files, error: fErr } = await admin.from("timesheet_files").select("*").eq("batch_id", batch_id);
    if (fErr) throw fErr;

    let totalPaginas = 0;

    for (const file of files ?? []) {
      const isPdf = (file.mime_type ?? "").includes("pdf");

      if (isPdf) {
        // Para simplificar, tratamos o PDF inteiro como uma página enviando direto à OCR.
        // Em produção, deveríamos renderizar cada página. Aqui criamos UMA página por PDF
        // e o ocr-page passa o PDF inteiro para o Gemini (que aceita PDF nativamente).
        const { data: page, error: pErr } = await admin.from("timesheet_pages").insert({
          file_id: file.id, batch_id, numero_pagina: 1,
          image_path: file.storage_path, ocr_status: "pendente",
        }).select().single();
        if (pErr) throw pErr;
        totalPaginas++;
        // Dispara OCR (não aguarda)
        fetch(`${supabaseUrl}/functions/v1/ocr-page`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
          body: JSON.stringify({ page_id: page.id }),
        }).catch(console.error);
      } else {
        // Imagem: uma página = o próprio arquivo
        const { data: page, error: pErr } = await admin.from("timesheet_pages").insert({
          file_id: file.id, batch_id, numero_pagina: 1,
          image_path: file.storage_path, ocr_status: "pendente",
        }).select().single();
        if (pErr) throw pErr;
        totalPaginas++;
        fetch(`${supabaseUrl}/functions/v1/ocr-page`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
          body: JSON.stringify({ page_id: page.id }),
        }).catch(console.error);
      }
    }

    await admin.from("timesheet_batches").update({
      total_paginas: totalPaginas,
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
