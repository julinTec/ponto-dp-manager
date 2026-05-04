
-- =========================
-- ENUMS
-- =========================
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'revisor');
CREATE TYPE public.batch_status AS ENUM ('enviado', 'processando', 'aguardando_revisao', 'revisado', 'exportado');
CREATE TYPE public.entry_status AS ENUM ('ok', 'inconsistente', 'falta', 'folga', 'feriado');
CREATE TYPE public.employee_status AS ENUM ('ativo', 'pendente_validacao', 'inativo');
CREATE TYPE public.ocr_status AS ENUM ('pendente', 'processando', 'concluido', 'falhou');

-- =========================
-- COMPANIES
-- =========================
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cnpj TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================
-- PROFILES
-- =========================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  nome TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================
-- USER ROLES
-- =========================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, company_id, role)
);

-- =========================
-- EMPLOYEES
-- =========================
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cpf TEXT,
  funcao TEXT,
  jornada_padrao_horas NUMERIC(4,2) DEFAULT 8.00,
  status public.employee_status NOT NULL DEFAULT 'ativo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_employees_company ON public.employees(company_id);
CREATE INDEX idx_employees_cpf ON public.employees(company_id, cpf);

-- =========================
-- TIMESHEET BATCHES
-- =========================
CREATE TABLE public.timesheet_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  mes_referencia INT,
  ano_referencia INT,
  status public.batch_status NOT NULL DEFAULT 'enviado',
  total_paginas INT DEFAULT 0,
  total_marcacoes INT DEFAULT 0,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_batches_company ON public.timesheet_batches(company_id);
CREATE INDEX idx_batches_status ON public.timesheet_batches(company_id, status);

-- =========================
-- TIMESHEET FILES
-- =========================
CREATE TABLE public.timesheet_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.timesheet_batches(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  original_name TEXT,
  mime_type TEXT,
  tamanho_bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_files_batch ON public.timesheet_files(batch_id);

-- =========================
-- TIMESHEET PAGES
-- =========================
CREATE TABLE public.timesheet_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES public.timesheet_files(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES public.timesheet_batches(id) ON DELETE CASCADE,
  numero_pagina INT NOT NULL,
  image_path TEXT,
  ocr_status public.ocr_status NOT NULL DEFAULT 'pendente',
  confianca_media NUMERIC(4,3),
  erro TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pages_batch ON public.timesheet_pages(batch_id);

-- =========================
-- TIME ENTRIES
-- =========================
CREATE TABLE public.time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.timesheet_batches(id) ON DELETE CASCADE,
  page_id UUID REFERENCES public.timesheet_pages(id) ON DELETE SET NULL,
  employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  nome_lido TEXT,
  cpf_lido TEXT,
  funcao_lida TEXT,
  data DATE,
  dia_semana TEXT,
  entrada TIME,
  saida_intervalo TIME,
  retorno_intervalo TIME,
  saida_final TIME,
  status public.entry_status NOT NULL DEFAULT 'ok',
  observacoes TEXT,
  confianca NUMERIC(4,3),
  revisado BOOLEAN NOT NULL DEFAULT false,
  revisado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  revisado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_entries_batch ON public.time_entries(batch_id);
CREATE INDEX idx_entries_employee ON public.time_entries(employee_id, data);

-- =========================
-- PROCESSING LOGS
-- =========================
CREATE TABLE public.processing_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.timesheet_batches(id) ON DELETE CASCADE,
  nivel TEXT NOT NULL DEFAULT 'info',
  mensagem TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_logs_batch ON public.processing_logs(batch_id);

-- =========================
-- HELPER FUNCTIONS
-- =========================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_company(_user_id UUID)
RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE id = _user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_company_member(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND company_id = _company_id
  ) OR public.is_super_admin(_user_id);
$$;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_companies_updated BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_employees_updated BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_batches_updated BEFORE UPDATE ON public.timesheet_batches FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_entries_updated BEFORE UPDATE ON public.time_entries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- SIGNUP TRIGGER: cria company + profile + role admin
-- =========================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_company_id UUID;
  user_nome TEXT;
  empresa_nome TEXT;
BEGIN
  user_nome := COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1));
  empresa_nome := COALESCE(NEW.raw_user_meta_data->>'empresa', 'Empresa de ' || user_nome);

  INSERT INTO public.companies (nome) VALUES (empresa_nome) RETURNING id INTO new_company_id;
  INSERT INTO public.profiles (id, company_id, nome, email) VALUES (NEW.id, new_company_id, user_nome, NEW.email);
  INSERT INTO public.user_roles (user_id, company_id, role) VALUES (NEW.id, new_company_id, 'admin');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================
-- ENABLE RLS
-- =========================
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timesheet_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timesheet_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timesheet_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_logs ENABLE ROW LEVEL SECURITY;

-- COMPANIES
CREATE POLICY "Members view own company" ON public.companies FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()) OR id = public.get_user_company(auth.uid()));
CREATE POLICY "Admins update own company" ON public.companies FOR UPDATE TO authenticated
USING (public.is_super_admin(auth.uid()) OR (id = public.get_user_company(auth.uid()) AND public.has_role(auth.uid(), 'admin')));
CREATE POLICY "Super admin all companies" ON public.companies FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- PROFILES
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid() OR public.is_super_admin(auth.uid()) OR company_id = public.get_user_company(auth.uid()));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- USER ROLES
CREATE POLICY "View roles in own company" ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()) OR company_id = public.get_user_company(auth.uid()));
CREATE POLICY "Admins manage roles in own company" ON public.user_roles FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()) OR (company_id = public.get_user_company(auth.uid()) AND public.has_role(auth.uid(), 'admin')))
WITH CHECK (public.is_super_admin(auth.uid()) OR (company_id = public.get_user_company(auth.uid()) AND public.has_role(auth.uid(), 'admin')));

-- EMPLOYEES
CREATE POLICY "Members view employees" ON public.employees FOR SELECT TO authenticated
USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Admins insert employees" ON public.employees FOR INSERT TO authenticated
WITH CHECK (public.is_super_admin(auth.uid()) OR (company_id = public.get_user_company(auth.uid()) AND public.has_role(auth.uid(), 'admin')));
CREATE POLICY "Admins update employees" ON public.employees FOR UPDATE TO authenticated
USING (public.is_super_admin(auth.uid()) OR (company_id = public.get_user_company(auth.uid()) AND public.has_role(auth.uid(), 'admin')));
CREATE POLICY "Admins delete employees" ON public.employees FOR DELETE TO authenticated
USING (public.is_super_admin(auth.uid()) OR (company_id = public.get_user_company(auth.uid()) AND public.has_role(auth.uid(), 'admin')));

-- BATCHES
CREATE POLICY "Members view batches" ON public.timesheet_batches FOR SELECT TO authenticated
USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members insert batches" ON public.timesheet_batches FOR INSERT TO authenticated
WITH CHECK (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members update batches" ON public.timesheet_batches FOR UPDATE TO authenticated
USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Admins delete batches" ON public.timesheet_batches FOR DELETE TO authenticated
USING (public.is_super_admin(auth.uid()) OR (company_id = public.get_user_company(auth.uid()) AND public.has_role(auth.uid(), 'admin')));

-- FILES (via batch)
CREATE POLICY "Members view files" ON public.timesheet_files FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.timesheet_batches b WHERE b.id = batch_id AND public.is_company_member(auth.uid(), b.company_id)));
CREATE POLICY "Members manage files" ON public.timesheet_files FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.timesheet_batches b WHERE b.id = batch_id AND public.is_company_member(auth.uid(), b.company_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.timesheet_batches b WHERE b.id = batch_id AND public.is_company_member(auth.uid(), b.company_id)));

-- PAGES
CREATE POLICY "Members view pages" ON public.timesheet_pages FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.timesheet_batches b WHERE b.id = batch_id AND public.is_company_member(auth.uid(), b.company_id)));
CREATE POLICY "Members manage pages" ON public.timesheet_pages FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.timesheet_batches b WHERE b.id = batch_id AND public.is_company_member(auth.uid(), b.company_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.timesheet_batches b WHERE b.id = batch_id AND public.is_company_member(auth.uid(), b.company_id)));

-- TIME ENTRIES
CREATE POLICY "Members view entries" ON public.time_entries FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.timesheet_batches b WHERE b.id = batch_id AND public.is_company_member(auth.uid(), b.company_id)));
CREATE POLICY "Members manage entries" ON public.time_entries FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.timesheet_batches b WHERE b.id = batch_id AND public.is_company_member(auth.uid(), b.company_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.timesheet_batches b WHERE b.id = batch_id AND public.is_company_member(auth.uid(), b.company_id)));

-- LOGS
CREATE POLICY "Members view logs" ON public.processing_logs FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.timesheet_batches b WHERE b.id = batch_id AND public.is_company_member(auth.uid(), b.company_id)));
CREATE POLICY "Members insert logs" ON public.processing_logs FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.timesheet_batches b WHERE b.id = batch_id AND public.is_company_member(auth.uid(), b.company_id)));

-- =========================
-- STORAGE BUCKET
-- =========================
INSERT INTO storage.buckets (id, name, public) VALUES ('timesheets', 'timesheets', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Members read timesheet files" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'timesheets' AND (
  public.is_super_admin(auth.uid())
  OR (storage.foldername(name))[1] = public.get_user_company(auth.uid())::text
));

CREATE POLICY "Members upload timesheet files" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'timesheets' AND (
  public.is_super_admin(auth.uid())
  OR (storage.foldername(name))[1] = public.get_user_company(auth.uid())::text
));

CREATE POLICY "Members update timesheet files" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'timesheets' AND (
  public.is_super_admin(auth.uid())
  OR (storage.foldername(name))[1] = public.get_user_company(auth.uid())::text
));

CREATE POLICY "Members delete timesheet files" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'timesheets' AND (
  public.is_super_admin(auth.uid())
  OR (storage.foldername(name))[1] = public.get_user_company(auth.uid())::text
));
