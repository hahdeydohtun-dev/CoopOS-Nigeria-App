alter function public.member_status_transition_allowed(public.member_lifecycle_status, public.member_lifecycle_status) set search_path = public;

revoke all on function public.validate_next_of_kin_percentage() from public, anon, authenticated;
revoke all on function public.member_status_transition_allowed(public.member_lifecycle_status, public.member_lifecycle_status) from public, anon;
grant execute on function public.member_status_transition_allowed(public.member_lifecycle_status, public.member_lifecycle_status) to authenticated;