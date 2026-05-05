
-- ===== ENUMS =====
DO $$ BEGIN
  CREATE TYPE public.work_schedule_type AS ENUM ('5x2','6x1','12x36','escala','outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.admission_status AS ENUM ('em_analise','aprovado','rejeitado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.admission_doc_type AS ENUM ('ficha','rg','cpf','comprovante_residencia','ctps','contrato','exame_admissional','outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.checklist_status AS ENUM ('recebido','pendente','rejeitado','em_analise');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.employee_doc_type AS ENUM ('atestado','advertencia','suspensao','declaracao','justificativa','outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.employee_doc_status AS ENUM ('pendente_revisao','validado','rejeitado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payroll_adj_type AS ENUM ('dsr_desconto','he_extra','outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ocr_status AS ENUM ('pendente','processando','concluido','falhou');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===== EMPLOYEES — novos campos =====
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS rg text,
  ADD COLUMN IF NOT EXISTS data_nascimento date,
  ADD COLUMN IF NOT EXISTS endereco text,
  ADD COLUMN IF NOT EXISTS telefone text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS cargo text,
  ADD COLUMN IF NOT EXISTS admission_date date,
  ADD COLUMN IF NOT EXISTS salario numeric(12,2),
  ADD COLUMN IF NOT EXISTS work_schedule_type public.work_schedule_type;

-- ===== TIME_ENTRIES — novos campos =====
ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS is_absence boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS absence_type text,
  ADD COLUMN IF NOT EXISTS is_justified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_medical_certificate boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dsr_discount_applicable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS night_hours numeric(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overtime_hours numeric(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS missing_hours numeric(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS worked_hours numeric(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source_document_id uuid;

-- ===== EMPLOYEE_ADMISSIONS =====
CREATE TABLE IF NOT EXISTS public.employee_admissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  employee_id uuid,
  status public.admission_status NOT NULL DEFAULT 'em_analise',
  dados_extraidos jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.employee_admissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members view admissions" ON public.employee_admissions;
CREATE POLICY "Members view admissions" ON public.employee_admissions FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
DROP POLICY IF EXISTS "Admins insert admissions" ON public.employee_admissions;
CREATE POLICY "Admins insert admissions" ON public.employee_admissions FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) OR (company_id = public.get_user_company(auth.uid()) AND public.has_role(auth.uid(),'admin'::app_role)));
DROP POLICY IF EXISTS "Admins update admissions" ON public.employee_admissions;
CREATE POLICY "Admins update admissions" ON public.employee_admissions FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR (company_id = public.get_user_company(auth.uid()) AND public.has_role(auth.uid(),'admin'::app_role)));
DROP POLICY IF EXISTS "Admins delete admissions" ON public.employee_admissions;
CREATE POLICY "Admins delete admissions" ON public.employee_admissions FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR (company_id = public.get_user_company(auth.uid()) AND public.has_role(auth.uid(),'admin'::app_role)));

DROP TRIGGER IF EXISTS set_admissions_updated ON public.employee_admissions;
CREATE TRIGGER set_admissions_updated BEFORE UPDATE ON public.employee_admissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== ADMISSION_DOCUMENTS =====
CREATE TABLE IF NOT EXISTS public.admission_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id uuid NOT NULL,
  tipo public.admission_doc_type NOT NULL,
  storage_path text NOT NULL,
  original_name text,
  mime_type text,
  tamanho_bytes bigint,
  ocr_status public.ocr_status NOT NULL DEFAULT 'pendente',
  dados_extraidos jsonb NOT NULL DEFAULT '{}'::jsonb,
  confianca numeric(4,3),
  erro text,
  checklist_status public.checklist_status NOT NULL DEFAULT 'em_analise',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admission_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members view admission docs" ON public.admission_documents;
CREATE POLICY "Members view admission docs" ON public.admission_documents FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.employee_admissions a WHERE a.id = admission_documents.admission_id AND public.is_company_member(auth.uid(), a.company_id)));
DROP POLICY IF EXISTS "Admins manage admission docs" ON public.admission_documents;
CREATE POLICY "Admins manage admission docs" ON public.admission_documents FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.employee_admissions a WHERE a.id = admission_documents.admission_id AND (public.is_super_admin(auth.uid()) OR (a.company_id = public.get_user_company(auth.uid()) AND public.has_role(auth.uid(),'admin'::app_role)))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.employee_admissions a WHERE a.id = admission_documents.admission_id AND (public.is_super_admin(auth.uid()) OR (a.company_id = public.get_user_company(auth.uid()) AND public.has_role(auth.uid(),'admin'::app_role)))));

-- ===== EMPLOYEE_DOCUMENTS =====
CREATE TABLE IF NOT EXISTS public.employee_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  employee_id uuid,
  document_type public.employee_doc_type NOT NULL,
  storage_path text NOT NULL,
  original_name text,
  mime_type text,
  tamanho_bytes bigint,
  document_date date,
  start_date date,
  end_date date,
  status public.employee_doc_status NOT NULL DEFAULT 'pendente_revisao',
  ai_extracted_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  confianca numeric(4,3),
  needs_review boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members view employee docs" ON public.employee_documents;
CREATE POLICY "Members view employee docs" ON public.employee_documents FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
DROP POLICY IF EXISTS "Members insert employee docs" ON public.employee_documents;
CREATE POLICY "Members insert employee docs" ON public.employee_documents FOR INSERT TO authenticated
  WITH CHECK (public.is_company_member(auth.uid(), company_id));
DROP POLICY IF EXISTS "Members update employee docs" ON public.employee_documents;
CREATE POLICY "Members update employee docs" ON public.employee_documents FOR UPDATE TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
DROP POLICY IF EXISTS "Admins delete employee docs" ON public.employee_documents;
CREATE POLICY "Admins delete employee docs" ON public.employee_documents FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR (company_id = public.get_user_company(auth.uid()) AND public.has_role(auth.uid(),'admin'::app_role)));

DROP TRIGGER IF EXISTS set_emp_docs_updated ON public.employee_documents;
CREATE TRIGGER set_emp_docs_updated BEFORE UPDATE ON public.employee_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== PAYROLL_ADJUSTMENTS =====
CREATE TABLE IF NOT EXISTS public.payroll_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  batch_id uuid,
  data date,
  tipo public.payroll_adj_type NOT NULL,
  valor_horas numeric(6,2) NOT NULL DEFAULT 0,
  valor_monetario numeric(12,2),
  origem_documento_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payroll_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members view payroll adj" ON public.payroll_adjustments;
CREATE POLICY "Members view payroll adj" ON public.payroll_adjustments FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
DROP POLICY IF EXISTS "Members insert payroll adj" ON public.payroll_adjustments;
CREATE POLICY "Members insert payroll adj" ON public.payroll_adjustments FOR INSERT TO authenticated
  WITH CHECK (public.is_company_member(auth.uid(), company_id));
DROP POLICY IF EXISTS "Admins update payroll adj" ON public.payroll_adjustments;
CREATE POLICY "Admins update payroll adj" ON public.payroll_adjustments FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR (company_id = public.get_user_company(auth.uid()) AND public.has_role(auth.uid(),'admin'::app_role)));
DROP POLICY IF EXISTS "Admins delete payroll adj" ON public.payroll_adjustments;
CREATE POLICY "Admins delete payroll adj" ON public.payroll_adjustments FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR (company_id = public.get_user_company(auth.uid()) AND public.has_role(auth.uid(),'admin'::app_role)));

-- ===== STORAGE BUCKET employee-docs =====
INSERT INTO storage.buckets (id, name, public)
VALUES ('employee-docs', 'employee-docs', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Members read employee-docs" ON storage.objects;
CREATE POLICY "Members read employee-docs" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'employee-docs' AND public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid));
DROP POLICY IF EXISTS "Members upload employee-docs" ON storage.objects;
CREATE POLICY "Members upload employee-docs" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'employee-docs' AND public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid));
DROP POLICY IF EXISTS "Admins delete employee-docs" ON storage.objects;
CREATE POLICY "Admins delete employee-docs" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'employee-docs' AND (public.is_super_admin(auth.uid()) OR (((storage.foldername(name))[1])::uuid = public.get_user_company(auth.uid()) AND public.has_role(auth.uid(),'admin'::app_role))));

-- ===== FUNÇÃO recalc_time_entry =====
CREATE OR REPLACE FUNCTION public.recalc_time_entry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  jornada numeric;
  worked_min numeric := 0;
  ent_min numeric;
  sai_min numeric;
  int_s_min numeric;
  int_r_min numeric;
  night_min numeric := 0;
  ent_total int;
  sai_total int;
  ovl int;
BEGIN
  -- jornada do funcionário
  IF NEW.employee_id IS NOT NULL THEN
    SELECT COALESCE(jornada_padrao_horas, 8) INTO jornada
    FROM public.employees WHERE id = NEW.employee_id;
  END IF;
  IF jornada IS NULL THEN jornada := 8; END IF;

  -- ausência: zera horas
  IF NEW.is_absence OR NEW.status IN ('falta','folga','feriado') THEN
    NEW.worked_hours := 0;
    NEW.overtime_hours := 0;
    NEW.night_hours := 0;
    -- horas faltantes só contam se não houver justificativa e não for folga/feriado
    IF (NEW.status = 'falta' OR NEW.is_absence) AND NOT NEW.is_justified THEN
      NEW.missing_hours := jornada;
      NEW.dsr_discount_applicable := true;
    ELSE
      NEW.missing_hours := 0;
      NEW.dsr_discount_applicable := false;
    END IF;
    RETURN NEW;
  END IF;

  -- calcula minutos quando horários presentes
  IF NEW.entrada IS NOT NULL AND NEW.saida_final IS NOT NULL THEN
    ent_min := EXTRACT(EPOCH FROM NEW.entrada)/60;
    sai_min := EXTRACT(EPOCH FROM NEW.saida_final)/60;
    IF sai_min < ent_min THEN sai_min := sai_min + 1440; END IF; -- vira o dia
    worked_min := sai_min - ent_min;
    IF NEW.saida_intervalo IS NOT NULL AND NEW.retorno_intervalo IS NOT NULL THEN
      int_s_min := EXTRACT(EPOCH FROM NEW.saida_intervalo)/60;
      int_r_min := EXTRACT(EPOCH FROM NEW.retorno_intervalo)/60;
      IF int_r_min < int_s_min THEN int_r_min := int_r_min + 1440; END IF;
      worked_min := worked_min - (int_r_min - int_s_min);
    END IF;

    -- adicional noturno: interseção com [22:00, 29:00] (05:00 do dia seguinte)
    ent_total := ent_min::int;
    sai_total := sai_min::int;
    -- janela 1: 22:00–24:00
    ovl := LEAST(sai_total, 1440) - GREATEST(ent_total, 1320);
    IF ovl > 0 THEN night_min := night_min + ovl; END IF;
    -- janela 2: 24:00–29:00 (05:00 do dia seguinte)
    ovl := LEAST(sai_total, 1740) - GREATEST(ent_total, 1440);
    IF ovl > 0 THEN night_min := night_min + ovl; END IF;
    -- janela 0: 00:00–05:00 (caso entrada de madrugada sem virada)
    ovl := LEAST(sai_total, 300) - GREATEST(ent_total, 0);
    IF ovl > 0 AND ent_total < 300 THEN night_min := night_min + ovl; END IF;
  END IF;

  NEW.worked_hours := ROUND((worked_min/60)::numeric, 2);
  NEW.overtime_hours := GREATEST(0, ROUND((NEW.worked_hours - jornada)::numeric, 2));
  NEW.missing_hours := GREATEST(0, ROUND((jornada - NEW.worked_hours)::numeric, 2));
  NEW.night_hours := ROUND((night_min/60)::numeric, 2);
  NEW.dsr_discount_applicable := false;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_time_entry ON public.time_entries;
CREATE TRIGGER trg_recalc_time_entry BEFORE INSERT OR UPDATE ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.recalc_time_entry();

-- ===== FUNÇÃO apply_medical_certificate =====
CREATE OR REPLACE FUNCTION public.apply_medical_certificate(
  _employee_id uuid,
  _start date,
  _end date,
  _document_id uuid DEFAULT NULL
) RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected int := 0;
  comp uuid;
BEGIN
  IF NOT (public.is_super_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = _employee_id AND public.is_company_member(auth.uid(), e.company_id)
  )) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.time_entries
     SET is_absence = true,
         absence_type = 'atestado',
         is_justified = true,
         has_medical_certificate = true,
         dsr_discount_applicable = false,
         status = 'falta'::entry_status,
         source_document_id = COALESCE(_document_id, source_document_id),
         observacoes = COALESCE(observacoes,'') ||
           CASE WHEN observacoes IS NULL OR observacoes = '' THEN 'Atestado médico aplicado' ELSE ' | Atestado médico aplicado' END
   WHERE employee_id = _employee_id
     AND data BETWEEN _start AND _end;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;
