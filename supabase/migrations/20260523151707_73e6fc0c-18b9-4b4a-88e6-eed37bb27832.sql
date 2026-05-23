
-- Tabela de fechamento mensal de ponto por funcionário
CREATE TABLE public.monthly_closures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  ano int NOT NULL,
  mes int NOT NULL CHECK (mes BETWEEN 1 AND 12),
  status text NOT NULL DEFAULT 'aberto', -- aberto | fechado | reaberto
  totais jsonb NOT NULL DEFAULT '{}'::jsonb,
  observacoes text,
  fechado_em timestamptz,
  fechado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employee_id, ano, mes)
);

CREATE INDEX idx_monthly_closures_company_ref ON public.monthly_closures (company_id, ano, mes);
CREATE INDEX idx_monthly_closures_employee_ref ON public.monthly_closures (employee_id, ano, mes);

ALTER TABLE public.monthly_closures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view monthly closures"
  ON public.monthly_closures FOR SELECT
  TO authenticated
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "DP insert monthly closures"
  ON public.monthly_closures FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR (company_id = get_user_company(auth.uid()) AND public.is_dp_or_admin(auth.uid()))
  );

CREATE POLICY "DP update monthly closures"
  ON public.monthly_closures FOR UPDATE
  TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (company_id = get_user_company(auth.uid()) AND public.is_dp_or_admin(auth.uid()))
  );

CREATE POLICY "DP delete monthly closures"
  ON public.monthly_closures FOR DELETE
  TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (company_id = get_user_company(auth.uid()) AND public.is_dp_or_admin(auth.uid()))
  );

CREATE TRIGGER trg_monthly_closures_updated_at
  BEFORE UPDATE ON public.monthly_closures
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
