// Faz OCR de uma página usando OpenRouter (via ai-document-reader) e cria time_entries
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

Use a ferramenta registrar_marcacoes para retornar TODAS as linhas. Se um campo (exceto data) não estiver visível, deixe null.`;
}

function normalizarData(raw: string | null, mes: number | null, ano: number | null): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (m && ano) return `${ano}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
  m = s.match(/^(\d{1,2})$/);
  if (m && mes && ano) return `${ano}-${String(mes).padStart(2,"0")}-${m[1].padStart(2,"0")}`;
  return null;
}

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

const TOOLS = [{
  type: "function",
  function: {
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
              nome: { type: "string" },
              cpf: { type: "string" },
              funcao: { type: "string" },
              data: { type: "string", description: "YYYY-MM-DD" },
              dia_semana: { type: "string" },
              entrada: { type: "string" },
              saida_intervalo: { type: "string" },
              retorno_intervalo: { type: "string" },
              saida_final: { type: "string" },
              status: { type: "string", enum: ["ok", "falta", "folga", "feriado", "inconsistente"] },
              confianca: { type: "number" },
            },
            required: ["status", "confianca"],
          },
        },
      },
      required: ["marcacoes"],
    },
  },
}];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let page_id: string | undefined;
  try {
    const body = await req.json();
    page_id = body.page_id;
    if (!page_id) throw new Error("page_id obrigatório");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const admin = createClient(supabaseUrl, serviceKey);
    await admin.from("timesheet_pages").update({ ocr_status: "processando" }).eq("id", page_id);

    const { data: page, error: pErr } = await admin.from("timesheet_pages").select("*, timesheet_batches!inner(company_id, mes_referencia, ano_referencia)").eq("id", page_id).single();
    if (pErr) throw pErr;
    const companyId = (page as any).timesheet_batches.company_id;
    const mesRef = (page as any).timesheet_batches.mes_referencia ?? null;
    const anoRef = (page as any).timesheet_batches.ano_referencia ?? null;

    const { data: blob, error: dErr } = await admin.storage.from("timesheets").download(page.image_path!);
    if (dErr) throw dErr;
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);
    const mime = blob.type || "image/jpeg";
    const filename = (page.image_path ?? "").split("/").pop() || "page";

    const { ok, status, json } = await callAIReader({
      system: buildSystemPrompt(mesRef, anoRef),
      prompt: "Extraia todas as marcações de ponto desta folha e retorne via tool registrar_marcacoes.",
      file_base64: base64,
      mime_type: mime,
      filename,
      tools: TOOLS,
      tool_choice: { type: "function", function: { name: "registrar_marcacoes" } },
    });

    if (!ok) {
      throw new Error(`ai-document-reader ${status}: ${JSON.stringify(json).slice(0, 500)}`);
    }

    const toolCall = json?.tool_calls?.[0];
    let args: any = { marcacoes: [] };
    if (toolCall?.function?.arguments) {
      try { args = JSON.parse(toolCall.function.arguments); } catch { args = { marcacoes: [] }; }
    }
    const marcacoes: any[] = args.marcacoes ?? [];
    console.log(`ocr-page: model=${json.model_used} marcacoes=${marcacoes.length}`);

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

    const { count } = await admin.from("time_entries").select("*", { count: "exact", head: true }).eq("batch_id", page.batch_id);
    await admin.from("timesheet_batches").update({
      total_marcacoes: count ?? 0,
      status: "aguardando_revisao",
    }).eq("id", page.batch_id);

    await admin.from("processing_logs").insert({
      batch_id: page.batch_id,
      nivel: "info",
      mensagem: `Página ${page.numero_pagina} processada (modelo ${json.model_used}): ${entriesToInsert.length} marcações`,
    });

    return new Response(JSON.stringify({ ok: true, count: entriesToInsert.length, model_used: json.model_used }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ocr-page error:", e);
    const msg = e instanceof Error ? e.message : "erro";
    try {
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
