-- Storage buckets
insert into storage.buckets (id, name, public)
values
  ('listing-photos',  'listing-photos',  true),
  ('profile-photos',  'profile-photos',  true),
  ('id-documents',    'id-documents',    false);

-- listing-photos: anyone can read, only owner can upload
create policy "listing-photos: public read"
  on storage.objects for select
  using (bucket_id = 'listing-photos');

create policy "listing-photos: auth insert"
  on storage.objects for insert
  with check (bucket_id = 'listing-photos' and auth.role() = 'authenticated');

create policy "listing-photos: owner delete"
  on storage.objects for delete
  using (bucket_id = 'listing-photos' and auth.uid()::text = (storage.foldername(name))[1]);

-- profile-photos: anyone can read, owner can upload/delete
create policy "profile-photos: public read"
  on storage.objects for select
  using (bucket_id = 'profile-photos');

create policy "profile-photos: own insert"
  on storage.objects for insert
  with check (bucket_id = 'profile-photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "profile-photos: own delete"
  on storage.objects for delete
  using (bucket_id = 'profile-photos' and auth.uid()::text = (storage.foldername(name))[1]);

-- id-documents: only owner and service role can access
create policy "id-docs: own insert"
  on storage.objects for insert
  with check (bucket_id = 'id-documents' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "id-docs: own read"
  on storage.objects for select
  using (bucket_id = 'id-documents' and auth.uid()::text = (storage.foldername(name))[1]);
