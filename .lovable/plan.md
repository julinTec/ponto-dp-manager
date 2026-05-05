## Diagnóstico (confirmado)

O lote `f2eaaf63...` (e também `c4c037fa...`) tem **páginas duplicadas** em `timesheet_pages`:

- 1 imagem real foi enviada → mas existem **4 linhas** em `timesheet_pages`, todas com `numero_pagina = 1` e o **mesmo `image_path`**.
- O OCR rodou em cada cópia → 30 marcações × 4 = 120 entries.
- A barra superior mostra "3 pág · 90 marcações" (valor antigo de `total_paginas`/`total_marcacoes` salvo no batch).
- Por isso ao clicar em "próxima página" a imagem não muda (todas apontam para o mesmo arquivo) e as marcações ao lado parecem iguais (são quase idênticas).

A causa raiz está em `supabase/functions/process-batch/index.ts`: ela faz `INSERT` em `timesheet_pages` com `numero_pagina: 1` fixo e **sem apagar registros antigos**. Cada "Reprocessar" multiplica os dados.

## Correção

### 1. Edge function `process-batch` (reescrita)
- Antes de criar novas páginas, **apagar `time_entries` e `timesheet_pages` do lote** (idempotência).
- Numerar páginas **sequencialmente** (`numero_pagina = 1, 2, 3, ...`), uma por arquivo, em ordem por `created_at`/`original_name`.
- Resetar `total_marcacoes = 0` no batch (o OCR depois preenche).

### 2. Migração SQL
- **Limpar duplicados existentes**: para cada `(batch_id, file_id)`, manter só a página mais antiga; apagar `time_entries` órfãs.
- **Renumerar** as páginas restantes sequencialmente dentro de cada lote.
- **Atualizar `total_paginas` e `total_marcacoes`** em `timesheet_batches` com os valores reais.
- **Adicionar `UNIQUE (batch_id, file_id, numero_pagina)`** em `timesheet_pages` para impedir o problema voltar.
- **Adicionar foreign keys faltantes** com `ON DELETE CASCADE` (timesheet_pages, time_entries, timesheet_files → batch; pages → file; entries → page; entries.employee_id → employees ON DELETE SET NULL; batches → companies; employees → companies). Isso também elimina a necessidade do código manual em `delete-batch`.

### 3. Sem mudanças no frontend
A `Revisao.tsx` já está correta: filtra entries por `page_id` da página atual e renderiza a `image_path` com signed URL. Após a limpeza, ela vai mostrar 1 página com 30 marcações para esse lote.

## Resultado esperado
- Lote `f2eaaf63...`: 1 página, 30 marcações.
- Lote `c4c037fa...`: 1 página, marcações reais sem duplicação.
- Reprocessamentos futuros são seguros — sempre limpam antes de recriar.
