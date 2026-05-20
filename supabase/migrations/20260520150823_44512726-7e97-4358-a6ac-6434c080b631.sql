-- Add 'funcionario' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'funcionario';

-- Companies: address and geofence
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS endereco text,
  ADD COLUMN IF NOT EXISTS latitude numeric(10,7),
  ADD COLUMN IF NOT EXISTS longitude numeric(10,7),
  ADD COLUMN IF NOT EXISTS raio_ponto_metros integer NOT NULL DEFAULT 150;

-- Link employee to auth user
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS user_id uuid;

CREATE INDEX IF NOT EXISTS idx_employees_user_id ON public.employees(user_id);

-- punch_records
CREATE TABLE IF NOT EXISTS public.punch_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  employee_id uuid,
  user_id uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('entrada','saida_intervalo','retorno_intervalo','saida_final')),
  registrado_em timestamptz NOT NULL DEFAULT now(),
  latitude numeric(10,7),
  longitude numeric(10,7),
  accuracy numeric,
  distancia_metros numeric,
  dentro_do_raio boolean NOT NULL DEFAULT false,
  origem text NOT NULL DEFAULT 'web',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_punch_records_user ON public.punch_records(user_id, registrado_em DESC);
CREATE INDEX IF NOT EXISTS idx_punch_records_company ON public.punch_records(company_id, registrado_em DESC);
CREATE INDEX IF NOT EXISTS idx_punch_records_employee ON public.punch_records(employee_id, registrado_em DESC);

ALTER TABLE public.punch_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own punches"
  ON public.punch_records FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users view own punches"
  ON public.punch_records FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_super_admin(auth.uid())
    OR (public.is_company_member(auth.uid(), company_id) AND public.has_role(auth.uid(), 'admin'::app_role))
  );

CREATE POLICY "Admins update company punches"
  ON public.punch_records FOR UPDATE
  TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (public.is_company_member(auth.uid(), company_id) AND public.has_role(auth.uid(), 'admin'::app_role))
  );

CREATE POLICY "Admins delete company punches"
  ON public.punch_records FOR DELETE
  TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (public.is_company_member(auth.uid(), company_id) AND public.has_role(auth.uid(), 'admin'::app_role))
  );