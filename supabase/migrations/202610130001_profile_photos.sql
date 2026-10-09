begin;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('profile-photos','profile-photos',false,1048576,array['image/webp'])
on conflict (id) do nothing;

create policy "Profile photo owners read" on storage.objects for select to authenticated
using (bucket_id='profile-photos' and (storage.foldername(name))[1]=(select auth.uid()::text));
create policy "Profile photo owners upload" on storage.objects for insert to authenticated
with check (bucket_id='profile-photos' and (storage.foldername(name))[1]=(select auth.uid()::text));
create policy "Profile photo owners delete" on storage.objects for delete to authenticated
using (bucket_id='profile-photos' and (storage.foldername(name))[1]=(select auth.uid()::text));

commit;
