-- Least privilege on SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.user_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_customer_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_accounts() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.user_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_customer_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_accounts() TO authenticated, service_role;

-- CV uploads: restrict updates and deletes to the owning tenant
DROP POLICY IF EXISTS cv_update_own_tenant ON storage.objects;
CREATE POLICY cv_update_own_tenant
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'cv-uploads'
  AND (
    public.user_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.candidates c
      WHERE c.id::text = (storage.foldername(storage.objects.name))[1]
        AND c.customer_id = public.user_customer_id()
    )
  )
)
WITH CHECK (
  bucket_id = 'cv-uploads'
  AND (
    public.user_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.candidates c
      WHERE c.id::text = (storage.foldername(storage.objects.name))[1]
        AND c.customer_id = public.user_customer_id()
    )
  )
);

DROP POLICY IF EXISTS cv_delete_own_tenant ON storage.objects;
CREATE POLICY cv_delete_own_tenant
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'cv-uploads'
  AND (
    public.user_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.candidates c
      WHERE c.id::text = (storage.foldername(storage.objects.name))[1]
        AND c.customer_id = public.user_customer_id()
    )
  )
);