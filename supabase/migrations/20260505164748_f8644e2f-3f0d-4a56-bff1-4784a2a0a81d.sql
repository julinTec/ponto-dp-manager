
-- Limpa órfãos antes de criar FKs
UPDATE public.employee_documents SET employee_id = NULL
 WHERE employee_id IS NOT NULL
   AND employee_id NOT IN (SELECT id FROM public.employees);

DELETE FROM public.employee_documents
 WHERE company_id NOT IN (SELECT id FROM public.companies);

DELETE FROM public.admission_documents
 WHERE admission_id NOT IN (SELECT id FROM public.employee_admissions);

DELETE FROM public.payroll_adjustments
 WHERE employee_id NOT IN (SELECT id FROM public.employees)
    OR company_id NOT IN (SELECT id FROM public.companies);

UPDATE public.payroll_adjustments SET batch_id = NULL
 WHERE batch_id IS NOT NULL
   AND batch_id NOT IN (SELECT id FROM public.timesheet_batches);

-- employee_documents
ALTER TABLE public.employee_documents
  ADD CONSTRAINT employee_documents_employee_id_fkey
  FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;

ALTER TABLE public.employee_documents
  ADD CONSTRAINT employee_documents_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- admission_documents
ALTER TABLE public.admission_documents
  ADD CONSTRAINT admission_documents_admission_id_fkey
  FOREIGN KEY (admission_id) REFERENCES public.employee_admissions(id) ON DELETE CASCADE;

-- payroll_adjustments
ALTER TABLE public.payroll_adjustments
  ADD CONSTRAINT payroll_adjustments_employee_id_fkey
  FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;

ALTER TABLE public.payroll_adjustments
  ADD CONSTRAINT payroll_adjustments_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE public.payroll_adjustments
  ADD CONSTRAINT payroll_adjustments_batch_id_fkey
  FOREIGN KEY (batch_id) REFERENCES public.timesheet_batches(id) ON DELETE SET NULL;

-- índices para performance dos joins
CREATE INDEX IF NOT EXISTS idx_employee_documents_employee_id ON public.employee_documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_documents_company_id ON public.employee_documents(company_id);
CREATE INDEX IF NOT EXISTS idx_admission_documents_admission_id ON public.admission_documents(admission_id);
CREATE INDEX IF NOT EXISTS idx_payroll_adjustments_employee_id ON public.payroll_adjustments(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_adjustments_company_id ON public.payroll_adjustments(company_id);
