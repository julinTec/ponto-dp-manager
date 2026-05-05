## Objetivo

Na tela de Revisão (`/lotes/:id/revisao`), o botão **Exportar CSV** está retornando "Erro ao exportar". Corrigir o erro e adicionar uma segunda opção de exportação em **XLSX** (Excel), com formatação melhor (colunas dimensionadas, cabeçalho destacado, agrupamento por funcionário).

## Causa raiz do erro

A edge function `export-batch-csv` usa `userClient.auth.getClaims(token)` para validar o usuário. Essa chamada está falhando silenciosamente (joga `não autenticado` → 500). As outras edge functions do projeto (`process-batch`, `monthly-report`, `delete-batch`) não fazem essa validação manual — confiam no `verify_jwt` do Supabase + RLS. A função `export-batch-csv` é a única que faz isso e é justamente a que está quebrando.

Além disso, a função não loga erros, por isso os logs da Cloud só mostram `boot/shutdown`.

## Plano

### 1. Corrigir `supabase/functions/export-batch-csv/index.ts`
- Remover o bloco manual de `getClaims` — basta criar o `userClient` com o `Authorization` header. As policies de RLS já garantem que só dados do usuário sejam retornados.
- Adicionar `console.error` no catch para logs futuros.
- Manter a resposta `{ csv }` (compatível com o front atual).

### 2. Criar nova edge function `export-batch-xlsx`
- Mesmo padrão da CSV (recebe `batch_id`, usa `userClient` com Authorization).
- Busca `time_entries` + dados do batch (nome, mês/ano).
- Gera planilha XLSX usando `https://esm.sh/xlsx@0.18.5` (SheetJS) com:
  - Cabeçalho do lote (nome, mês/ano) nas primeiras linhas
  - Tabela com as mesmas colunas do CSV: Funcionário, CPF, Função, Data, Dia, Entrada, Saída intervalo, Retorno intervalo, Saída final, Status, Observações, Confiança
  - Larguras de coluna ajustadas e cabeçalho em negrito (estilo básico)
- Retorna `{ xlsx_base64, filename }`.
- Marca o lote como `exportado` (igual ao CSV faz hoje).

### 3. Ajustar `src/pages/Revisao.tsx`
- Substituir o botão único **Exportar CSV** por um **DropdownMenu** com duas opções:
  - **Exportar CSV** (chama `export-batch-csv`, comportamento atual)
  - **Exportar XLSX** (chama `export-batch-xlsx`, decodifica base64 → Blob `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` → download `.xlsx`)
- Tratar erros mostrando mensagem específica via `toast.error`.

### 4. Verificação
- Após deploy, testar o botão CSV (deve voltar a funcionar) e o novo XLSX (download `.xlsx` abre no Excel/LibreOffice corretamente).

## Arquivos afetados

- `supabase/functions/export-batch-csv/index.ts` (corrigir auth + logs)
- `supabase/functions/export-batch-xlsx/index.ts` (novo)
- `src/pages/Revisao.tsx` (dropdown com duas opções)

Sem migrations de banco. Sem mudanças em RLS.
