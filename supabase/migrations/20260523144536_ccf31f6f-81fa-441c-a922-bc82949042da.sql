CREATE OR REPLACE FUNCTION public.is_dp_or_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_super_admin(_user_id)
      OR public.has_role(_user_id, 'admin'::app_role)
      OR public.has_role(_user_id, 'dp'::app_role);
$$;