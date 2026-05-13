## Objetivo
Substituir a lista atual de modelos OpenRouter por uma cascata de **6 modelos free** fornecida pelo usuário, tentando-os na ordem até um responder com sucesso. Aplica-se às rotas `image`, `text` e `pdf` do `ai-document-reader`.

## Ordem de fallback (cascata)
1. `google/gemma-4-31b-it:free`
2. `google/gemma-4-26b-a4b-it:free`
3. `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free`
4. `nvidia/nemotron-nano-12b-v2-vl:free`
5. `baidu/qianfan-ocr-fast:free`
6. `openrouter/free`

A cada falha (timeout, 400/404/429/5xx), passa para o próximo. Só retorna erro ao cliente se **todos os 6** falharem — incluindo no resposta os detalhes do último erro e o histórico de falhas.

## Arquivo a alterar
- `supabase/functions/ai-document-reader/index.ts`

## Mudanças técnicas
1. Remover constantes `DEFAULT_PRIMARY_*` / `DEFAULT_FALLBACK_*` e substituir por uma única const `MODEL_CASCADE: string[]` com os 6 modelos acima (mesma ordem para `text`, `image` e `pdf`, já que são todos free e alguns suportam visão/OCR).
2. Substituir o bloco "primary → 1 fallback" por um **loop** que percorre `MODEL_CASCADE`:
   - Para cada modelo, chama `callOpenRouter`.
   - Se OK → retorna sucesso com `model_used` e `attempts` (lista de `{model, status}` falhos).
   - Se falha em status `FALLBACK_STATUSES` ou timeout → registra falha e tenta o próximo.
   - Se falha em status NÃO recuperável (ex.: 401/403) → para imediatamente e retorna erro.
3. Manter os parâmetros opcionais `model` e `fallback_model` do body: se o cliente passar `model`, ele é colocado no início da cascata (e o resto serve como fallback).
4. Manter rota `pdf` com plugin `file-parser` (continua funcionando para clientes que ainda enviem PDF bruto, mesmo que o front já converta para imagem).
5. Manter logs `[ai-document-reader] -> modelo (tentativa N/6)` para facilitar debug.
6. Resposta de erro final inclui `attempts: [{model, status, error}]` para diagnóstico.

## Validação
- Reprocessar o lote pendente e checar logs do `ai-document-reader`: deve listar tentativas até encontrar um modelo que funcione.
- Conferir `timesheet_pages.ocr_status = 'concluido'` e `marks_count > 0`.
- Confirmar na tela de revisão que as marcações aparecem.

## Fora de escopo
- Nenhuma mudança em `ocr-page`, `process-batch`, frontend ou conversão de PDF (que já funciona).
- Sem alteração de UI.
