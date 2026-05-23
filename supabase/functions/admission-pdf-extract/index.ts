// Admissão inteligente — extração de dados de PDF usando OpenAI direta
// Usa Files API + Responses API com Structured Outputs (json_schema).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROMPTS: Record<string, string> = {
  ficha: "Ficha de admissão brasileira. Extraia todos os campos pessoais e profissionais.",
  rg: "RG brasileiro. Extraia nome, rg, data de nascimento, filiação.",
  cpf: "CPF brasileiro. Extraia nome e número do CPF.",
  comprovante_residencia: "Comprovante de residência. Extraia titular e endereço completo.",
  ctps: "CTPS / Carteira de Trabalho. Extraia nome, cpf, pis, ctps (número e série), cargo, admissão, salário.",
  contrato: "Contrato de trabalho. Extraia nome, cpf, cargo, admissão, salário, jornada.",
  exame_admissional: "ASO / exame admissional. Extraia nome, cpf, cargo, data do exame.",
  outro: "Documento de admissão. Extraia quaisquer dados pessoais e profissionais relevantes.",
};

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    nome: { type: ["string", "null"] },
    cpf: { type: ["string", "null"] },
    rg: { type: ["string", "null"] },
    data_nascimento: { type: ["string", "null"], description: "YYYY-MM-DD" },
    nome_mae: { type: ["string", "null"] },
    nome_pai: { type: ["string", "null"] },
    endereco: { type: ["string", "null"] },
    telefone: { type: ["string", "null"] },
    email: { type: ["string", "null"] },
    cargo: { type: ["string", "null"] },
    funcao: { type: ["string", "null"] },
    admission_date: { type: ["string", "null"], description: "YYYY-MM-DD" },
    salario: { type: ["number", "null"] },
    jornada_padrao_horas: { type: ["number", "null"] },
    pis: { type: ["string", "null"] },
    ctps_numero: { type: ["string", "null"] },
    ctps_serie: { type: ["string", "null"] },
    document_date: { type: ["string", "null"], description: "YYYY-MM-DD" },
    confianca_geral: { type: "number", description: "0..1" },
  },
  required: ["confianca_geral"],
};

async function uploadToOpenAI(apiKey: string, blob: Blob, filename: string) {
  const fd = new FormData();
  fd.append("purpose", "user_data");
  fd.append("file", blob, filename);
  const res = await fetch("https://api.openai.com/v1/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: fd,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`OpenAI upload ${res.status}: ${JSON.stringify(json).slice(0, 400)}`);
  return json.id as string;
}

async function extractWithOpenAI(apiKey: string, fileId: string, system: string) {
  const body = {
    model: "gpt-4o-mini",
    response_format: {
      type: "json_schema",
      json_schema: { name: "dados_admissao", schema: SCHEMA, strict: false },
    },
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: [
          { type: "text", text: "Extraia os dados estruturados deste documento. Use null quando o campo não estiver presente. Informe confianca_geral entre 0 e 1." },
          { type: "file", file: { file_id: fileId } },
        ],
      },
    ],
  };
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`OpenAI chat ${res.status}: ${JSON.stringify(json).slice(0, 400)}`);
  const content = json?.choices?.[0]?.message?.content ?? "{}";
  try { return JSON.parse(content); } catch { return {}; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let admission_document_id: string | undefined;
  try {
    const body = await req.json();
    admission_document_id = body.admission_document_id;
    if (!admission_document_id) throw new Error("admission_document_id obrigatório");

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) throw new Error("OPENAI_API_KEY não configurada");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    await admin.from("admission_documents").update({ ocr_status: "processando", erro: null }).eq("id", admission_document_id);

    const { data: doc, error: dErr } = await admin
      .from("admission_documents")
      .select("*, employee_admissions!inner(id, company_id, dados_extraidos)")
      .eq("id", admission_document_id)
      .single();
    if (dErr) throw dErr;

    const { data: blob, error: bErr } = await admin.storage.from("employee-docs").download(doc.storage_path);
    if (bErr) throw bErr;

    const filename = (doc.original_name ?? doc.storage_path?.split("/").pop()) || "documento.pdf";
    const fileBlob = new Blob([await blob.arrayBuffer()], { type: doc.mime_type || "application/pdf" });

    const fileId = await uploadToOpenAI(openaiKey, fileBlob, filename);

    const system = `Você é especialista em leitura de documentos brasileiros de RH/DP. ${PROMPTS[doc.tipo] ?? PROMPTS.outro} Datas no formato YYYY-MM-DD. Valores monetários como número (use ponto). Mantenha o CPF com pontos e traço.`;

    const args = await extractWithOpenAI(openaiKey, fileId, system);
    const conf = typeof args.confianca_geral === "number" ? Math.max(0, Math.min(1, args.confianca_geral)) : 0.5;
    const { confianca_geral, ...dados } = args;

    // limpa nulos
    const limpos: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(dados)) {
      if (v != null && v !== "") limpos[k] = v;
    }

    await admin.from("admission_documents").update({
      ocr_status: "concluido",
      dados_extraidos: limpos,
      confianca: conf,
      checklist_status: conf >= 0.7 ? "recebido" : "em_analise",
    }).eq("id", admission_document_id);

    const existing = (doc.employee_admissions as any).dados_extraidos ?? {};
    const merged: any = { ...existing, ...limpos };
    await admin.from("employee_admissions")
      .update({ dados_extraidos: merged })
      .eq("id", (doc.employee_admissions as any).id);

    // best-effort cleanup do file na OpenAI
    fetch(`https://api.openai.com/v1/files/${fileId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${openaiKey}` },
    }).catch(() => {});

    return new Response(JSON.stringify({ ok: true, dados: limpos, confianca: conf, provider: "openai" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro";
    console.error("admission-pdf-extract:", msg);
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
