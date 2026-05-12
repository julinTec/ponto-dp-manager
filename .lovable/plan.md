## Contexto

Hoje as edge functions de OCR (`ocr-page`, `ocr-admission-doc`, `ocr-employee-doc`) usam o **Lovable AI Gateway** (`https://ai.gateway.lovable.dev`) com a `LOVABLE_API_KEY`. Você quer passar a chamar **diretamente a API Gemini do Google** usando sua própria chave (Google AI Studio / Generative Language API).

## Plano

### 1. Armazenar a chave como secret (seguro)

Vou abrir o formulário seguro de secret pedindo `GOOGLE_GEMINI_API_KEY`. Você cola a **nova** chave lá (depois de revogar a que vazou no chat). A chave fica disponível só nas edge functions via `Deno.env.get("GOOGLE_GEMINI_API_KEY")`, nunca no frontend.

### 2. Trocar o endpoint nas 3 edge functions de OCR

Em `ocr-page/index.ts`, `ocr-admission-doc/index.ts` e `ocr-employee-doc/index.ts`:

- Substituir `https://ai.gateway.lovable.dev/v1/chat/completions` por chamada nativa Gemini:
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GOOGLE_GEMINI_API_KEY}`
- Adaptar payload do formato OpenAI-compatible (`messages` + `tools` + `tool_choice`) para o formato nativo do Gemini:
  - `contents: [{ role, parts: [{ text }, { inline_data: { mime_type, data } }] }]`
  - `systemInstruction: { parts: [{ text }] }`
  - `tools: [{ functionDeclarations: [...] }]` + `toolConfig: { functionCallingConfig: { mode: "ANY", allowedFunctionNames: [...] } }`
- Adaptar parsing da resposta: ler `candidates[0].content.parts[*].functionCall.args` em vez de `choices[0].message.tool_calls[0].function.arguments`.
- Tratar erros 429 (rate limit) e 403 (quota/chave inválida) com mensagens claras nos toasts/logs.

### 3. Manter o resto inalterado

- A função `monthly-report` não usa IA; permanece igual.
- Storage, banco, RLS, frontend: nenhuma mudança.
- Sem migrations.

## Implicações que você precisa saber

- **Cobrança**: passa a ser feita direto pelo Google na sua conta GCP (não consome mais créditos Lovable).
- **Rate limits**: regidos pelo seu projeto Google, não pelo workspace Lovable.
- **Modelo**: continuamos usando `gemini-2.5-pro` (mesmo modelo de hoje, só muda o canal).
- **Fallback**: se a chave Google falhar, o OCR para — não vou manter Lovable AI como fallback (pra evitar cobrança dupla silenciosa). Se quiser fallback, me avise.

## Arquivos afetados

**Editados**
- `supabase/functions/ocr-page/index.ts`
- `supabase/functions/ocr-admission-doc/index.ts`
- `supabase/functions/ocr-employee-doc/index.ts`

**Secret novo**
- `GOOGLE_GEMINI_API_KEY` (via tool segura)

Sem mudanças em frontend, banco, RLS ou config.toml.
