
# Adicionar upload de folha única (single)

Hoje todo upload em `/lotes/novo` exige nome de lote, mês/ano e aceita múltiplos arquivos. Vamos manter esse fluxo e adicionar um modo simplificado para enviar **apenas uma folha**, sem precisar configurar lote.

## Mudanças

### 1. Página `/lotes/novo` — adicionar abas

Reformular `src/pages/NovoLote.tsx` com `Tabs` (shadcn) no topo:

- **Aba "Folha única"** (padrão, primeira opção)
  - Campo único: 1 arquivo (PDF ou imagem)
  - Sem campo "nome do lote", sem mês/ano obrigatórios
  - Ao enviar:
    - Cria um `timesheet_batch` automaticamente com:
      - `nome` = nome do arquivo (sem extensão), truncado a 120 chars
      - `mes_referencia` / `ano_referencia` = mês/ano atual
      - `status = 'enviado'`
    - Faz upload do arquivo, cria `timesheet_files`
    - Dispara `process-batch`
    - Redireciona para `/lotes/:id/revisao`
  - Validação: exatamente 1 arquivo, até 20MB, tipo PDF/imagem
  - Drop zone simplificada com texto "Envie uma folha de ponto"

- **Aba "Lote (múltiplos arquivos)"**
  - Mantém o formulário atual exatamente como está (nome, mês, ano, múltiplos arquivos)

A lógica de upload é compartilhada via uma função interna `criarLoteEEnviar(files, meta)` para não duplicar código.

### 2. Atalho no Dashboard

No `src/pages/Dashboard.tsx`, ao lado do botão "Novo lote" atual, adicionar botão secundário **"Enviar folha única"** que leva a `/lotes/novo?modo=single` (a página lê o query param e seleciona a aba correspondente ao montar).

### 3. Atalho na página `/lotes`

Mesma adição em `src/pages/Lotes.tsx`: dois botões no header — "Folha única" (outline) e "Novo lote" (primary).

## Detalhes técnicos

- Backend não muda: a tabela `timesheet_batches` já aceita um lote contendo um único arquivo, e `process-batch` / `ocr-page` funcionam por página independentemente da quantidade. Nenhuma migration necessária.
- `mes_referencia` e `ano_referencia` continuam preenchidos (data atual) para que relatórios mensais funcionem.
- Tipos PT-BR mantidos em todas as mensagens e toasts.
- Sem alterações em RLS, edge functions, storage ou schema.

## Arquivos afetados

- `src/pages/NovoLote.tsx` — refatorar com Tabs (folha única / lote)
- `src/pages/Dashboard.tsx` — botão extra "Folha única"
- `src/pages/Lotes.tsx` — botão extra "Folha única"
