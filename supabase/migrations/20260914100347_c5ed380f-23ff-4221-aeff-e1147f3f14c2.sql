REVOKE EXECUTE ON FUNCTION public.next_checkoff_batch_number(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_checkoff_batch_number(uuid) TO authenticated, service_role;