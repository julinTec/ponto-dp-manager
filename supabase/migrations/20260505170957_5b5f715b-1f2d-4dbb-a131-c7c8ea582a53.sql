
-- 1) Apagar marcações vinculadas a páginas duplicadas
WITH ranked AS (
  SELECT id, batch_id, file_id,
         ROW_NUMBER() OVER (PARTITION BY batch_id, file_id ORDER BY created_at) AS rn
  FROM public.timesheet_pages
)
DELETE FROM public.time_entries
WHERE page_id IN (SELECT id FROM ranked WHERE rn > 1);

-- 2) Apagar as páginas duplicadas
WITH ranked AS (
  SELECT id, batch_id, file_id,
         ROW_NUMBER() OVER (PARTITION BY batch_id, file_id ORDER BY created_at) AS rn
  FROM public.timesheet_pages
)
DELETE FROM public.timesheet_pages
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 3) Renumerar páginas restantes sequencialmente
WITH ord AS (
  SELECT p.id,
         ROW_NUMBER() OVER (
           PARTITION BY p.batch_id
           ORDER BY f.created_at NULLS LAST, f.original_name NULLS LAST, p.created_at
         ) AS novo_num
  FROM public.timesheet_pages p
  LEFT JOIN public.timesheet_files f ON f.id = p.file_id
)
UPDATE public.timesheet_pages tp
SET numero_pagina = ord.novo_num
FROM ord
WHERE tp.id = ord.id;

-- 4) Recalcular totais nos lotes
UPDATE public.timesheet_batches b
SET total_paginas = COALESCE((SELECT COUNT(*) FROM public.timesheet_pages WHERE batch_id = b.id), 0),
    total_marcacoes = COALESCE((SELECT COUNT(*) FROM public.time_entries WHERE batch_id = b.id), 0);

-- 5) Constraint de unicidade
ALTER TABLE public.timesheet_pages
  ADD CONSTRAINT timesheet_pages_batch_file_num_unique
  UNIQUE (batch_id, file_id, numero_pagina);

-- 6) FKs de cascade (idempotente: usa IF NOT EXISTS via DO block)
DO $$ BEGIN
  ALTER TABLE public.timesheet_pages
    ADD CONSTRAINT timesheet_pages_batch_id_fkey
    FOREIGN KEY (batch_id) REFERENCES public.timesheet_batches(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.timesheet_pages
    ADD CONSTRAINT timesheet_pages_file_id_fkey
    FOREIGN KEY (file_id) REFERENCES public.timesheet_files(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.time_entries
    ADD CONSTRAINT time_entries_batch_id_fkey
    FOREIGN KEY (batch_id) REFERENCES public.timesheet_batches(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.time_entries
    ADD CONSTRAINT time_entries_page_id_fkey
    FOREIGN KEY (page_id) REFERENCES public.timesheet_pages(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.time_entries
    ADD CONSTRAINT time_entries_employee_id_fkey
    FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.timesheet_files
    ADD CONSTRAINT timesheet_files_batch_id_fkey
    FOREIGN KEY (batch_id) REFERENCES public.timesheet_batches(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.timesheet_batches
    ADD CONSTRAINT timesheet_batches_company_id_fkey
    FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.employees
    ADD CONSTRAINT employees_company_id_fkey
    FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
