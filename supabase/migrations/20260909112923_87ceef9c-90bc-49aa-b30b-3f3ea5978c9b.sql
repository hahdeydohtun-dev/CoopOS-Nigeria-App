
-- RLS helpers: keep available to signed-in users only.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, uuid, public.app_role) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_platform_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.can_admin_cooperative(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_admin_cooperative(uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_member_of_cooperative(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_member_of_cooperative(uuid, uuid) TO authenticated;

-- Trigger routines: never called directly by app users.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_audit_event() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_journal_posting_rules() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_posted_transaction_immutability() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_segregation_of_duties() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_posted_journal_lines() FROM PUBLIC, anon, authenticated;
