
-- Campos OCR/IA em admission_documents
ALTER TABLE public.admission_documents
  ADD COLUMN IF NOT EXISTS ocr_text text,
  ADD COLUMN IF NOT EXISTS ocr_text_clean text,
  ADD COLUMN IF NOT EXISTS ai_model_used text,
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS review_notes text,
  ADD COLUMN IF NOT EXISTS extraction_status text NOT NULL DEFAULT 'pendente';

-- Campos OCR/IA em employee_documents (ai_extracted_data, confianca, needs_review já existem)
ALTER TABLE public.employee_documents
  ADD COLUMN IF NOT EXISTS ocr_text text,
  ADD COLUMN IF NOT EXISTS ocr_text_clean text,
  ADD COLUMN IF NOT EXISTS ai_model_used text,
  ADD COLUMN IF NOT EXISTS extraction_status text NOT NULL DEFAULT 'pendente';

-- Expandir admission_doc_type
ALTER TYPE public.admission_doc_type ADD VALUE IF NOT EXISTS 'cnh';
ALTER TYPE public.admission_doc_type ADD VALUE IF NOT EXISTS 'certidao_nascimento';
ALTER TYPE public.admission_doc_type ADD VALUE IF NOT EXISTS 'certidao_casamento';
ALTER TYPE public.admission_doc_type ADD VALUE IF NOT EXISTS 'certificado_escolar';
ALTER TYPE public.admission_doc_type ADD VALUE IF NOT EXISTS 'titulo_eleitor';
ALTER TYPE public.admission_doc_type ADD VALUE IF NOT EXISTS 'pis_pasep';
ALTER TYPE public.admission_doc_type ADD VALUE IF NOT EXISTS 'reservista';

-- Expandir employee_doc_type
ALTER TYPE public.employee_doc_type ADD VALUE IF NOT EXISTS 'rg';
ALTER TYPE public.employee_doc_type ADD VALUE IF NOT EXISTS 'cpf';
ALTER TYPE public.employee_doc_type ADD VALUE IF NOT EXISTS 'cnh';
ALTER TYPE public.employee_doc_type ADD VALUE IF NOT EXISTS 'ctps';
ALTER TYPE public.employee_doc_type ADD VALUE IF NOT EXISTS 'comprovante_residencia';
ALTER TYPE public.employee_doc_type ADD VALUE IF NOT EXISTS 'certidao_nascimento';
ALTER TYPE public.employee_doc_type ADD VALUE IF NOT EXISTS 'certidao_casamento';
ALTER TYPE public.employee_doc_type ADD VALUE IF NOT EXISTS 'certificado_escolar';
ALTER TYPE public.employee_doc_type ADD VALUE IF NOT EXISTS 'titulo_eleitor';
ALTER TYPE public.employee_doc_type ADD VALUE IF NOT EXISTS 'pis_pasep';
ALTER TYPE public.employee_doc_type ADD VALUE IF NOT EXISTS 'reservista';
ALTER TYPE public.employee_doc_type ADD VALUE IF NOT EXISTS 'contrato';
ALTER TYPE public.employee_doc_type ADD VALUE IF NOT EXISTS 'exame_admissional';
ALTER TYPE public.employee_doc_type ADD VALUE IF NOT EXISTS 'ficha';

-- Garantir aprovada no enum admission_status (atualmente é 'aprovado'; adiciona 'aprovada' como alias se útil; pula)
