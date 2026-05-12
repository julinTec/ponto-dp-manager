## Objetivo
Integrar a Gemini API via Edge Function `gemini-proxy` (usando o secret `GEMINI_API_KEY` e o modelo `gemini-2.5-flash`) e criar uma página simples no frontend para enviar prompts e exibir a resposta.

## Backend

### Edge Function: `supabase/functions/gemini-proxy/index.ts`
- Handler CORS (OPTIONS + headers em todas as respostas).
- `POST` recebe `{ prompt: string }` no body. Valida que `prompt` é string não vazia → 400 caso contrário.
- Lê `Deno.env.get("GEMINI_API_KEY")`. Se ausente → 500.
- Chama:  
  `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`  
  com body `{ contents: [{ role: "user", parts: [{ text: prompt }] }] }`.
- Trata status: 429 → "Limite de requisições atingido"; 403/401 → "Chave Gemini inválida"; outros → mensagem genérica com status.
- Extrai `candidates[0].content.parts[].text` (concatena partes) e retorna `{ text: string }`.
- A chave nunca é retornada nem logada.

### `supabase/config.toml`
- Adicionar bloco para `gemini-proxy` com `verify_jwt = false` (função pública chamada do frontend).

## Frontend

### Nova página `src/pages/GeminiTest.tsx`
- Layout simples com `Card` (shadcn): `Textarea` para prompt, `Button` "Enviar", área de resposta (texto formatado em `<pre>` com `whitespace-pre-wrap`).
- Estado: `prompt`, `response`, `loading`, `error`.
- Ao clicar em Enviar:
  - valida prompt não vazio
  - `setLoading(true)`, limpa erro/resposta
  - chama `supabase.functions.invoke("gemini-proxy", { body: { prompt } })`
  - se `error` ou `data.error` → seta `error` e exibe `toast` destrutivo
  - senão → seta `response = data.text`
- Botão desabilitado enquanto `loading`; mostra spinner/"Gerando...".

### Roteamento
- Em `src/App.tsx`: adicionar rota `/gemini` apontando para `GeminiTest` (sem proteção, para teste rápido).

## Fora do escopo
- Histórico de conversas, streaming, persistência em DB, autenticação na função.

## Observação
O secret `GEMINI_API_KEY` já está configurado — não será solicitado novamente.