
# Reestruturação Operacional — Ponto DP Manager

Objetivo: tornar a empresa o núcleo do sistema, eliminar retrabalho entre admissão e cadastro de funcionário, baratear o OCR (local + gpt-4o-mini só com texto) e organizar storage/dados por empresa. Preservar tudo que já funciona (ponto geolocalizado, fechamento mensal, RLS, layouts, logo).

---

## 1. Empresa ativa como contexto global

**Problema hoje:** `companies` existe, mas o operacional não respeita uma "empresa ativa". Super admin e usuários com múltiplos vínculos não têm seletor; filtros por empresa ficam ad-hoc por página.

**Mudanças:**
- Criar `CompanyContext` (`src/contexts/CompanyContext.tsx`) com `activeCompanyId`, lista de empresas acessíveis ao usuário, `setActiveCompany()` e persistência em `localStorage` (`fluxor.activeCompanyId`).
- Provider envolvendo `<App />` dentro de `BrowserRouter`.
- Hook `useActiveCompany()` consumido por toda página/serviço que faz query por empresa.
- Seletor de empresa no topo de `AppLayout` (header), visível para super_admin e usuários multiempresa; oculto/somente-leitura para usuários de uma única empresa.
- `Dashboard`, `Funcionarios`, `Admissoes`, `Documentos`, `Aprovacoes`, `FechamentoMensal`, `Relatorios`, `Usuarios`, `Lotes` passam a filtrar por `activeCompanyId` (substituindo o uso direto de `get_user_company`).
- Inserts (admissão, funcionário, documento, lote, ajuste) usam `activeCompanyId` em vez de inferir.
- `CompanyFilter` existente é refatorado para consumir o contexto (compatibilidade preservada).

**Não muda:** RLS atual continua válida — a empresa ativa é um filtro de UI; o backend continua validando via `is_company_member` e `has_role(_, _, company_id)`.

---

## 2. Fluxo unificado Admissão → Funcionário (sem retrabalho)

**Hoje:** `employee_admissions` e `employees` são tabelas separadas; após aprovar admissão é preciso criar funcionário manualmente.

**Mudança:** ao aprovar uma admissão, o sistema cria/atualiza automaticamente o registro em `employees` e vincula documentos.

- Nova edge function `admission-approve`:
  1. Lê `employee_admissions.dados_extraidos` + campos complementares (salário, cargo, função, jornada, contrato) enviados pelo DP.
  2. Faz upsert em `employees` (chave: cpf + company_id; cria `user_id` nulo).
  3. Atualiza `employee_admissions.status = 'aprovada'` e `employee_id`.
  4. Re-vincula `admission_documents` → cria entradas em `employee_documents` (mesmo storage_path; sem duplicar arquivo).
  5. Cria registro inicial em `employee_occurrences` (tipo "admissao").
- Tela `AdmissaoDetalhe` ganha seção "Complementar para aprovação" com os 5 campos obrigatórios (salário, cargo, função, jornada, contrato) + botão "Aprovar e gerar funcionário".
- Página `Admissoes` ganha CTA "Nova admissão" que abre wizard: empresa (pré-selecionada do contexto) → upload de documentos → OCR/IA → revisão → aprovação.
- Remove o fluxo manual duplicado de "criar funcionário do zero" da página `Funcionarios` (mantém edição/inativação); novos funcionários só nascem por admissão. Manter botão "Adicionar manual" apenas para super_admin como fallback.

---

## 3. OCR econômico (Nível 1) + revisão manual (Nível 2)

**Hoje:** `admission-pdf-extract` envia o PDF inteiro para OpenAI (Files API + gpt-4o-mini multimodal). Caro e desnecessário.

**Mudança — pipeline novo, sem remover o antigo até validar:**

### Nível 1 — OCR local + texto para gpt-4o-mini

Edge function nova `admission-ocr-extract`:
1. Baixa o arquivo do storage.
2. Se PDF: usa `pdf.js` (já presente em `src/lib/pdfToImages.ts`) para extrair **texto nativo** página a página. Se o PDF for escaneado (texto vazio), renderiza páginas em imagem e chama Tesseract.
3. Se imagem: chama Tesseract diretamente.
4. **Tesseract via WASM** rodando no edge (`tesseract.js` em Deno) com idiomas `por+eng`. Alternativa avaliada no detalhe técnico: fazer o OCR no client (browser) e enviar só o texto — mais barato ainda e tira carga do edge.
5. Pré-processa o texto: normaliza UTF-8, remove caracteres de controle, colapsa linhas vazias, detecta idioma, trunca em ~12k chars/documento.
6. Envia para `gpt-4o-mini` (chat completions, texto puro) com system prompt que identifica tipo de documento e devolve JSON estruturado (schema do item 6 do brief).
7. Persiste: `ocr_text` (bruto), `ocr_text_clean`, `ai_extracted_data`, `ai_model_used`, `ocr_confidence`, `extraction_status`, `needs_review`.

### Nível 2 — Revisão manual

- Quando `ocr_confidence < 0.7` OU `extraction_status = 'falhou'` → `needs_review = true`, status visual "Precisa revisão".
- Tela `AdmissaoDetalhe` (e nova aba em `Documentos`) mostra editor lado a lado: preview do documento + form com os campos extraídos editáveis. DP corrige → salva → marca como revisado.

**Antigo `admission-pdf-extract`** permanece deployado por uma sprint como fallback (flag `USE_LEGACY_OCR`), depois é removido.

---

## 4. Documentos reconhecidos & schema unificado

Estender o enum `document_type` (em `employee_documents`) e o enum de `admission_documents.tipo` para cobrir:
`rg, cpf, cnh, ctps, comprovante_residencia, certidao_nascimento, certidao_casamento, certificado_escolar, titulo_eleitor, pis_pasep, reservista, atestado, advertencia, suspensao, contrato, exame_admissional, outro`.

A IA recebe o tipo "sugerido" pelo upload (escolha do usuário) e também tenta classificar; divergência marca `needs_review`.

---

## 5. Storage reorganizado

Padronizar paths no bucket `employee-docs`:

```
{company_id}/funcionarios/{employee_id}/admissao/{admission_id}/{tipo}/{uuid}.{ext}
{company_id}/funcionarios/{employee_id}/documentos/{tipo}/{uuid}.{ext}
{company_id}/funcionarios/{employee_id}/atestados/{uuid}.{ext}
{company_id}/funcionarios/{employee_id}/advertencias/{uuid}.{ext}
{company_id}/funcionarios/{employee_id}/suspensoes/{uuid}.{ext}
```

- Para admissão sem `employee_id` ainda: `{company_id}/admissoes/{admission_id}/...`. Ao aprovar, a edge function move (ou apenas referencia) para o caminho final do funcionário.
- Migração lazy: arquivos antigos continuam acessíveis pelos `storage_path` salvos; só novos uploads seguem o padrão.
- Policies RLS de storage permanecem (já company-scoped pela migração de segurança anterior).

---

## 6. Funcionário como centro operacional

- `FichaFuncionario` ganha abas: **Resumo**, **Documentos** (pasta digital), **Ponto**, **Ocorrências** (atestados/advertências/suspensões), **Fechamentos**, **Admissões**.
- Pasta digital é alimentada automaticamente pela aprovação da admissão (item 2).

---

## 7. Ponto geolocalizado

Sem mudanças funcionais. Apenas garantir que `punch_records.company_id` é sempre o `activeCompanyId` (já é hoje) e que o histórico do funcionário e o fechamento mensal continuam consumindo essa tabela.

---

## Detalhes técnicos

### Migrations SQL

```sql
-- Campos de OCR/IA em admission_documents
ALTER TABLE public.admission_documents
  ADD COLUMN ocr_text text,
  ADD COLUMN ocr_text_clean text,
  ADD COLUMN ai_model_used text,
  ADD COLUMN needs_review boolean NOT NULL DEFAULT false,
  ADD COLUMN review_notes text,
  ADD COLUMN extraction_status text NOT NULL DEFAULT 'pendente';

-- Mesmos campos em employee_documents (já tem ai_extracted_data, confianca, needs_review)
ALTER TABLE public.employee_documents
  ADD COLUMN ocr_text text,
  ADD COLUMN ocr_text_clean text,
  ADD COLUMN ai_model_used text,
  ADD COLUMN extraction_status text NOT NULL DEFAULT 'pendente';

-- Expandir enums document_type e admission_documents.tipo com os novos tipos
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'cnh';
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'certidao_nascimento';
-- ... (todos os tipos listados)
```

### Estrutura de arquivos (novos)

```
src/contexts/CompanyContext.tsx
src/hooks/useActiveCompany.ts
src/components/CompanySwitcher.tsx          (no header do AppLayout)
src/components/admission/AdmissionWizard.tsx
src/components/admission/DocumentReviewPanel.tsx
src/components/admission/ApprovalFormDialog.tsx
src/lib/ocr/tesseractClient.ts              (OCR no browser quando viável)
src/lib/ocr/textCleaner.ts
supabase/functions/admission-ocr-extract/index.ts
supabase/functions/admission-approve/index.ts
```

### Edge function `admission-ocr-extract` (resumo)

- Input: `{ admission_document_id }`
- Modelo: `gpt-4o-mini` via OpenAI direta (já existe `OPENAI_API_KEY`). Não usar gateway por enquanto para manter consistência com função atual.
- System prompt: "Você recebe TEXTO bruto de OCR de um documento brasileiro de RH. Identifique tipo_documento e devolva JSON com os campos do schema. Use null quando não encontrar. Devolva confianca_geral 0..1."
- Response format: `{ type: 'json_object' }`.
- Sem `vision`, sem upload de arquivo para OpenAI.

### Edge function `admission-approve` (resumo)

- Input: `{ admission_id, complementos: { salario, cargo, funcao, jornada_padrao_horas, contrato_path? } }`
- Faz upsert em `employees` por `(company_id, cpf)`.
- Insere em `employee_documents` referenciando cada `admission_documents` aprovado.
- Atualiza admissão para `aprovada`, seta `employee_id`.
- Tudo em transação via `rpc` se possível, ou sequência idempotente.

### Compatibilidade
- `admission-pdf-extract` mantém-se como fallback até validar Nível 1.
- Páginas que hoje filtram por `get_user_company` passam a aceitar override do `activeCompanyId` quando o usuário é super_admin / multiempresa.

---

## Ordem de execução proposta

1. **Migrations** (campos OCR, enums, sem breaking changes).
2. **CompanyContext + CompanySwitcher** no header (sem alterar queries ainda).
3. Refatorar páginas-chave para consumir `activeCompanyId`.
4. Edge function `admission-ocr-extract` + UI de revisão.
5. Edge function `admission-approve` + wizard de admissão.
6. Remover/ocultar criação manual de funcionário (exceto super_admin).
7. Padronização de paths no storage (apenas para novos uploads).
8. Aposentar `admission-pdf-extract` após uma sprint estável.

---

## Itens a confirmar antes de implementar

1. **OCR no edge vs. no browser**: rodar Tesseract WASM no edge é viável mas pesado (cold start ~3-5s). Posso fazer no browser e enviar só o texto para a edge — mais barato e rápido. Tudo bem essa abordagem?
2. **Aprovação remove cadastro manual de funcionário**: confirma que `Funcionarios` perde o botão "Novo funcionário" para todos exceto super_admin?
3. **Empresa ativa**: super_admin precisa ver "Todas as empresas" agregadas em algum lugar (ex.: dashboard global) ou sempre opera com uma selecionada?
