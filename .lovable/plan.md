## Objetivo

Quando o arquivo for **PDF**, usar uma "rota" diferente no `ai-document-reader`: ativar o plugin oficial `file-parser` da OpenRouter (engine `cloudflare-ai`, free) e mandar para um modelo de texto. Quando for **imagem**, manter a rota atual com modelos de visão.

## Como vai ficar a `ai-document-reader`

Três rotas, escolhidas a partir do `mime_type` recebido:

1. **Texto puro** (sem imagem/PDF):
   - Principal: `google/gemma-4-31b-it:free`
   - Fallback: `openai/gpt-oss-120b:free`

2. **Imagem** (`image/jpeg`, `image/png`, etc.):
   - Principal: `meta-llama/llama-3.2-11b-vision-instruct:free`
   - Fallback: `qwen/qwen2.5-vl-72b-instruct:free`
   - Envia como `image_url` (data URL base64) — igual hoje.

3. **PDF** (`application/pdf`) — NOVA rota:
   - Principal: `google/gemma-4-31b-it:free`
   - Fallback: `openai/gpt-oss-120b:free`
   - Conteúdo enviado como `{ type: "file", file: { filename, file_data: "data:application/pdf;base64,..." } }`
   - Adiciona ao body: `plugins: [{ id: "file-parser", pdf: { engine: "cloudflare-ai" } }]`
   - O plugin converte o PDF em texto antes do modelo, então qualquer modelo de texto funciona.

Mantém: fallback automático em 400/404/429/500/502/503/504/timeout, logs detalhados, secret `OPENROUTER_API_KEY`, mesma estrutura de resposta `{ success, model_used, response, tool_calls?, primary_failure? }`.

Adiciona no log: `route` (`text` / `image` / `pdf`) para facilitar diagnóstico.

## Mudanças nas funções de OCR

- **`ocr-page`**: remover o bloqueio de PDF que adicionei agora — voltar a aceitar PDF normalmente. O `mime_type` já é detectado e enviado para `ai-document-reader`, que escolhe a rota.
- **`ocr-admission-doc`** e **`ocr-employee-doc`**: nenhuma mudança — eles já mandam `mime_type` e vão se beneficiar automaticamente da rota PDF.

## Validação

- Deploy de `ai-document-reader` e `ocr-page`.
- Teste rápido via `curl_edge_functions` mandando um PDF pequeno em base64 para a `ai-document-reader` com tool calling, conferindo `tool_calls` no retorno.
- Você reprocessa o lote atual (FREQUENCIA_ABRIL.pdf) e eu valido pelos logs.

## Riscos / observações

- O parser `cloudflare-ai` produz markdown. Para folhas de ponto manuscritas a qualidade depende de quanto o cloudflare-ai consegue extrair de um scan. Se ficar fraco, podemos trocar para `mistral-ocr` (pago, mas barato — ~$1 por 1.000 páginas) só na rota PDF.
- Limite de payload da edge function continua valendo: PDFs muito grandes (vários MB em base64) podem dar timeout. Vou logar o tamanho.

Posso seguir?
