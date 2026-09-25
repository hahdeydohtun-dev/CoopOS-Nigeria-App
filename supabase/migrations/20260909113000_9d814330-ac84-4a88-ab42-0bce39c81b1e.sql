
-- Built-in (global) role catalogue is readable by any signed-in user
CREATE POLICY roles_select_global ON public.roles
  FOR SELECT TO authenticated
  USING (cooperative_id IS NULL);

CREATE POLICY role_perms_select_global ON public.role_permissions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.roles r WHERE r.id = role_permissions.role_id AND r.cooperative_id IS NULL));

-- Colleagues in the same cooperative can see each other's basic profile
CREATE OR REPLACE FUNCTION public.shares_cooperative_with(_other_user_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles a
    JOIN public.user_roles b ON b.cooperative_id = a.cooperative_id
    WHERE a.user_id = _user_id
      AND b.user_id = _other_user_id
      AND a.cooperative_id IS NOT NULL
      AND a.status = 'ACTIVE'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.shares_cooperative_with(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shares_cooperative_with(uuid, uuid) TO authenticated;

CREATE POLICY profiles_select_colleagues ON public.profiles
  FOR SELECT TO authenticated
  USING (public.shares_cooperative_with(id));
