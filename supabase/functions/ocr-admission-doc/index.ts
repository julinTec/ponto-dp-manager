// OCR de documento de admissão (RG, CPF, CTPS, contrato, ficha, etc.) via OpenRouter
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROMPTS: Record<string, string> = {
  ficha: "Esta é uma ficha de admissão. Extraia: nome, cpf, rg, data_nascimento (YYYY-MM-DD), endereco, telefone, email, cargo, admission_date (YYYY-MM-DD), salario (numérico), jornada_padrao_horas.",
  rg: "Este é um RG (documento de identidade brasileiro). Extraia: nome, rg, data_nascimento (YYYY-MM-DD).",
  cpf: "Este é um CPF brasileiro. Extraia: nome, cpf.",
  comprovante_residencia: "Este é um comprovante de residência. Extraia: nome (titular), endereco completo.",
  ctps: "Esta é uma CTPS (Carteira de Trabalho). Extraia: nome, cpf, data_nascimento, cargo, admission_date (YYYY-MM-DD), salario.",
  contrato: "Este é um contrato de trabalho. Extraia: nome, cpf, cargo, admission_date, salario, jornada_padrao_horas.",
  exame_admissional: "Este é um ASO/exame admissional. Extraia: nome, cpf, cargo, data do exame (document_date YYYY-MM-DD).",
  outro: "Extraia quaisquer dados pessoais e profissionais relevantes deste documento.",
};

const TOOLS = [{
  type: "function",
  function: {
    name: "extrair_dados_admissao",
    description: "Dados extraídos do documento",
    parameters: {
      type: "object",
      properties: {
        nome: { type: "string" },
        cpf: { type: "string" },
        rg: { type: "string" },
        data_nascimento: { type: "string" },
        endereco: { type: "string" },
        telefone: { type: "string" },
        email: { type: "string" },
        cargo: { type: "string" },
        admission_date: { type: "string" },
        salario: { type: "number" },
        jornada_padrao_horas: { type: "number" },
        document_date: { type: "string" },
        confianca_geral: { type: "number" },
      },
      required: ["confianca_geral"],
    },
  },
}];

async function callAIReader(payload: Record<string, unknown>) {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-document-reader`;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${serviceKey}`,
      "apikey": serviceKey,
    },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, json };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let admission_document_id: string | undefined;
  try {
    const body = await req.json();
    admission_document_id = body.admission_document_id;
    if (!admission_document_id) throw new Error("admission_document_id obrigatório");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    await admin.from("admission_documents").update({ ocr_status: "processando" }).eq("id", admission_document_id);

    const { data: doc, error: dErr } = await admin
      .from("admission_documents")
      .select("*, employee_admissions!inner(id, company_id, dados_extraidos)")
      .eq("id", admission_document_id)
      .single();
    if (dErr) throw dErr;

    const { data: blob, error: bErr } = await admin.storage.from("employee-docs").download(doc.storage_path);
    if (bErr) throw bErr;
    const buf = await blob.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let bin = ""; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    const base64 = btoa(bin);
    const mime = blob.type || doc.mime_type || "image/jpeg";

    const sysPrompt = `Você é um especialista em leitura de documentos brasileiros de RH/DP. ${PROMPTS[doc.tipo] ?? PROMPTS.outro}
Use a ferramenta extrair_dados_admissao para retornar os dados. Indique a confianca_geral (0..1). Se não conseguir ler, deixe os campos em branco.`;

    const { ok, status, json } = await callAIReader({
      system: sysPrompt,
      prompt: "Extraia os dados solicitados deste documento via tool extrair_dados_admissao.",
      file_base64: base64,
      filename: (doc.storage_path ?? "").split("/").pop() || "document",
      mime_type: mime,
      tools: TOOLS,
      tool_choice: { type: "function", function: { name: "extrair_dados_admissao" } },
    });

    if (!ok) {
      throw new Error(`ai-document-reader ${status}: ${JSON.stringify(json).slice(0, 500)}`);
    }

    const toolCall = json?.tool_calls?.[0];
    let args: any = {};
    if (toolCall?.function?.arguments) {
      try { args = JSON.parse(toolCall.function.arguments); } catch { args = {}; }
    }
    console.log(`ocr-admission-doc: model=${json.model_used}`);

    const conf = typeof args.confianca_geral === "number" ? Math.max(0, Math.min(1, args.confianca_geral)) : 0.5;
    const { confianca_geral, ...dados } = args;

    await admin.from("admission_documents").update({
      ocr_status: "concluido",
      dados_extraidos: dados,
      confianca: conf,
      checklist_status: conf >= 0.7 ? "recebido" : "em_analise",
    }).eq("id", admission_document_id);

    const existing = (doc.employee_admissions as any).dados_extraidos ?? {};
    const merged: any = { ...existing };
    for (const [k, v] of Object.entries(dados)) {
      if (v != null && v !== "") merged[k] = v;
    }
    await admin.from("employee_admissions")
      .update({ dados_extraidos: merged })
      .eq("id", (doc.employee_admissions as any).id);

    return new Response(JSON.stringify({ ok: true, dados, confianca: conf, model_used: json.model_used }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro";
    try {
      if (admission_document_id) {
        const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        await admin.from("admission_documents").update({ ocr_status: "falhou", erro: msg }).eq("id", admission_document_id);
      }
    } catch (_) {}
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
