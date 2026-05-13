import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_PRIMARY_TEXT = "google/gemma-4-31b-it:free";
const DEFAULT_FALLBACK_TEXT = "openai/gpt-oss-120b:free";
const DEFAULT_PRIMARY_VISION = "google/gemini-2.0-flash-exp:free";
const DEFAULT_FALLBACK_VISION = "meta-llama/llama-3.2-11b-vision-instruct:free";

const FALLBACK_STATUSES = new Set([429, 502, 503, 504]);
const TIMEOUT_MS = 60_000;

interface CallArgs {
  model: string;
  apiKey: string;
  prompt: string;
  system?: string;
  imageBase64?: string;
  mimeType?: string;
  tools?: unknown;
  toolChoice?: unknown;
}

async function callOpenRouter(args: CallArgs) {
  const { model, apiKey, prompt, system, imageBase64, mimeType, tools, toolChoice } = args;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const userContent: any = imageBase64
      ? [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: `data:${mimeType ?? "image/jpeg"};base64,${imageBase64}` } },
        ]
      : prompt;

    const messages: any[] = [];
    if (system) messages.push({ role: "system", content: system });
    messages.push({ role: "user", content: userContent });

    const body: Record<string, unknown> = { model, messages };
    if (tools) body.tools = tools;
    if (toolChoice) body.tool_choice = toolChoice;

    console.log(`[ai-document-reader] -> ${model} (image=${!!imageBase64}, tools=${!!tools})`);
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
      mime_type: mimeType,
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

    const isVision = !!imageBase64;
    const primary = model ?? (isVision ? DEFAULT_PRIMARY_VISION : DEFAULT_PRIMARY_TEXT);
    const fallback = fallbackModelOverride ?? (isVision ? DEFAULT_FALLBACK_VISION : DEFAULT_FALLBACK_TEXT);

    if (imageBase64) {
      console.log(`[ai-document-reader] payload imagem ${(imageBase64.length / 1024).toFixed(1)} KB (base64)`);
    }

    const callArgs: Omit<CallArgs, "model"> = {
      apiKey, prompt, system, imageBase64, mimeType, tools, toolChoice,
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
