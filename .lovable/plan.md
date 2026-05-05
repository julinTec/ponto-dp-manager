
# Expansão do Fluxor Ponto → Módulo de DP

Esta é uma expansão grande (~10 frentes). Vou entregar em **5 fases** sequenciais para manter o sistema sempre funcional. Cada fase é uma entrega completa e testável.

---

## Fase 1 — Banco de dados e modelo

**Migrations (uma só):**

1. `companies`: já existe — sem mudança.
2. `employees` — adicionar colunas:
   - `rg`, `data_nascimento`, `endereco`, `telefone`, `email`
   - `cargo` (alias semântico de `funcao` mantido), `admission_date`, `salario` (numeric)
   - `work_schedule_type` (enum: `5x2`, `6x1`, `12x36`, `escala`, `outro`)
   - `daily_expected_hours` (mantém `jornada_padrao_horas` como mesma coluna; renomear semanticamente via UI)
3. **Nova tabela** `employee_admissions` — uma "pasta" de admissão por funcionário em processamento:
   - `id`, `company_id`, `employee_id` (nullable até validar), `status` (`em_analise`/`aprovado`/`rejeitado`), `dados_extraidos` (jsonb), `created_by`, `created_at`, `updated_at`
4. **Nova tabela** `admission_documents` — arquivos de admissão (RG, CPF, CTPS, contrato, etc.):
   - `id`, `admission_id`, `tipo` (enum: `ficha`, `rg`, `cpf`, `comprovante_residencia`, `ctps`, `contrato`, `exame_admissional`, `outro`)
   - `storage_path`, `original_name`, `mime_type`, `tamanho_bytes`
   - `ocr_status` (`pendente`/`processando`/`concluido`/`falhou`), `dados_extraidos` (jsonb), `confianca`, `erro`
   - `checklist_status` (`recebido`/`pendente`/`rejeitado`/`em_analise`)
5. **Nova tabela** `employee_documents` — documentos trabalhistas pós-admissão:
   - `id`, `company_id`, `employee_id` (nullable se vínculo pendente), `document_type` (enum: `atestado`, `advertencia`, `suspensao`, `declaracao`, `justificativa`, `outro`)
   - `storage_path`, `file_url` (gerado via signedUrl no front), `document_date`, `start_date`, `end_date`
   - `status` (`pendente_revisao`/`validado`/`rejeitado`), `ai_extracted_data` (jsonb), `confianca`, `needs_review`, `notes`
6. **Nova tabela** `payroll_adjustments` — ajustes calculados/aplicados (DSR, HE manuais):
   - `id`, `employee_id`, `batch_id` (nullable), `data`, `tipo` (`dsr_desconto`/`he_extra`/`outro`), `valor_horas` (numeric), `valor_monetario` (numeric, nullable), `origem_documento_id` (nullable), `notes`
7. `time_entries` — adicionar:
   - `is_absence` bool default false
   - `absence_type` text nullable (`falta`/`atestado`/`folga`/`feriado`)
   - `is_justified` bool default false
   - `has_medical_certificate` bool default false
   - `dsr_discount_applicable` bool default false
   - `night_hours` numeric default 0
   - `overtime_hours` numeric default 0
   - `missing_hours` numeric default 0
   - `worked_hours` numeric default 0 (calculado)
   - `source_document_id` uuid nullable (FK lógico a `employee_documents`)
8. **Novo bucket de storage** `employee-docs` (privado), com policies análogas ao `timesheets`.
9. **RLS** em todas as novas tabelas seguindo padrão `is_company_member` / `has_role(admin)` para escrita.
10. **Função SQL** `recalc_time_entry(uuid)` — recalcula `worked_hours`, `overtime_hours`, `night_hours`, `missing_hours` a partir da jornada do funcionário e dos horários da entry. Trigger `BEFORE INSERT/UPDATE` em `time_entries` chama essa função.
11. **Função SQL** `apply_medical_certificate(employee_id, start, end)` — marca `time_entries` no intervalo como `is_absence=true, is_justified=true, has_medical_certificate=true, dsr_discount_applicable=false`.

---

## Fase 2 — Admissão de funcionários (OCR)

**Edge function `ocr-admission-doc`** (nova): recebe `admission_document_id`, baixa o arquivo, chama Lovable AI Gemini Vision com tool calling apropriado por `tipo` (RG → nome/RG/nascimento; CPF → CPF; comprovante → endereço; CTPS/contrato → cargo/admissão/salário; ficha → todos os campos). Atualiza `dados_extraidos`/`confianca` e consolida no `employee_admissions.dados_extraidos`.

**Página `/admissoes`** (nova `src/pages/Admissoes.tsx`):
- Lista de admissões em processamento com status, checklist visual de docs (recebido/pendente/rejeitado/em análise) e barra de confiança média.
- Botão "Nova admissão" → modal/wizard:
  1. Upload de documentos (drag-and-drop, múltiplos, com seleção de tipo por arquivo).
  2. Processamento OCR automático em background.
- Detalhe `/admissoes/:id`:
  - Painel esquerdo: lista de docs com preview e checklist editável.
  - Painel direito: formulário de cadastro **pré-preenchido** com dados do OCR + indicador de confiança por campo + botão "Aprovar e criar funcionário" (cria/atualiza `employees`, vincula `admission_id`).

**Sidebar:** adicionar item "Admissões" (ícone `UserPlus`).

---

## Fase 3 — Documentos trabalhistas

**Edge function `ocr-employee-doc`** (nova): identifica tipo, funcionário (matching por nome/CPF), datas e período. Para `atestado` válido com `employee_id` resolvido, chama `apply_medical_certificate` automaticamente.

**Página `/documentos`** (nova `src/pages/Documentos.tsx`):
- Lista filtrável por funcionário, tipo, período, status (pendente/validado).
- Botão "Novo documento" → upload (múltiplos arquivos) com OCR automático.
- Detalhe lateral: dados extraídos editáveis, vínculo manual com funcionário se IA não resolveu, botão "Validar" (aplica regras: atestado → justifica faltas; falta injustificada → cria `payroll_adjustment` DSR; advertência → apenas histórico).
- Aba **histórico documental** dentro do cadastro do funcionário.

**Sidebar:** adicionar item "Documentos" (ícone `FileText`).

---

## Fase 4 — Cálculos, consolidação e dashboard

**Atualizar `monthly-report` edge function** para retornar (por funcionário):
- `total_horas_trabalhadas`, `horas_extras`, `adicional_noturno_horas`, `horas_faltantes`
- `faltas_justificadas`, `faltas_injustificadas`, `dsr_horas_descontar`
- `dias_inconsistentes`
Usa as colunas calculadas pelo trigger + soma de `payroll_adjustments`.

**Redesenho de `/relatorios`** (consolidação mensal):
- Filtros: período, empresa (super admin), funcionário.
- KPIs ampliados: HE, noturno, faltas just/injust, DSR, inconsistências.
- Tabela **agrupada por funcionário** com cabeçalho fixo (nome/CPF/cargo/empresa) e linhas internas: data, dia, horários, h.trab, HE, noturno, status, obs.
- Removida a repetição de Nome/CPF/Função/Empresa nas linhas.

**Redesenho da `/lotes/:id/revisao`:**
- Tabela agrupada por funcionário (cabeçalho com nome/CPF/função, linhas só com data/horários/cálculos/status/obs/ações).
- Mantém edição inline e revisão por página.

**Dashboard ampliado:**
- Cards: lotes enviados, lotes aguardando revisão, funcionários cadastrados, documentos pendentes, faltas just/injust, HE no período, DSRs a descontar, inconsistências.
- Filtro de período + empresa.

---

## Fase 5 — Polimentos

1. **Exclusão de lotes** (`/lotes`): ícone lixeira por linha + modal de confirmação. Edge function `delete-batch` que apaga em ordem: `processing_logs` → `time_entries` → `timesheet_pages` → `timesheet_files` → arquivos do storage → `timesheet_batches`.
2. **Botões Home / Voltar** em todas as telas internas: criar componente `<PageHeader title back?>` com botões Home (link `/`) e Voltar (history.back). Aplicar em Lotes, Revisão, NovoLote, Admissão, Documentos, Funcionários, Relatórios, Usuários.
3. **Filtros consistentes** (período/empresa/funcionário) onde fizerem sentido.

---

## Detalhes técnicos

**Cálculo (no trigger SQL):**
```text
worked_minutes = (saida_final - entrada) - (retorno_intervalo - saida_intervalo)
worked_hours = worked_minutes / 60
overtime_hours = max(0, worked_hours - daily_expected)
missing_hours = max(0, daily_expected - worked_hours)
night_hours = interseção de [entrada, saida_final] com [22:00, 05:00]
```

**DSR:** ao validar uma falta injustificada (entry com `is_absence=true, is_justified=false`), inserir `payroll_adjustment` com `tipo='dsr_desconto'` e `valor_horas = (jornada_diaria * 1)` (1 DSR por falta na semana — regra simplificada; ajustável depois).

**Matching de funcionário em documentos:** primeiro por CPF (limpo de máscara), fallback por nome normalizado (lowercase + sem acento). Se múltiplos matches, marcar `needs_review=true`.

**Imports e libs:** Reutilizar `react-hook-form` + `zod` (já no projeto via shadcn) para formulários complexos de admissão.

**Confiança visual:** componente `<ConfidenceBadge value={0..1} />` reutilizável (verde ≥0.9, amarelo ≥0.7, vermelho <0.7).

---

## Ordem de execução proposta

Vou executar **todas as 5 fases na sequência** num único loop após sua aprovação, mas confirmo: dado o tamanho, a Fase 1 (migration) será aplicada primeiro (precisa da sua aprovação no popup de migração), depois código + edge functions em sequência. Se preferir entregar fase a fase com check no meio, me avise.

**Fora do escopo desta entrega** (peça depois se quiser): exportação consolidada em PDF, integração com folha de pagamento externa, geração automática de holerite, controle de banco de horas (compensação).
