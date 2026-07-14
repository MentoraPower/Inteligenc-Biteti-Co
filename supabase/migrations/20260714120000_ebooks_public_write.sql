-- Make the ebooks bucket/table writable by anon (like email-assets), so PDF upload
-- from the (anon) browser session works instead of being blocked by an authenticated-only policy.
drop policy if exists ebooks_obj_write on storage.objects;
create policy ebooks_obj_write on storage.objects for insert to public with check (bucket_id = 'ebooks');
drop policy if exists ebooks_obj_update on storage.objects;
create policy ebooks_obj_update on storage.objects for update to public using (bucket_id = 'ebooks') with check (bucket_id = 'ebooks');

drop policy if exists ebooks_auth_write on public.ebooks;
drop policy if exists ebooks_public_write on public.ebooks;
create policy ebooks_public_write on public.ebooks for all to public using (true) with check (true);
