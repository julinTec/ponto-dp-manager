
# Fluxor Ponto — Plano de Construção

SaaS em português do Brasil para escritórios de Departamento Pessoal processarem folhas de ponto manuscritas (PDF/imagem) com leitura automática por IA, revisão humana e exportação.

## Visão geral do fluxo

```text
Upload PDF/imagem
       ↓
Cria lote (status: enviado)
       ↓
Edge function divide PDF em páginas → storage
       ↓
Edge function OCR (Lovable AI / Gemini Vision) por página
       ↓
status: aguardando revisão
       ↓
Tela de Revisão (imagem ↔ tabela editável)
       ↓
status: revisado → Exportação CSV / Relatório mensal → exportado
```

## Papéis e acesso

- **Super Admin** (dono do SaaS): vê todas as empresas, métricas globais, pode suspender empresas.
- **Admin da empresa**: gerencia funcionários, convida revisores, vê todos os lotes.
- **Revisor**: faz upload e revisa lotes da sua empresa.

Roles ficam em tabela própria (`user_roles`) com `app_role` enum e função `has_role()` SECURITY DEFINER, para evitar escalonamento de privilégios e recursão em RLS.

## Modelo de dados (Lovable Cloud)

- **companies** — id, nome, cnpj, criado_em.
- **profiles** — id (=auth.uid), company_id, nome, email.
- **user_roles** — user_id, company_id, role (`super_admin` | `admin` | `revisor`).
- **employees** — id, company_id, nome, cpf, função, jornada_padrão, status (ativo / pendente_validação), criado_em. Auto-criados pelo OCR quando o CPF/nome não existe.
- **timesheet_batches** — id, company_id, criado_por, referência (mês/ano), status (`enviado`, `processando`, `aguardando_revisao`, `revisado`, `exportado`), totais, criado_em.
- **timesheet_files** — id, batch_id, storage_path, mime_type, original_name.
- **timesheet_pages** — id, file_id, número_página, image_path, ocr_status, confiança_média.
- **time_entries** — id, page_id, batch_id, employee_id (nullable se pendente), nome_lido, cpf_lido, função_lida, data, dia_semana, entrada, saida_intervalo, retorno_intervalo, saida_final, status (ok / inconsistente / falta / folga / feriado), observacoes, confianca, revisado (bool), revisado_por.
- **processing_logs** — id, batch_id, nível, mensagem, payload, criado_em.

RLS em todas as tabelas filtrando por `company_id` via `has_role()`. Super admin enxerga tudo.

## Storage

Bucket privado `timesheets` com pastas `{company_id}/{batch_id}/...` para arquivos originais e páginas renderizadas. URLs assinadas para exibição na tela de revisão.

## Edge Functions

1. **process-batch** — recebe batch_id, baixa arquivo, se PDF converte cada página em imagem e salva em `timesheet_pages`, depois enfileira OCR.
2. **ocr-page** — chama Lovable AI Gateway (`google/gemini-2.5-pro` para precisão em manuscrito) com a imagem; usa tool calling para retornar JSON estruturado de linhas (funcionário, CPF, função, data, dia, entrada, saída intervalo, retorno intervalo, saída final, confiança 0–1). Cria `time_entries` e auto-cria `employees` faltantes com status `pendente_validação`.
3. **export-batch-csv** — gera CSV do lote e marca como `exportado`.
4. **monthly-report** — gera relatório mensal por funcionário/empresa: total de horas trabalhadas, folgas, feriados, faltas, dias sem almoço, inconsistências.

Todas com CORS, validação Zod e `verify_jwt` ativo (exceto onde explicitamente público).

## Telas (PT-BR)

- **/auth** — login/cadastro (email+senha e Google). Cadastro cria empresa automaticamente e atribui role `admin`.
- **/dashboard** — KPIs (lotes por status, horas processadas no mês), lista de lotes recentes com badges de status coloridos.
- **/lotes** — listagem com filtros por status, mês, criado por; botão "Novo lote".
- **/lotes/novo** — drag-and-drop de PDFs/imagens, cria batch e dispara `process-batch`.
- **/lotes/:id/revisao** — layout split: à esquerda viewer da imagem da página (zoom, navegação entre páginas); à direita tabela editável com colunas: Funcionário, CPF, Função, Data, Dia, Entrada, Saída Int., Retorno Int., Saída Final, Status, Observações, Confiança (badge colorido <70%, 70–90%, >90%). Linha destacada quando confiança baixa ou inconsistente. Botões "Salvar", "Marcar como revisado".
- **/funcionarios** — CRUD + aba "Pendentes de validação" (auto-criados pelo OCR).
- **/relatorios** — seleciona mês/empresa → relatório mensal com totais e exportação CSV.
- **/admin** (apenas super admin) — lista de empresas, uso, métricas globais.

## Visual

Estilo profissional para escritórios de DP: paleta sóbria (azul corporativo + cinza neutro), tipografia Inter, componentes shadcn/ui, tabelas densas e legíveis, badges de status bem contrastados, ícones lucide. Tudo em PT-BR incluindo mensagens de erro e toasts.

## Cálculo do relatório mensal (básico)

Por funcionário no mês: somatório de (saída_final − entrada) − (retorno_intervalo − saida_intervalo); contagem de dias com status `falta`, `folga`, `feriado`; dias sem almoço (entrada e saída final preenchidas mas intervalo vazio); inconsistências (campos faltando ou horários inválidos).

## Entrega em fases

1. **Fundação** — Lovable Cloud, auth, tabelas, RLS, roles, layout base PT-BR, dashboard vazio.
2. **Upload e processamento** — bucket, telas de lote, edge functions `process-batch` + `ocr-page` com Lovable AI.
3. **Revisão** — tela split com viewer + tabela editável, salvamento, marcar revisado.
4. **Funcionários** — CRUD e fila de pendentes de validação.
5. **Exportação e relatórios** — CSV do lote, relatório mensal, marcar exportado.
6. **Super admin** — painel global.

Após aprovação, começo pela Fase 1.
