## Objetivo

Reaproveitar o fluxo da função `ai-document-reader` (OpenRouter + fallback automático + logs) nas três funções de OCR do sistema, usando modelos com visão.

## Modelos escolhidos (free, com visão)

- Principal: `google/gemini-2.0-flash-exp:free`
- Fallback: `meta-llama/llama-3.2-11b-vision-instruct:free`

Fallback dispara em 429/502/503/504/timeout, igual já está hoje na `ai-document-reader`.

## Mudanças

### 1. `supabase/functions/ai-document-reader/index.ts` — evoluir
- Aceitar no body: `prompt`, `image_base64?`, `mime_type?`, `tools?`, `tool_choice?`, `model?`, `fallback_model?`, `system?`.
- Quando vier `image_base64`, montar `messages` no formato OpenAI multimodal:
  ```
  [{ role: "user", content: [
      { type: "text", text: prompt },
      { type: "image_url", image_url: { url: "data:<mime>;base64,..." } }
  ]}]
  ```
- Quando vier `tools`, repassar para o OpenRouter e devolver `tool_calls` no JSON final.
- Manter resposta: `{ success, model_used, response, tool_calls?, primary_failure? }`.
- Manter logs detalhados, fallback, tratamento de erro e secret `OPENROUTER_API_KEY`.
- Para uso interno por outras edge functions, aceitar request sem JWT (já está com `verify_jwt = false` por padrão).

### 2. `supabase/functions/ocr-page/index.ts` — refatorar
- Remover `GOOGLE_GEMINI_API_KEY` e a chamada direta ao `generativelanguage.googleapis.com`.
- Continuar baixando a imagem do bucket `timesheets` e gerando base64.
- Chamar `ai-document-reader` via `supabase.functions.invoke` (com service role) passando: `prompt` (system + instrução), imagem, e `tools` no formato OpenAI traduzido do schema atual `registrar_marcacoes`.
- Ler `tool_calls[0].function.arguments` (JSON) → `marcacoes[]` e popular `time_entries` exatamente como hoje.
- Em erro: gravar `ocr_status = "falhou"` e a `mensagem` (incluindo `model_used` e `primary_failure` quando houver).

### 3. `supabase/functions/ocr-admission-doc/index.ts` — refatorar
- Mesma lógica: tirar Gemini direto, chamar `ai-document-reader` com a imagem e a tool `extrair_dados_admissao` (convertida para formato OpenAI).
- Gravar `dados_extraidos`, `confianca`, `checklist_status` e fazer o merge no `employee_admissions.dados_extraidos` exatamente como hoje.

### 4. `supabase/functions/ocr-employee-doc/index.ts` — refatorar
- Mesma lógica: chamar `ai-document-reader` com a tool atual de extração de dados do funcionário.

## O que NÃO muda

- Frontend (Lotes, Revisão, Admissões, Funcionários, Documentos) — chamadas e UX continuam iguais.
- Tabelas, RLS, triggers — sem migrações.
- `gemini-proxy` e página `/gemini` — deixadas como estão (testes).
- Página `/ai-test` — continua funcionando para prompts de texto puro.

## Validação

- Deploy das 4 funções (`ai-document-reader` + 3 OCRs).
- Teste rápido via `curl_edge_functions` no `ai-document-reader` com uma imagem pequena base64 + tool, para confirmar tool_calls voltando.
- O teste real de OCR (com folha de ponto) você faz pela tela de Lotes, e eu valido pelos logs da função.

## Riscos

- Modelos free de visão no OpenRouter podem ter qualidade inferior na leitura de manuscritos comparado ao `gemini-2.5-flash` pago. Se a precisão cair, posso facilmente trocar para `google/gemini-2.5-flash` (pago) mudando uma constante.
- Limites de payload: imagens grandes em base64 podem aproximar do limite da edge function. Vou logar o tamanho para acompanharmos.
