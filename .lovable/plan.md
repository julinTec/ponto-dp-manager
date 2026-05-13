## Objetivo
Criar a Edge Function `ai-document-reader` integrada à OpenRouter (modelo `google/gemma-4-31b-it:free`) e uma página `/ai-test` no frontend para enviar prompts e exibir respostas.

## Backend

### Edge Function: `supabase/functions/ai-document-reader/index.ts`
- Handler CORS (OPTIONS + headers em todas as respostas).
- `POST` recebe `{ prompt: string }` no body. Valida que `prompt` é string não vazia → 400 caso contrário.
- Lê `Deno.env.get("OPENROUTER_API_KEY")`. Se ausente → 500.
- Chama `POST https://openrouter.ai/api/v1/chat/completions` com:
  - Header `Authorization: Bearer <OPENROUTER_API_KEY>`
  - Header `HTTP-Referer: https://lovable.dev`
  - Header `X-Title: Lovable Document Reader`
  - Body: `{ model: "google/gemma-4-31b-it:free", messages: [{ role: "user", content: prompt }] }`
- Se upstream retornar erro (!ok), repassa `{ error, status, details }` com o JSON completo da OpenRouter.
- Se sucesso, extrai `choices[0].message.content` e retorna `{ success: true, response: string }`.
- Tratamento de exceções: retorna 500 com mensagem.

### Secret `OPENROUTER_API_KEY`
- Criar secret via ferramenta de secrets (se ainda não existir).

## Frontend

### Nova página `src/pages/AiTest.tsx`
- Layout simples com `Card` (shadcn): `Textarea` para prompt, `Button` "Enviar", área de resposta.
- Estados: `prompt`, `response`, `loading`, `errorDetails`.
- Ao clicar em Enviar:
  - Valida prompt não vazio
  - `setLoading(true)`, limpa erro/resposta
  - Chama `supabase.functions.invoke("ai-document-reader", { body: { prompt } })`
  - Se `error` ou `data.error` → seta `errorDetails` e exibe `toast` destrutivo
  - Senão → seta `response = data.response`
- Botão desabilitado enquanto `loading`; mostra spinner.
- Em caso de erro, exibe card vermelho com status HTTP e JSON formatado do erro da OpenRouter.

### Roteamento
- Em `src/App.tsx`: adicionar rota `/ai-test` apontando para `AiTest` (sem proteção, para teste rápido).

## Testes
- Deploy da Edge Function.
- Teste via `curl` direto na função e/ou pela página `/ai-test` no preview.

## Fora do escopo
- Persistência em DB, autenticação na função, streaming.