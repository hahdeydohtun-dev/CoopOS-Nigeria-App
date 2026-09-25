create policy "member docs readable by owner or staff"
on storage.objects for select to authenticated
using (
  bucket_id = 'member-documents'
  and (
    exists (select 1 from public.members m
      where m.id = ((storage.foldername(name))[2])::uuid and m.user_id = auth.uid())
    or public.has_permission(((storage.foldername(name))[1])::uuid, 'members.view', auth.uid())
    or public.can_admin_cooperative(((storage.foldername(name))[1])::uuid, auth.uid())
  )
);

create policy "member docs uploaded by owner or staff"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'member-documents'
  and (
    exists (select 1 from public.members m
      where m.id = ((storage.foldername(name))[2])::uuid and m.user_id = auth.uid())
    or public.has_permission(((storage.foldername(name))[1])::uuid, 'members.manage', auth.uid())
    or public.can_admin_cooperative(((storage.foldername(name))[1])::uuid, auth.uid())
  )
);

create policy "member docs managed by staff"
on storage.objects for update to authenticated
using (
  bucket_id = 'member-documents'
  and (public.has_permission(((storage.foldername(name))[1])::uuid, 'members.manage', auth.uid())
       or public.can_admin_cooperative(((storage.foldername(name))[1])::uuid, auth.uid()))
)
with check (
  bucket_id = 'member-documents'
  and (public.has_permission(((storage.foldername(name))[1])::uuid, 'members.manage', auth.uid())
       or public.can_admin_cooperative(((storage.foldername(name))[1])::uuid, auth.uid()))
);

create policy "member docs removed by staff"
on storage.objects for delete to authenticated
using (
  bucket_id = 'member-documents'
  and (public.has_permission(((storage.foldername(name))[1])::uuid, 'members.manage', auth.uid())
       or public.can_admin_cooperative(((storage.foldername(name))[1])::uuid, auth.uid()))
);