
-- Tipos
DO $$ BEGIN
  CREATE TYPE public.justification_type AS ENUM ('atestado','falta_justificada','atraso','saida_antecipada','outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.request_type AS ENUM ('ferias','folga','troca_turno','hora_extra','abono','outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.occurrence_type AS ENUM ('advertencia','suspensao','elogio','observacao');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.review_status AS ENUM ('pendente','aprovada','recusada','cancelada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Helper: o employee_id do usuário autenticado
CREATE OR REPLACE FUNCTION public.get_employee_id(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.employees WHERE user_id = _user_id LIMIT 1;
$$;

-- ============ employee_justifications ============
CREATE TABLE public.employee_justifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  user_id uuid,
  tipo public.justification_type NOT NULL,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  motivo text,
  attachment_path text,
  status public.review_status NOT NULL DEFAULT 'pendente',
  reviewer_id uuid,
  reviewer_comment text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_just_emp ON public.employee_justifications(employee_id, status);
CREATE INDEX idx_just_company ON public.employee_justifications(company_id, status);
ALTER TABLE public.employee_justifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Funcionário vê próprias justificativas"
  ON public.employee_justifications FOR SELECT TO authenticated
  USING (
    employee_id = public.get_employee_id(auth.uid())
    OR is_company_member(auth.uid(), company_id)
  );

CREATE POLICY "Funcionário cria justificativa"
  ON public.employee_justifications FOR INSERT TO authenticated
  WITH CHECK (
    employee_id = public.get_employee_id(auth.uid())
    OR (is_company_member(auth.uid(), company_id) AND public.is_dp_or_admin(auth.uid()))
  );

CREATE POLICY "Funcionário edita pendente, DP edita tudo"
  ON public.employee_justifications FOR UPDATE TO authenticated
  USING (
    (employee_id = public.get_employee_id(auth.uid()) AND status = 'pendente')
    OR (is_company_member(auth.uid(), company_id) AND public.is_dp_or_admin(auth.uid()))
  );

CREATE POLICY "DP remove justificativa"
  ON public.employee_justifications FOR DELETE TO authenticated
  USING (is_company_member(auth.uid(), company_id) AND public.is_dp_or_admin(auth.uid()));

CREATE TRIGGER trg_just_updated_at BEFORE UPDATE ON public.employee_justifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ employee_requests ============
CREATE TABLE public.employee_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  user_id uuid,
  tipo public.request_type NOT NULL,
  data_inicio date NOT NULL,
  data_fim date,
  motivo text,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.review_status NOT NULL DEFAULT 'pendente',
  reviewer_id uuid,
  reviewer_comment text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_req_emp ON public.employee_requests(employee_id, status);
CREATE INDEX idx_req_company ON public.employee_requests(company_id, status);
ALTER TABLE public.employee_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Funcionário vê próprias solicitações"
  ON public.employee_requests FOR SELECT TO authenticated
  USING (
    employee_id = public.get_employee_id(auth.uid())
    OR is_company_member(auth.uid(), company_id)
  );

CREATE POLICY "Funcionário cria solicitação"
  ON public.employee_requests FOR INSERT TO authenticated
  WITH CHECK (
    employee_id = public.get_employee_id(auth.uid())
    OR (is_company_member(auth.uid(), company_id) AND public.is_dp_or_admin(auth.uid()))
  );

CREATE POLICY "Funcionário edita pendente, DP edita tudo (req)"
  ON public.employee_requests FOR UPDATE TO authenticated
  USING (
    (employee_id = public.get_employee_id(auth.uid()) AND status = 'pendente')
    OR (is_company_member(auth.uid(), company_id) AND public.is_dp_or_admin(auth.uid()))
  );

CREATE POLICY "DP remove solicitação"
  ON public.employee_requests FOR DELETE TO authenticated
  USING (is_company_member(auth.uid(), company_id) AND public.is_dp_or_admin(auth.uid()));

CREATE TRIGGER trg_req_updated_at BEFORE UPDATE ON public.employee_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ employee_occurrences ============
CREATE TABLE public.employee_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  tipo public.occurrence_type NOT NULL,
  data date NOT NULL DEFAULT CURRENT_DATE,
  titulo text NOT NULL,
  descricao text,
  attachment_path text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_occ_emp ON public.employee_occurrences(employee_id, data);
CREATE INDEX idx_occ_company ON public.employee_occurrences(company_id, data);
ALTER TABLE public.employee_occurrences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Funcionário vê próprias ocorrências"
  ON public.employee_occurrences FOR SELECT TO authenticated
  USING (
    employee_id = public.get_employee_id(auth.uid())
    OR is_company_member(auth.uid(), company_id)
  );

CREATE POLICY "DP gerencia ocorrências"
  ON public.employee_occurrences FOR ALL TO authenticated
  USING (is_company_member(auth.uid(), company_id) AND public.is_dp_or_admin(auth.uid()))
  WITH CHECK (is_company_member(auth.uid(), company_id) AND public.is_dp_or_admin(auth.uid()));

CREATE TRIGGER trg_occ_updated_at BEFORE UPDATE ON public.employee_occurrences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
