// admission-ocr-extract
// Recebe texto OCR já extraído pelo cliente (Nível 1) e estrutura via gpt-4o-mini.
// NÃO envia imagens para a OpenAI. Custo mínimo.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TYPE_HINTS: Record<string, string> = {
  ficha: "Ficha de admissão brasileira.",
  rg: "RG (carteira de identidade brasileira).",
  cpf: "CPF brasileiro.",
  cnh: "CNH (carteira nacional de habilitação).",
  ctps: "CTPS / Carteira de Trabalho.",
  contrato: "Contrato de trabalho.",
  exame_admissional: "ASO / exame admissional.",
  comprovante_residencia: "Comprovante de residência.",
  certidao_nascimento: "Certidão de nascimento.",
  certidao_casamento: "Certidão de casamento.",
  certificado_escolar: "Certificado escolar / histórico.",
  titulo_eleitor: "Título de eleitor.",
  pis_pasep: "PIS / PASEP.",
  reservista: "Certificado de reservista.",
  outro: "Documento de RH/DP genérico.",
};

const SYSTEM = `Você é especialista em documentos brasileiros de RH/DP. Recebe TEXTO já extraído por OCR (pode conter ruído).
Sua tarefa: identificar o tipo de documento e extrair campos estruturados.

Regras:
- Devolva SOMENTE JSON válido conforme schema abaixo.
- Use null para campos ausentes — não invente.
- Datas: formato YYYY-MM-DD.
- CPF: mantenha pontuação (000.000.000-00).
- confianca_geral: 0..1 considerando ruído do OCR e completude dos campos.

Schema:
{
  "tipo_documento": "rg|cpf|cnh|ctps|contrato|exame_admissional|comprovante_residencia|certidao_nascimento|certidao_casamento|certificado_escolar|titulo_eleitor|pis_pasep|reservista|ficha|outro",
  "nome": string|null,
  "cpf": string|null,
  "rg": string|null,
  "data_nascimento": string|null,
  "endereco": string|null,
  "cep": string|null,
  "cidade": string|null,
  "estado": string|null,
  "telefone": string|null,
  "email": string|null,
  "nome_mae": string|null,
  "nome_pai": string|null,
  "ctps": string|null,
  "pis_pasep": string|null,
  "estado_civil": string|null,
  "escolaridade": string|null,
  "conjuge": string|null,
  "cargo": string|null,
  "funcao": string|null,
  "admission_date": string|null,
  "salario": number|null,
  "jornada_padrao_horas": number|null,
  "document_date": string|null,
  "campos_nao_encontrados": string[],
  "confianca_geral": number
}`;

async function callOpenAI(apiKey: string, system: string, user: string) {
  const body = {
    model: "gpt-4o-mini",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${JSON.stringify(json).slice(0, 400)}`);
  return json?.choices?.[0]?.message?.content ?? "{}";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let admission_document_id: string | undefined;
  try {
    const body = await req.json();
    admission_document_id = body.admission_document_id;
    const ocr_text: string = body.ocr_text ?? "";
    const ocr_text_clean: string = body.ocr_text_clean ?? ocr_text;
    const ocr_confidence: number = typeof body.ocr_confidence === "number" ? body.ocr_confidence : 0;

    if (!admission_document_id) throw new Error("admission_document_id obrigatório");
    if (!ocr_text_clean || ocr_text_clean.trim().length < 10) throw new Error("texto OCR insuficiente");

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) throw new Error("OPENAI_API_KEY não configurada");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    await admin.from("admission_documents").update({
      ocr_status: "processando",
      extraction_status: "processando",
      ocr_text,
      ocr_text_clean,
      erro: null,
    }).eq("id", admission_document_id);

    const { data: doc, error: dErr } = await admin
      .from("admission_documents")
      .select("id, tipo, admission_id, employee_admissions!inner(id, dados_extraidos)")
      .eq("id", admission_document_id)
      .single();
    if (dErr) throw dErr;

    const hint = TYPE_HINTS[doc.tipo] ?? TYPE_HINTS.outro;
    const userMsg = `Tipo sugerido pelo usuário: ${doc.tipo}\nDica: ${hint}\n\nTexto OCR:\n"""\n${ocr_text_clean}\n"""`;

    const raw = await callOpenAI(openaiKey, SYSTEM, userMsg);
    let parsed: any = {};
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }

    const conf = typeof parsed.confianca_geral === "number"
      ? Math.max(0, Math.min(1, parsed.confianca_geral))
      : 0.5;
    // confiança consolidada = min(ocr, ia)
    const finalConf = Math.min(ocr_confidence || conf, conf);

    const { confianca_geral, campos_nao_encontrados, ...dados } = parsed;
    const limpos: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(dados)) {
      if (v != null && v !== "") limpos[k] = v;
    }

    const needsReview = finalConf < 0.7;

    await admin.from("admission_documents").update({
      ocr_status: "concluido",
      extraction_status: "concluido",
      dados_extraidos: limpos,
      confianca: finalConf,
      needs_review: needsReview,
      ai_model_used: "gpt-4o-mini",
      checklist_status: needsReview ? "em_analise" : "recebido",
    }).eq("id", admission_document_id);

    const existing = (doc.employee_admissions as any).dados_extraidos ?? {};
    const merged: any = { ...existing, ...limpos };
    await admin.from("employee_admissions")
      .update({ dados_extraidos: merged })
      .eq("id", (doc.employee_admissions as any).id);

    return new Response(JSON.stringify({
      ok: true,
      dados: limpos,
      confianca: finalConf,
      needs_review: needsReview,
      model: "gpt-4o-mini",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro";
    console.error("admission-ocr-extract:", msg);
    try {
      if (admission_document_id) {
        const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        await admin.from("admission_documents").update({
          ocr_status: "falhou",
          extraction_status: "falhou",
          needs_review: true,
          erro: msg,
        }).eq("id", admission_document_id);
      }
    } catch (_) {}
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
