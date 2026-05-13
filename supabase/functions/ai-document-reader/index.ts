import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PRIMARY_MODEL = "google/gemma-4-31b-it:free";
const FALLBACK_MODEL = "openai/gpt-oss-120b:free";
const FALLBACK_STATUSES = new Set([429, 502, 503, 504]);
const TIMEOUT_MS = 30_000;

async function callOpenRouter(model: string, prompt: string, apiKey: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    console.log(`[ai-document-reader] Tentando modelo: ${model}`);
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://lovable.dev",
        "X-Title": "Lovable Document Reader",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
      }),
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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Prompt é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "OPENROUTER_API_KEY não encontrado no Supabase Secrets" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let attempt = await callOpenRouter(PRIMARY_MODEL, prompt, apiKey);
    let modelUsed = PRIMARY_MODEL;
    let primaryFailure: { status: number; data: unknown } | null = null;

    const shouldFallback = !attempt.ok && (attempt.timeout || FALLBACK_STATUSES.has(attempt.status));
    if (shouldFallback) {
      primaryFailure = { status: attempt.status, data: attempt.data };
      console.log(`[ai-document-reader] Fallback acionado (status=${attempt.status}, timeout=${attempt.timeout})`);
      attempt = await callOpenRouter(FALLBACK_MODEL, prompt, apiKey);
      modelUsed = FALLBACK_MODEL;
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
    return new Response(
      JSON.stringify({
        success: true,
        model_used: modelUsed,
        response: data?.choices?.[0]?.message?.content ?? data,
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
