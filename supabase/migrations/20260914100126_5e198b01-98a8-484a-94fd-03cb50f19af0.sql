GRANT SELECT ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
GRANT SELECT ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs TO authenticated;
GRANT ALL ON public.jobs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidates TO authenticated;
GRANT ALL ON public.candidates TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidate_pipeline TO authenticated;
GRANT ALL ON public.candidate_pipeline TO service_role;

DROP POLICY IF EXISTS customers_select ON public.customers;
CREATE POLICY customers_select ON public.customers
FOR SELECT TO authenticated
USING (public.user_role() = 'admin' OR id = public.user_customer_id());

CREATE OR REPLACE FUNCTION public.admin_list_accounts()
RETURNS TABLE (id uuid, full_name text, email text, role text, customer_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, u.email::text, p.role, c.name
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  LEFT JOIN public.customers c ON c.id = p.customer_id
  WHERE public.user_role() = 'admin'
  ORDER BY p.created_at DESC NULLS LAST
$$;

REVOKE ALL ON FUNCTION public.admin_list_accounts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_accounts() TO authenticated;