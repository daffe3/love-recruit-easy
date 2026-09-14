ALTER FUNCTION public.user_role() SET search_path = public;
ALTER FUNCTION public.user_customer_id() SET search_path = public;

REVOKE ALL ON FUNCTION public.user_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_customer_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_accounts() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.user_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_customer_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_accounts() TO authenticated;