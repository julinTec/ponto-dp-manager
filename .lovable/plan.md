## Corrigir Relatórios + adicionar consolidado por funcionário

### Diagnóstico do problema

Quando você clicou em "Gerar" em **Relatórios**, nada apareceu porque **todas as marcações no banco têm o campo `data` vazio (null)**. Confirmei isso consultando o banco: as 20 marcações mais recentes do seu lote `JORGE LUIZ ADOLFO` estão com `data = null`, embora `entrada` e `saida_final` estejam preenchidas corretamente.

Causa: folhas manuscritas brasileiras geralmente mostram apenas o **dia do mês** (01, 02, 03…), sem o ano. O Gemini, sem contexto de mês/ano, prefere deixar `data` nula a inventar. O `monthly-report` então filtra por `data BETWEEN inicio AND fim` e não acha nada.

### O que será feito

**1. Passar mês/ano de referência do lote para o OCR (`supabase/functions/ocr-page/index.ts` + `process-batch/index.ts`)**

- Ao chamar o Gemini, incluir no prompt o `mes_referencia`/`ano_referencia` do lote (ex: "as marcações são do mês 05/2026"). Isso permite ao modelo montar a data completa quando a folha mostra só o dia.
- Após o tool call, fazer um **fallback no servidor**: se `m.data` vier como apenas dia (ex: `"05"`) ou no formato `DD/MM`, completar com o mês/ano do lote para gerar `YYYY-MM-DD` válido.
- Se ainda assim `data` ficar nula mas houver `entrada` ou `saida_final` preenchidos, atribuir uma data sequencial dentro do mês de referência (linha 1 → dia 1, linha 2 → dia 2, etc.) — isso garante que toda marcação OCR tenha uma data utilizável.

**2. Botão "Reprocessar datas" no lote existente**

Como você já tem um lote sem datas, vamos adicionar um botão na tela de **Revisão** chamado "Preencher datas do mês" que, baseado no mês/ano de referência do lote, distribui as marcações sem `data` em dias sequenciais (1º dia útil → primeira linha, etc.). Assim você não precisa reenviar o PDF.

**3. Consolidado por funcionário direto na página de Relatórios (`src/pages/Relatorios.tsx`)**

Hoje a tela já tem a estrutura certa (mês + ano + tabela). Vamos:

- **Manter** a tabela mensal por mês/ano (como está).
- **Adicionar** acima da tabela uma seção **"Cards de KPI"** com totais agregados:
  - Total de funcionários ativos no período
  - Total de horas trabalhadas
  - Total de faltas
  - Total de inconsistências
- **Adicionar** ao lado do filtro de mês/ano um filtro opcional **"Lote"** (dropdown com lotes daquele mês), para permitir gerar o consolidado de **um lote específico** em vez do mês inteiro.
- **Adicionar** uma terceira coluna na tabela: **"Dias trabalhados"** (contagem de marcações com status `ok`).

**4. Atalho a partir da tela de Revisão**

Quando o lote estiver com status `revisado`, mostrar um botão **"Ver consolidado deste lote"** que leva para `/relatorios?lote=<id>` já com o filtro pré-aplicado.

### Detalhes técnicos

- **Edge function `monthly-report`**: aceitar parâmetro opcional `batch_id`. Quando presente, filtra por `batch_id` em vez de só por intervalo de data — útil para lotes sem `data` populada (fallback de robustez). Mantém a agregação por funcionário igual.
- **Edge function `ocr-page`**: receber `mes_referencia`/`ano_referencia` (ler do `timesheet_batches` que já está no JOIN) e injetar no `SYSTEM_PROMPT`. Adicionar normalização pós-OCR:
  ```ts
  function normalizarData(raw, mes, ano) {
    if (!raw) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const dd = raw.match(/^(\d{1,2})/)?.[1];
    if (dd && mes && ano) return `${ano}-${String(mes).padStart(2,'0')}-${dd.padStart(2,'0')}`;
    return null;
  }
  ```
- **Botão "Preencher datas do mês"** na Revisão: roda no cliente, faz `update` em batch nas `time_entries` daquele lote onde `data IS NULL`, atribuindo dia 1, 2, 3… do mês de referência conforme a ordem de criação (`created_at`). Isso resolve seu lote atual sem refazer OCR.
- **Relatórios**: cards de KPI calculados a partir do array `linhas` já retornado (somatórios simples). Filtro de lote: query `timesheet_batches` por mês/ano selecionado e listar no select.

### Arquivos alterados

- `supabase/functions/ocr-page/index.ts` — prompt com mês/ano + normalização de data.
- `supabase/functions/process-batch/index.ts` — passar referência do lote (provavelmente já passa via JOIN; ajustar se necessário).
- `supabase/functions/monthly-report/index.ts` — aceitar `batch_id` opcional.
- `src/pages/Relatorios.tsx` — KPIs, filtro de lote, coluna "Dias trabalhados", suporte a query string `?lote=`.
- `src/pages/Revisao.tsx` — botão "Preencher datas do mês" + botão "Ver consolidado" quando revisado.

### Sem mudanças no banco

Nenhuma migration necessária — todos os campos já existem.
