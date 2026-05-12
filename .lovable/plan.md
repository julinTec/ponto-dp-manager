## Objetivo
Trocar o modelo Gemini de `gemini-2.5-pro` para `gemini-2.5-flash` nas 3 edge functions de OCR e corrigir o tratamento de erros que deixa páginas presas em `processando`.

## Alterações

### 1. Edge functions (3 arquivos)
Em `supabase/functions/ocr-page/index.ts`, `ocr-admission-doc/index.ts` e `ocr-employee-doc/index.ts`:
- Trocar a URL `…/models/gemini-2.5-pro:generateContent` por `…/models/gemini-2.5-flash:generateContent`.
- Mover a leitura de `req.json()` para fora do `try`, guardando os IDs em variáveis no escopo externo, para que o `catch` consiga atualizar o status corretamente.
- No `catch`, gravar `ocr_status = 'falhou'` e `error_message` legível (incluindo "Limite de requisições atingido" quando `429`).

### 2. Migração para destravar o lote atual
Migration que atualiza:
- `timesheet_pages` com `ocr_status = 'processando'` há mais de 5 minutos no lote `9d7dafb4-dd77-439e-8fbf-04c3c295acd2` → `falhou` com mensagem "Falha por limite de requisições da API Gemini (429). Reenvie."
- `timesheet_batches.status` do mesmo lote → `falhou` se nenhuma página ficou `concluida`.

### 3. Deploy
Reimplantar `ocr-page`, `ocr-admission-doc`, `ocr-employee-doc`.

## Fora do escopo
- Nenhuma mudança de UI, RLS ou schema.
- Sem alterações no fluxo de upload nem nos componentes do frontend.

## Observação
Se mesmo no Flash o 429 persistir, próximos passos serão habilitar billing no Google Cloud ou voltar para Lovable AI Gateway — fora desta entrega.
