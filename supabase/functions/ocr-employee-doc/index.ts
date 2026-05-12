// OCR de documento trabalhista: atestado, atestado, férias, advertência, etc.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let employee_document_id: string | undefined;
  try {
    const body = await req.json();
    employee_document_id = body.employee_document_id;
    if (!employee_document_id) throw new Error("employee_document_id obrigatório");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const googleKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!googleKey) throw new Error("GOOGLE_GEMINI_API_KEY não configurada");

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
Retorne via tool calling. Indique a confianca_geral (0..1). Datas no formato YYYY-MM-DD ou null se não conseguir ler.`;

    const aiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${googleKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: sysPrompt }] },
          contents: [{
            role: "user",
            parts: [
              { text: "Extraia os dados solicitados deste documento." },
              { inline_data: { mime_type: mime, data: base64 } },
            ],
          }],
          tools: [{
            functionDeclarations: [{
              name: "extrair_dados_documento",
              description: "Dados extraídos do documento trabalhista",
              parameters: {
                type: "object",
                properties: {
                  nome: { type: "string", nullable: true },
                  cpf: { type: "string", nullable: true },
                  document_date: { type: "string", nullable: true },
                  start_date: { type: "string", nullable: true },
                  end_date: { type: "string", nullable: true },
                  dias: { type: "number", nullable: true },
                  cid: { type: "string", nullable: true },
                  observacao: { type: "string", nullable: true },
                  confianca_geral: { type: "number" },
                },
                required: ["confianca_geral"],
              },
            }],
          }],
          toolConfig: { functionCallingConfig: { mode: "ANY", allowedFunctionNames: ["extrair_dados_documento"] } },
        }),
      },
    );

    if (!aiResp.ok) {
      const t = await aiResp.text();
      if (aiResp.status === 429) throw new Error("Limite de requisições do Google Gemini. Tente novamente.");
      if (aiResp.status === 403) throw new Error("Chave Google Gemini inválida ou sem permissão.");
      if (aiResp.status === 400 && t.includes("API_KEY_INVALID")) throw new Error("Chave Google Gemini inválida.");
      throw new Error(`Google Gemini API: ${aiResp.status} ${t}`);
    }

    const aiJson = await aiResp.json();
    const parts = aiJson?.candidates?.[0]?.content?.parts ?? [];
    const fnPart = parts.find((p: any) => p?.functionCall);
    const args = fnPart?.functionCall?.args ?? {};
    const conf = typeof args.confianca_geral === "number" ? Math.max(0, Math.min(1, args.confianca_geral)) : 0.5;
    const { confianca_geral, ...dados } = args;

    // Match employee por CPF (limpo) ou nome
    let matchedEmpId: string | null = doc.employee_id;
    if (!matchedEmpId) {
      const cleanCpf = (dados.cpf ?? "").toString().replace(/\D/g, "");
      if (cleanCpf.length === 11) {
        const { data: byCpf } = await admin
          .from("employees")
          .select("id")
          .eq("company_id", doc.company_id)
          .ilike("cpf", `%${cleanCpf}%`)
          .limit(1)
          .maybeSingle();
        if (byCpf) matchedEmpId = byCpf.id;
      }
      if (!matchedEmpId && dados.nome) {
        const { data: byName } = await admin
          .from("employees")
          .select("id")
          .eq("company_id", doc.company_id)
          .ilike("nome", `%${(dados.nome as string).trim()}%`)
          .limit(1)
          .maybeSingle();
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

    return new Response(JSON.stringify({ ok: true, dados, confianca: conf, employee_id: matchedEmpId }), {
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
