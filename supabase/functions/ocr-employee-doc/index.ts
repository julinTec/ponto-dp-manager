// OCR de documento trabalhista: atestado, férias, advertência, etc. via OpenRouter
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROMPTS: Record<string, string> = {
  atestado: "Este é um ATESTADO MÉDICO brasileiro. Extraia: nome do paciente (nome), cpf (se houver), data de emissão (document_date YYYY-MM-DD), período de afastamento: start_date e end_date (YYYY-MM-DD). Se for atestado de apenas 1 dia, start_date == end_date. Extraia também a quantidade de dias (dias) e CID quando presente.",
  ferias: "Este é um aviso/recibo de FÉRIAS. Extraia: nome, cpf, start_date e end_date (YYYY-MM-DD), document_date.",
  advertencia: "Este é um documento de ADVERTÊNCIA trabalhista. Extraia: nome, cpf, document_date (YYYY-MM-DD), motivo resumido em 'observacao'.",
  suspensao: "Este é um documento de SUSPENSÃO. Extraia: nome, cpf, document_date, start_date e end_date.",
  aviso_previo: "Este é um AVISO PRÉVIO. Extraia: nome, cpf, document_date, end_date (data prevista de saída).",
  rescisao: "Este é um TRCT/rescisão. Extraia: nome, cpf, document_date (data de saída).",
  declaracao: "Este é uma DECLARAÇÃO trabalhista. Extraia: nome, cpf, document_date e observação.",
  comprovante_pagamento: "Este é um HOLERITE/comprovante. Extraia: nome, cpf, document_date.",
  justificativa: "Este é uma JUSTIFICATIVA de ausência. Extraia: nome, cpf, document_date, start_date, end_date.",
  outro: "Documento trabalhista. Extraia nome, cpf, document_date, start_date, end_date e uma observação.",
};

const TOOLS = [{
  type: "function",
  function: {
    name: "extrair_dados_documento",
    description: "Dados extraídos do documento trabalhista",
    parameters: {
      type: "object",
      properties: {
        nome: { type: "string" },
        cpf: { type: "string" },
        document_date: { type: "string" },
        start_date: { type: "string" },
        end_date: { type: "string" },
        dias: { type: "number" },
        cid: { type: "string" },
        observacao: { type: "string" },
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

  let employee_document_id: string | undefined;
  try {
    const body = await req.json();
    employee_document_id = body.employee_document_id;
    if (!employee_document_id) throw new Error("employee_document_id obrigatório");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: doc, error: dErr } = await admin
      .from("employee_documents")
      .select("*")
      .eq("id", employee_document_id)
      .single();
    if (dErr) throw dErr;

    const { data: blob, error: bErr } = await admin.storage.from("employee-docs").download(doc.storage_path);
    if (bErr) throw bErr;
    const buf = await blob.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let bin = ""; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    const base64 = btoa(bin);
    const mime = blob.type || doc.mime_type || "image/jpeg";

    const sysPrompt = `Você é um especialista em leitura de documentos trabalhistas brasileiros. ${PROMPTS[doc.document_type] ?? PROMPTS.outro}
Use a ferramenta extrair_dados_documento para retornar. Indique a confianca_geral (0..1). Datas no formato YYYY-MM-DD ou em branco se não conseguir ler.`;

    const { ok, status, json } = await callAIReader({
      system: sysPrompt,
      prompt: "Extraia os dados solicitados deste documento via tool extrair_dados_documento.",
      file_base64: base64,
      filename: (doc.storage_path ?? "").split("/").pop() || "document",
      mime_type: mime,
      tools: TOOLS,
      tool_choice: { type: "function", function: { name: "extrair_dados_documento" } },
    });

    if (!ok) {
      throw new Error(`ai-document-reader ${status}: ${JSON.stringify(json).slice(0, 500)}`);
    }

    const toolCall = json?.tool_calls?.[0];
    let args: any = {};
    if (toolCall?.function?.arguments) {
      try { args = JSON.parse(toolCall.function.arguments); } catch { args = {}; }
    }
    console.log(`ocr-employee-doc: model=${json.model_used}`);

    const conf = typeof args.confianca_geral === "number" ? Math.max(0, Math.min(1, args.confianca_geral)) : 0.5;
    const { confianca_geral, ...dados } = args;

    let matchedEmpId: string | null = doc.employee_id;
    if (!matchedEmpId) {
      const cleanCpf = (dados.cpf ?? "").toString().replace(/\D/g, "");
      if (cleanCpf.length === 11) {
        const { data: byCpf } = await admin
          .from("employees").select("id")
          .eq("company_id", doc.company_id)
          .ilike("cpf", `%${cleanCpf}%`)
          .limit(1).maybeSingle();
        if (byCpf) matchedEmpId = byCpf.id;
      }
      if (!matchedEmpId && dados.nome) {
        const { data: byName } = await admin
          .from("employees").select("id")
          .eq("company_id", doc.company_id)
          .ilike("nome", `%${(dados.nome as string).trim()}%`)
          .limit(1).maybeSingle();
        if (byName) matchedEmpId = byName.id;
      }
    }

    await admin.from("employee_documents").update({
      ai_extracted_data: dados,
      confianca: conf,
      employee_id: matchedEmpId,
      document_date: dados.document_date || null,
      start_date: dados.start_date || null,
      end_date: dados.end_date || null,
      needs_review: conf < 0.85,
      status: conf >= 0.9 && matchedEmpId ? "validado" : "pendente_revisao",
    }).eq("id", employee_document_id);

    return new Response(JSON.stringify({ ok: true, dados, confianca: conf, employee_id: matchedEmpId, model_used: json.model_used }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro";
    if (employee_document_id) {
      try {
        const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        await admin.from("employee_documents").update({
          status: "pendente_revisao",
          notes: `Falha no OCR: ${msg}`,
          needs_review: true,
        }).eq("id", employee_document_id);
      } catch (_) {}
    }
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
