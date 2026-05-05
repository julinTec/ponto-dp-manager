// Exclui um lote completamente: entries, pages, files, storage, batch
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

    // valida acesso pelo RLS lendo o lote
    const { data: batch, error: bErr } = await userClient
      .from("timesheet_batches").select("id, company_id, nome").eq("id", batch_id).single();
    if (bErr || !batch) throw new Error("lote não encontrado ou sem permissão");

    // arquivos no storage
    const { data: files } = await userClient
      .from("timesheet_files").select("storage_path").eq("batch_id", batch_id);
    const { data: pages } = await userClient
      .from("timesheet_pages").select("image_path").eq("batch_id", batch_id);

    const paths: string[] = [];
    (files ?? []).forEach((f: any) => f.storage_path && paths.push(f.storage_path));
    (pages ?? []).forEach((p: any) => p.image_path && paths.push(p.image_path));

    if (paths.length > 0) {
      // batches de 1000
      for (let i = 0; i < paths.length; i += 1000) {
        await userClient.storage.from("timesheets").remove(paths.slice(i, i + 1000));
      }
    }

    // remove em ordem (RLS valida por relação ao batch)
    await userClient.from("processing_logs").delete().eq("batch_id", batch_id);
    await userClient.from("time_entries").delete().eq("batch_id", batch_id);
    await userClient.from("timesheet_pages").delete().eq("batch_id", batch_id);
    await userClient.from("timesheet_files").delete().eq("batch_id", batch_id);
    // payroll_adjustments vinculados a esse batch
    await userClient.from("payroll_adjustments").delete().eq("batch_id", batch_id);
    const { error: delErr } = await userClient
      .from("timesheet_batches").delete().eq("id", batch_id);
    if (delErr) throw delErr;

    return new Response(JSON.stringify({ ok: true, nome: batch.nome }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
