import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Cascata de modelos free do OpenRouter — tentados na ordem até um funcionar
const MODEL_CASCADE: string[] = [
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "nvidia/nemotron-nano-12b-v2-vl:free",
  "baidu/qianfan-ocr-fast:free",
  "openrouter/free",
];

// Status que disparam fallback para o próximo modelo
const FALLBACK_STATUSES = new Set([400, 402, 404, 408, 409, 429, 500, 502, 503, 504]);
const TIMEOUT_MS = 60_000;

type Route = "text" | "image" | "pdf";

interface CallArgs {
  model: string;
  apiKey: string;
  prompt: string;
  system?: string;
  route: Route;
  fileBase64?: string;
  mimeType?: string;
  filename?: string;
  tools?: unknown;
  toolChoice?: unknown;
}

async function callOpenRouter(args: CallArgs) {
  const { model, apiKey, prompt, system, route, fileBase64, mimeType, filename, tools, toolChoice } = args;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let userContent: any = prompt;
    if (route === "image" && fileBase64) {
      userContent = [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: `data:${mimeType ?? "image/jpeg"};base64,${fileBase64}` } },
      ];
    } else if (route === "pdf" && fileBase64) {
      userContent = [
        { type: "text", text: prompt },
        {
          type: "file",
          file: {
            filename: filename ?? "document.pdf",
            file_data: `data:application/pdf;base64,${fileBase64}`,
          },
        },
      ];
    }

    const messages: any[] = [];
    if (system) messages.push({ role: "system", content: system });
    messages.push({ role: "user", content: userContent });

    const body: Record<string, unknown> = { model, messages };
    if (tools) body.tools = tools;
    if (toolChoice) body.tool_choice = toolChoice;
    if (route === "pdf") {
      body.plugins = [{ id: "file-parser", pdf: { engine: "cloudflare-ai" } }];
    }

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://lovable.dev",
        "X-Title": "Lovable Document Reader",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data, timeout: false };
  } catch (err) {
    const isTimeout = (err as Error).name === "AbortError";
    return { ok: false, status: isTimeout ? 504 : 0, data: { error: (err as Error).message }, timeout: isTimeout };
  } finally {
    clearTimeout(timeoutId);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      prompt,
      system,
      image_base64: imageBase64,
      file_base64: fileBase64Input,
      mime_type: mimeType,
      filename,
      tools,
      tool_choice: toolChoice,
      model,
      fallback_model: fallbackModelOverride,
    } = body ?? {};

    if (!prompt || typeof prompt !== "string") {
      return new Response(
        JSON.stringify({ error: "Prompt é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "OPENROUTER_API_KEY não encontrado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fileBase64 = fileBase64Input ?? imageBase64;
    const isPdf = (mimeType ?? "").toLowerCase() === "application/pdf"
      || (filename ?? "").toLowerCase().endsWith(".pdf");
    const route: Route = isPdf ? "pdf" : (fileBase64 ? "image" : "text");

    // Constrói cascata: modelos custom do cliente primeiro (se houver), depois a lista padrão.
    const cascade: string[] = [];
    if (typeof model === "string" && model) cascade.push(model);
    if (typeof fallbackModelOverride === "string" && fallbackModelOverride) cascade.push(fallbackModelOverride);
    for (const m of MODEL_CASCADE) {
      if (!cascade.includes(m)) cascade.push(m);
    }

    if (fileBase64) {
      console.log(`[ai-document-reader] route=${route} payload=${(fileBase64.length / 1024).toFixed(1)}KB cascade=${cascade.length}`);
    }

    const callArgs: Omit<CallArgs, "model"> = {
      apiKey, prompt, system, route, fileBase64, mimeType, filename, tools, toolChoice,
    };

    const attempts: Array<{ model: string; status: number; error?: unknown }> = [];
    let success: { model: string; data: any } | null = null;

    for (let i = 0; i < cascade.length; i++) {
      const m = cascade[i];
      console.log(`[ai-document-reader] -> ${m} (tentativa ${i + 1}/${cascade.length}, route=${route})`);
      const attempt = await callOpenRouter({ model: m, ...callArgs });
      console.log(`[ai-document-reader] ${m} -> HTTP ${attempt.status} ${attempt.ok ? "OK" : "FAIL"}`);

      if (attempt.ok) {
        success = { model: m, data: attempt.data };
        break;
      }

      attempts.push({ model: m, status: attempt.status, error: attempt.data });

      const recoverable = attempt.timeout || FALLBACK_STATUSES.has(attempt.status) || attempt.status === 0;
      if (!recoverable) {
        // erro não recuperável (ex: 401/403) — para imediatamente
        console.log(`[ai-document-reader] ${m} -> status ${attempt.status} não recuperável, abortando cascata`);
        break;
      }
    }

    if (!success) {
      const last = attempts[attempts.length - 1];
      return new Response(
        JSON.stringify({
          error: "Todos os modelos falharam",
          status: last?.status ?? 500,
          route,
          attempts,
        }),
        { status: last?.status || 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const message = success.data?.choices?.[0]?.message;
    return new Response(
      JSON.stringify({
        success: true,
        route,
        model_used: success.model,
        response: message?.content ?? null,
        tool_calls: message?.tool_calls ?? null,
        attempts,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Erro interno",
        message: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
