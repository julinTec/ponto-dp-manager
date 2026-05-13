import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_PRIMARY_TEXT = "google/gemma-4-31b-it:free";
const DEFAULT_FALLBACK_TEXT = "openai/gpt-oss-120b:free";
const DEFAULT_PRIMARY_VISION = "meta-llama/llama-3.2-11b-vision-instruct:free";
const DEFAULT_FALLBACK_VISION = "qwen/qwen2.5-vl-72b-instruct:free";
// PDFs são pré-processados pelo plugin file-parser (cloudflare-ai, free), então
// um modelo de texto qualquer atende.
const DEFAULT_PRIMARY_PDF = "google/gemma-4-31b-it:free";
const DEFAULT_FALLBACK_PDF = "openai/gpt-oss-120b:free";

// Inclui 400/404/500 (modelo indisponível/sem endpoints/erro do provedor) além dos transientes
const FALLBACK_STATUSES = new Set([400, 404, 429, 500, 502, 503, 504]);
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

    console.log(`[ai-document-reader] -> ${model} (route=${route}, tools=${!!tools})`);
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
    console.log(`[ai-document-reader] ${model} -> HTTP ${res.status}`);
    return { ok: res.ok, status: res.status, data, timeout: false };
  } catch (err) {
    const isTimeout = (err as Error).name === "AbortError";
    console.log(`[ai-document-reader] ${model} -> erro: ${(err as Error).message} (timeout=${isTimeout})`);
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

    // Determina rota a partir do mime_type (PDF tem prioridade) ou da presença de imagem
    const fileBase64 = fileBase64Input ?? imageBase64;
    const isPdf = (mimeType ?? "").toLowerCase() === "application/pdf"
      || (filename ?? "").toLowerCase().endsWith(".pdf");
    const route: Route = isPdf
      ? "pdf"
      : (fileBase64 ? "image" : "text");

    const defaults = route === "pdf"
      ? { p: DEFAULT_PRIMARY_PDF, f: DEFAULT_FALLBACK_PDF }
      : route === "image"
        ? { p: DEFAULT_PRIMARY_VISION, f: DEFAULT_FALLBACK_VISION }
        : { p: DEFAULT_PRIMARY_TEXT, f: DEFAULT_FALLBACK_TEXT };

    const primary = model ?? defaults.p;
    const fallback = fallbackModelOverride ?? defaults.f;

    if (fileBase64) {
      console.log(`[ai-document-reader] payload ${route} ${(fileBase64.length / 1024).toFixed(1)} KB (base64)`);
    }

    const callArgs: Omit<CallArgs, "model"> = {
      apiKey, prompt, system, route, fileBase64, mimeType, filename, tools, toolChoice,
    };

    let attempt = await callOpenRouter({ model: primary, ...callArgs });
    let modelUsed = primary;
    let primaryFailure: { status: number; data: unknown } | null = null;

    const shouldFallback = !attempt.ok && (attempt.timeout || FALLBACK_STATUSES.has(attempt.status));
    if (shouldFallback) {
      primaryFailure = { status: attempt.status, data: attempt.data };
      console.log(`[ai-document-reader] Fallback acionado (status=${attempt.status}, timeout=${attempt.timeout})`);
      attempt = await callOpenRouter({ model: fallback, ...callArgs });
      modelUsed = fallback;
    }

    if (!attempt.ok) {
      return new Response(
        JSON.stringify({
          error: "Erro OpenRouter",
          status: attempt.status,
          route,
          model_attempted: modelUsed,
          details: attempt.data,
          primary_failure: primaryFailure,
        }),
        { status: attempt.status || 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = attempt.data as any;
    const message = data?.choices?.[0]?.message;
    return new Response(
      JSON.stringify({
        success: true,
        route,
        model_used: modelUsed,
        response: message?.content ?? null,
        tool_calls: message?.tool_calls ?? null,
        ...(primaryFailure ? { primary_failure: primaryFailure } : {}),
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
