// OCR de documento de admissão (RG, CPF, CTPS, contrato, ficha, etc.)
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let admission_document_id: string | undefined;
  try {
    const body = await req.json();
    admission_document_id = body.admission_document_id;
    if (!admission_document_id) throw new Error("admission_document_id obrigatório");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const googleKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!googleKey) throw new Error("GOOGLE_GEMINI_API_KEY não configurada");

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
Retorne via tool calling. Para cada campo, indique também a confiança (0..1). Se não conseguir ler, deixe null.`;

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
              name: "extrair_dados_admissao",
              description: "Dados extraídos do documento",
              parameters: {
                type: "object",
                properties: {
                  nome: { type: "string", nullable: true },
                  cpf: { type: "string", nullable: true },
                  rg: { type: "string", nullable: true },
                  data_nascimento: { type: "string", nullable: true },
                  endereco: { type: "string", nullable: true },
                  telefone: { type: "string", nullable: true },
                  email: { type: "string", nullable: true },
                  cargo: { type: "string", nullable: true },
                  admission_date: { type: "string", nullable: true },
                  salario: { type: "number", nullable: true },
                  jornada_padrao_horas: { type: "number", nullable: true },
                  document_date: { type: "string", nullable: true },
                  confianca_geral: { type: "number" },
                },
                required: ["confianca_geral"],
              },
            }],
          }],
          toolConfig: { functionCallingConfig: { mode: "ANY", allowedFunctionNames: ["extrair_dados_admissao"] } },
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

    await admin.from("admission_documents").update({
      ocr_status: "concluido",
      dados_extraidos: dados,
      confianca: conf,
      checklist_status: conf >= 0.7 ? "recebido" : "em_analise",
    }).eq("id", admission_document_id);

    // Consolida no employee_admissions: merge non-null fields, preserva existentes
    const existing = (doc.employee_admissions as any).dados_extraidos ?? {};
    const merged: any = { ...existing };
    for (const [k, v] of Object.entries(dados)) {
      if (v != null && v !== "") merged[k] = v;
    }
    await admin.from("employee_admissions")
      .update({ dados_extraidos: merged })
      .eq("id", (doc.employee_admissions as any).id);

    return new Response(JSON.stringify({ ok: true, dados, confianca: conf }), {
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
