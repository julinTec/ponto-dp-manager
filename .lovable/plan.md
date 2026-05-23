
# Reestruturação Fluxor DP — Plano em 4 fases

Cada fase é entregue separadamente e fica testável antes da próxima. Nada do que já funciona é removido — apenas reorganizado, escondido do menu quando obsoleto, ou substituído por uma versão melhor.

---

## Fase 1 — Fundação: roles, navegação, limpeza visual

**Banco**
- Adicionar valores ao enum `app_role`: `dp`, `gestor`.
- Atualizar políticas RLS sensíveis para que `dp` tenha permissão equivalente a `admin` em admissões/documentos/fechamento, e `gestor` tenha leitura ampliada + aprovação de justificativas/solicitações (criadas na Fase 4).
- Função helper `is_dp_or_admin(uid)` para reuso nas policies.

**Frontend — rotas e menu**
- Reorganizar `src/pages/` em subpastas:
  - `dashboard/`, `empresas/`, `funcionarios/`, `admissoes/`, `documentos/`, `ponto/`, `fechamento/`, `funcionario/`
- Mover arquivos existentes para os novos caminhos (mantendo o conteúdo; só ajustar imports).
- `App.tsx`: agrupar rotas por módulo, aplicar guards por role.
- Esconder do sidebar (mas manter as rotas funcionando para não quebrar links):
  - `/lotes`, `/lotes/novo`, `/lotes/:id/revisao`
  - `/gemini`, `/ai-test`
- Novo sidebar com seções: **Visão geral**, **Pessoas** (Funcionários, Admissões, Documentos), **Ponto** (Gestão, Fechamento, Relatórios), **Empresa**, **Administração**.

**Design system premium**
- Atualizar `index.css` e `tailwind.config.ts`:
  - Paleta: azul petróleo (primary), grafite (sidebar), branco gelo (background), esmeralda (success), âmbar (warning), coral suave (destructive).
  - Tokens novos: `--surface`, `--surface-elevated`, `--gradient-hero`, `--shadow-premium`.
- Refatorar `AppLayout` e `FuncionarioLayout` com sidebar moderna (collapsible icon), header com busca/avatar, cards com sombra sutil + bordas finas.
- Novo `Dashboard` executivo: KPIs (admissões do mês, ponto em aberto, atestados ativos, horas extras consolidadas), gráfico de presença semanal, tabela de últimas ocorrências.

**Entregáveis Fase 1**
- Roles `dp` e `gestor` no banco com RLS ajustada.
- Estrutura de pastas nova + sidebar/visual repaginados.
- Dashboard executivo redesenhado.
- Telas antigas continuam funcionando, só saem do menu.

---

## Fase 2 — Admissão inteligente com OpenAI (PDF)

**Pré-requisito**
- Solicitar via `add_secret`: `OPENAI_API_KEY`.

**Edge function nova: `admission-pdf-extract`**
- Recebe `admission_id` + lista de `storage_path` (PDFs já no bucket `employee-docs`).
- Para cada PDF:
  - Baixa do storage, envia ao endpoint **OpenAI Files + Responses API** com modelo barato (`gpt-4o-mini` ou `gpt-5-nano`) e *structured output* (JSON schema).
  - Schema cobre: nome, cpf, rg, data_nascimento, endereco, telefone, email, nome_mae, ctps, pis_pasep, dados_admissionais (data, cargo sugerido).
- Faz merge dos resultados (campos com maior confiança vencem) e grava em `employee_admissions.dados_extraidos`.
- Atualiza `admission_documents.ocr_status='processado'` + `confianca`.
- **Não usa imagem**. Estrutura preparada para Fase futura adicionar OCR.

**Frontend**
- Refazer `pages/admissoes/NovaAdmissao.tsx`:
  - Wizard 3 passos: upload PDFs → revisão dos campos extraídos (editáveis, com badge de confiança) → complemento DP (salário, função, jornada, cargo, tipo de contrato) → criar/atualizar `employees`.
- `DetalheAdmissao` ganha visualizador de PDF lateral + diff entre extraído e editado.
- `ListaAdmissoes` com filtros por status e contagem de pendências.

**Manter funcional**
- `ocr-admission-doc` (Gemini) continua existindo como fallback opcional, mas o fluxo padrão passa a ser `admission-pdf-extract`.

---

## Fase 3 — Pasta digital + Fechamento mensal

**Pasta digital do funcionário**
- Nova página `funcionarios/FichaFuncionario.tsx` com abas:
  - **Cadastro** (dados + contrato), **Documentos** (pasta digital agrupada por tipo: admissionais, atestados, advertências, suspensões, justificativas, férias, rescisão, outros), **Ponto** (histórico + consolidado), **Ocorrências** (timeline).
- Reusa `employee_documents`; adiciona enum/values faltantes em `document_type` se necessário (`advertencia`, `suspensao`, `justificativa`).
- Upload organizado em storage: `employee-docs/{company_id}/{employee_id}/{tipo}/{uuid}.pdf`.

**Fechamento mensal — `pages/fechamento/FechamentoMensal.tsx`**
- Seleção mês/ano → lista de funcionários da empresa com:
  - horas trabalhadas, extras, noturnas, faltantes, DSR, atestados, advertências, suspensões (badges).
- Botão **Consolidar mês**: chama edge function `monthly-closure` que:
  - roda `recompute_dsr_for_employee_month` para cada funcionário,
  - gera linha em nova tabela `monthly_closures` (status `aberto|fechado`, totais),
  - permite reabrir enquanto não exportado.
- Botão **Exportar folha** reusa `export-batch-xlsx`/`monthly-report` adaptados.

**Banco — tabela nova**
- `monthly_closures` (company_id, employee_id, ano, mes, totais jsonb, status, fechado_em, fechado_por) com RLS por empresa e índice único (employee_id, ano, mes).

---

## Fase 4 — Módulo funcionário ampliado + ocorrências

**Banco — tabelas novas (com RLS)**
- `employee_justifications`: employee_id, user_id, data, tipo (`atestado|falta|atraso`), descricao, documento_id (FK lógico p/ employee_documents), status (`pendente|aprovada|rejeitada`), revisado_por, revisado_em.
- `employee_requests`: tipo (`ferias|folga|troca_turno|outro`), periodo_inicio, periodo_fim, descricao, status, revisado_por, revisado_em.
- `employee_occurrences`: tipo (`advertencia|suspensao|elogio`), data, descricao, documento_id, criado_por. Alimenta a aba Ocorrências da ficha.

**Frontend funcionário (`pages/funcionario/`)**
- `BaterPonto.tsx` (existente, só re-skin premium).
- `MeuHistorico.tsx` (existente).
- `MeusDocumentos.tsx` — read-only da pasta digital do próprio funcionário.
- `MinhasJustificativas.tsx` — formulário (data, tipo, descrição, upload de atestado em PDF) + lista com status.
- `MinhasSolicitacoes.tsx` — formulário (tipo, período, motivo) + lista com status.
- Nav inferior atualizado: Ponto · Histórico · Documentos · Justificativas · Solicitações.

**Frontend gestor**
- Nova caixa **Aprovações** no dashboard: justificativas e solicitações pendentes.
- Aprovar justificativa com atestado → chama `apply_medical_certificate` automaticamente.

---

## Detalhes técnicos consolidados

```text
DB migrations (por fase)
  F1: ALTER TYPE app_role ADD VALUE 'dp','gestor'; função is_dp_or_admin; políticas
  F3: CREATE TABLE monthly_closures + RLS; ALTER TYPE document_type
  F4: CREATE TABLE employee_justifications, employee_requests, employee_occurrences + RLS

Edge functions
  F2: admission-pdf-extract (OpenAI Responses API, JSON schema, baixa do storage)
  F3: monthly-closure (consolida e grava em monthly_closures)
  F4: nenhuma nova (uso direto via supabase-js + RLS)

Secrets
  F2: OPENAI_API_KEY (solicitar)

Rotas removidas do menu (não deletadas)
  /lotes, /lotes/novo, /lotes/:id/revisao, /gemini, /ai-test
```

**O que NÃO está no plano**
- Migração de dados antigos: nada é apagado, tudo continua acessível por URL direta.
- App nativo mobile: o módulo funcionário continua web mobile-first (PWA-ready, mas sem manifesto novo agora).
- Integração com folha externa (eSocial, RH): fora do escopo.
- OCR de imagens na admissão: arquitetura preparada, implementação fica para fase futura.

---

Confirme se posso começar pela **Fase 1** (fundação, sem mexer em IA ainda) ou se prefere ajustar algo antes.
