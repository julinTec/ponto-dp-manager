-- Remove o tipo errado criado antes (não está em uso)
DROP TYPE IF EXISTS public.document_type;

-- Adiciona novos valores ao enum existente employee_doc_type
ALTER TYPE public.employee_doc_type ADD VALUE IF NOT EXISTS 'ferias';
ALTER TYPE public.employee_doc_type ADD VALUE IF NOT EXISTS 'aviso_previo';
ALTER TYPE public.employee_doc_type ADD VALUE IF NOT EXISTS 'rescisao';
ALTER TYPE public.employee_doc_type ADD VALUE IF NOT EXISTS 'comprovante_pagamento';

CREATE OR REPLACE FUNCTION public.recompute_dsr_for_employee_month(
  _employee_id uuid,
  _ano int,
  _mes int
) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  comp uuid;
  jornada numeric;
  total_added int := 0;
  inicio date := make_date(_ano, _mes, 1);
  fim date := (make_date(_ano, _mes, 1) + INTERVAL '1 month - 1 day')::date;
  semana_ini date;
  semana_fim date;
  tem_falta boolean;
  bid uuid;
BEGIN
  IF NOT (public.is_super_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = _employee_id AND public.is_company_member(auth.uid(), e.company_id)
  )) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT company_id, COALESCE(jornada_padrao_horas,8) INTO comp, jornada
  FROM public.employees WHERE id = _employee_id;

  DELETE FROM public.payroll_adjustments
   WHERE employee_id = _employee_id
     AND tipo = 'dsr_desconto'
     AND data BETWEEN inicio AND fim;

  semana_ini := inicio - ((EXTRACT(DOW FROM inicio)::int + 6) % 7);
  WHILE semana_ini <= fim LOOP
    semana_fim := semana_ini + 6;
    SELECT EXISTS (
      SELECT 1 FROM public.time_entries te
      WHERE te.employee_id = _employee_id
        AND te.data BETWEEN GREATEST(semana_ini, inicio) AND LEAST(semana_fim, fim)
        AND te.dsr_discount_applicable = true
    ) INTO tem_falta;

    IF tem_falta THEN
      SELECT te.batch_id INTO bid
      FROM public.time_entries te
      WHERE te.employee_id = _employee_id
        AND te.data BETWEEN GREATEST(semana_ini, inicio) AND LEAST(semana_fim, fim)
      LIMIT 1;

      INSERT INTO public.payroll_adjustments (
        company_id, employee_id, batch_id, data, tipo, valor_horas, notes
      ) VALUES (
        comp, _employee_id, bid, LEAST(semana_fim, fim),
        'dsr_desconto', jornada,
        'DSR descontado por falta injustificada na semana ' || semana_ini || ' a ' || semana_fim
      );
      total_added := total_added + 1;
    END IF;
    semana_ini := semana_ini + 7;
  END LOOP;

  RETURN total_added;
END $$;