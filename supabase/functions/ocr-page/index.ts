// Faz OCR de uma página usando Lovable AI (Gemini Vision) e cria time_entries
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function buildSystemPrompt(mes: number | null, ano: number | null): string {
  const ref = (mes && ano)
    ? `\n\nIMPORTANTE: Esta folha de ponto refere-se ao mês ${String(mes).padStart(2, "0")}/${ano}. Quando a folha mostrar apenas o dia (ex: "01", "02"), monte a data completa usando esse mês e ano (formato YYYY-MM-DD). NUNCA deixe a data nula se conseguir identificar o dia.`
    : "";
  return `Você é um especialista em leitura de folhas de ponto manuscritas brasileiras.
Sua tarefa é extrair TODAS as marcações de ponto da imagem/PDF anexo.
Para cada linha da folha, identifique:
- nome do funcionário
- CPF (se visível)
- função/cargo (se visível)
- data (formato YYYY-MM-DD obrigatório)
- dia da semana (seg, ter, qua, qui, sex, sab, dom)
- hora de entrada (HH:MM, 24h)
- saída para intervalo/almoço (HH:MM)
- retorno do intervalo (HH:MM)
- saída final (HH:MM)
- status: "ok" se completo, "falta" se ausente, "folga", "feriado", ou "inconsistente"
- confiança 0.0-1.0 indicando o quanto você tem certeza da leitura${ref}

Retorne todas as linhas via tool calling. Se um campo (exceto data) não estiver visível, deixe null.`;
}

function normalizarData(raw: string | null, mes: number | null, ano: number | null): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // DD/MM/YYYY
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
  // DD/MM
  m = s.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (m && ano) return `${ano}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
  // DD apenas
  m = s.match(/^(\d{1,2})$/);
  if (m && mes && ano) return `${ano}-${String(mes).padStart(2,"0")}-${m[1].padStart(2,"0")}`;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { page_id } = await req.json();
    if (!page_id) throw new Error("page_id obrigatório");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const googleKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!googleKey) throw new Error("GOOGLE_GEMINI_API_KEY não configurada");

    const admin = createClient(supabaseUrl, serviceKey);
    await admin.from("timesheet_pages").update({ ocr_status: "processando" }).eq("id", page_id);

    const { data: page, error: pErr } = await admin.from("timesheet_pages").select("*, timesheet_batches!inner(company_id, mes_referencia, ano_referencia)").eq("id", page_id).single();
    if (pErr) throw pErr;
    const companyId = (page as any).timesheet_batches.company_id;
    const mesRef = (page as any).timesheet_batches.mes_referencia ?? null;
    const anoRef = (page as any).timesheet_batches.ano_referencia ?? null;

    // Baixa o arquivo do storage e converte para base64 data URL
    const { data: blob, error: dErr } = await admin.storage.from("timesheets").download(page.image_path!);
    if (dErr) throw dErr;
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);
    const mime = blob.type || "image/jpeg";

    // Chama Gemini API nativa do Google com function calling
    const aiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${googleKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: buildSystemPrompt(mesRef, anoRef) }] },
          contents: [{
            role: "user",
            parts: [
              { text: "Extraia todas as marcações de ponto desta folha." },
              { inline_data: { mime_type: mime, data: base64 } },
            ],
          }],
          tools: [{
            functionDeclarations: [{
              name: "registrar_marcacoes",
              description: "Registra todas as linhas/marcações lidas",
              parameters: {
                type: "object",
                properties: {
                  marcacoes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        nome: { type: "string", nullable: true },
                        cpf: { type: "string", nullable: true },
                        funcao: { type: "string", nullable: true },
                        data: { type: "string", nullable: true, description: "YYYY-MM-DD" },
                        dia_semana: { type: "string", nullable: true },
                        entrada: { type: "string", nullable: true },
                        saida_intervalo: { type: "string", nullable: true },
                        retorno_intervalo: { type: "string", nullable: true },
                        saida_final: { type: "string", nullable: true },
                        status: { type: "string", enum: ["ok", "falta", "folga", "feriado", "inconsistente"] },
                        confianca: { type: "number" },
                      },
                      required: ["status", "confianca"],
                    },
                  },
                },
                required: ["marcacoes"],
              },
            }],
          }],
          toolConfig: { functionCallingConfig: { mode: "ANY", allowedFunctionNames: ["registrar_marcacoes"] } },
        }),
      },
    );

    if (!aiResp.ok) {
      const text = await aiResp.text();
      if (aiResp.status === 429) throw new Error("Limite de requisições do Google Gemini atingido. Tente novamente em alguns instantes.");
      if (aiResp.status === 403) throw new Error("Chave Google Gemini inválida ou sem permissão. Verifique a chave em Settings.");
      if (aiResp.status === 400 && text.includes("API_KEY_INVALID")) throw new Error("Chave Google Gemini inválida.");
      throw new Error(`Google Gemini API: ${aiResp.status} ${text}`);
    }

    const aiJson = await aiResp.json();
    const parts = aiJson?.candidates?.[0]?.content?.parts ?? [];
    const fnPart = parts.find((p: any) => p?.functionCall);
    const args = fnPart?.functionCall?.args ?? { marcacoes: [] };
    const marcacoes: any[] = args.marcacoes ?? [];

    // Carrega funcionários existentes para matching
    const { data: existing } = await admin.from("employees").select("id, nome, cpf").eq("company_id", companyId);
    const byCpf = new Map<string, string>();
    const byNome = new Map<string, string>();
    (existing ?? []).forEach((e: any) => {
      if (e.cpf) byCpf.set(e.cpf.replace(/\D/g, ""), e.id);
      if (e.nome) byNome.set(e.nome.toLowerCase().trim(), e.id);
    });

    let confSum = 0;
    let confCount = 0;
    const entriesToInsert: any[] = [];
    let diaSequencial = 1;

    for (const m of marcacoes) {
      let employeeId: string | null = null;
      const cpfLimpo = (m.cpf ?? "").replace(/\D/g, "");
      if (cpfLimpo && byCpf.has(cpfLimpo)) employeeId = byCpf.get(cpfLimpo)!;
      else if (m.nome && byNome.has(m.nome.toLowerCase().trim())) employeeId = byNome.get(m.nome.toLowerCase().trim())!;
      else if (m.nome) {
        const { data: novo } = await admin.from("employees").insert({
          company_id: companyId,
          nome: m.nome,
          cpf: cpfLimpo || null,
          funcao: m.funcao || null,
          status: "pendente_validacao",
        }).select().single();
        if (novo) {
          employeeId = novo.id;
          if (cpfLimpo) byCpf.set(cpfLimpo, novo.id);
          byNome.set(m.nome.toLowerCase().trim(), novo.id);
        }
      }

      const conf = typeof m.confianca === "number" ? Math.max(0, Math.min(1, m.confianca)) : 0.5;
      confSum += conf; confCount++;

      // Normaliza data; se ainda nula e houver mês/ano de referência, usa dia sequencial
      let dataFinal = normalizarData(m.data ?? null, mesRef, anoRef);
      if (!dataFinal && mesRef && anoRef) {
        const ultimoDia = new Date(anoRef, mesRef, 0).getDate();
        const dia = Math.min(diaSequencial, ultimoDia);
        dataFinal = `${anoRef}-${String(mesRef).padStart(2,"0")}-${String(dia).padStart(2,"0")}`;
        diaSequencial++;
      }

      entriesToInsert.push({
        batch_id: page.batch_id,
        page_id: page.id,
        employee_id: employeeId,
        nome_lido: m.nome ?? null,
        cpf_lido: m.cpf ?? null,
        funcao_lida: m.funcao ?? null,
        data: dataFinal,
        dia_semana: m.dia_semana ?? null,
        entrada: m.entrada ?? null,
        saida_intervalo: m.saida_intervalo ?? null,
        retorno_intervalo: m.retorno_intervalo ?? null,
        saida_final: m.saida_final ?? null,
        status: m.status ?? "inconsistente",
        confianca: conf,
        revisado: false,
      });
    }

    if (entriesToInsert.length > 0) {
      const { error: iErr } = await admin.from("time_entries").insert(entriesToInsert);
      if (iErr) throw iErr;
    }

    const confMedia = confCount > 0 ? confSum / confCount : null;
    await admin.from("timesheet_pages").update({
      ocr_status: "concluido",
      confianca_media: confMedia,
    }).eq("id", page_id);

    // Atualiza total de marcações no batch
    const { count } = await admin.from("time_entries").select("*", { count: "exact", head: true }).eq("batch_id", page.batch_id);
    await admin.from("timesheet_batches").update({
      total_marcacoes: count ?? 0,
      status: "aguardando_revisao",
    }).eq("id", page.batch_id);

    await admin.from("processing_logs").insert({
      batch_id: page.batch_id,
      nivel: "info",
      mensagem: `Página ${page.numero_pagina} processada: ${entriesToInsert.length} marcações`,
    });

    return new Response(JSON.stringify({ ok: true, count: entriesToInsert.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ocr-page error:", e);
    const msg = e instanceof Error ? e.message : "erro";
    try {
      const { page_id } = await req.clone().json().catch(() => ({}));
      if (page_id) {
        const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        await admin.from("timesheet_pages").update({ ocr_status: "falhou", erro: msg }).eq("id", page_id);
      }
    } catch (_) {}
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
