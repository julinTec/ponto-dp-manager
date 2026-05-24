
-- 1) Fix mutable search_path
ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.recalc_time_entry() SET search_path = public;

-- 2) Revoke EXECUTE
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_company_member(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_dp_or_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_company(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_employee_id(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.apply_medical_certificate(uuid, date, date, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.recompute_dsr_for_employee_month(uuid, integer, integer) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.recalc_time_entry() FROM anon, authenticated, public;

-- 3) Storage UPDATE policy for employee-docs bucket
DROP POLICY IF EXISTS "Members update employee-docs" ON storage.objects;
CREATE POLICY "Members update employee-docs"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'employee-docs'
  AND public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
)
WITH CHECK (
  bucket_id = 'employee-docs'
  AND public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

-- 4) Restrict employees SELECT
DROP POLICY IF EXISTS "Members view employees" ON public.employees;
CREATE POLICY "Privileged or self view employees"
ON public.employees
FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (
    company_id = public.get_user_company(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'dp'::public.app_role)
      OR public.has_role(auth.uid(), 'gestor'::public.app_role)
      OR public.has_role(auth.uid(), 'revisor'::public.app_role)
    )
  )
  OR user_id = auth.uid()
);

-- 5) Company-scoped role check overload
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role AND company_id = _company_id
  )
$$;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role, uuid) FROM anon;

-- Tighten admin policies to require admin role in the same company
-- employees
DROP POLICY IF EXISTS "Admins update employees" ON public.employees;
CREATE POLICY "Admins update employees"
ON public.employees
FOR UPDATE
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.has_role(auth.uid(), 'admin'::public.app_role, company_id)
);

DROP POLICY IF EXISTS "Admins delete employees" ON public.employees;
CREATE POLICY "Admins delete employees"
ON public.employees
FOR DELETE
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.has_role(auth.uid(), 'admin'::public.app_role, company_id)
);

-- employee_documents
DROP POLICY IF EXISTS "Admins delete employee docs" ON public.employee_documents;
CREATE POLICY "Admins delete employee docs"
ON public.employee_documents
FOR DELETE
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.has_role(auth.uid(), 'admin'::public.app_role, company_id)
);

-- employee-docs storage bucket admin delete
DROP POLICY IF EXISTS "Admins delete employee-docs" ON storage.objects;
CREATE POLICY "Admins delete employee-docs"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'employee-docs'
  AND (
    public.is_super_admin(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role, ((storage.foldername(name))[1])::uuid)
  )
);
