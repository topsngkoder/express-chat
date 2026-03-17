-- Allow UPDATE only for own messages (drop if exists for idempotency)
drop policy if exists "messages_update_own" on public.messages;
create policy "messages_update_own"
  on public.messages
  for update
  to authenticated
  using (sender_id = auth.uid())
  with check (sender_id = auth.uid());

-- Allow DELETE only for own messages (drop if exists for idempotency)
drop policy if exists "messages_delete_own" on public.messages;
create policy "messages_delete_own"
  on public.messages
  for delete
  to authenticated
  using (sender_id = auth.uid());
