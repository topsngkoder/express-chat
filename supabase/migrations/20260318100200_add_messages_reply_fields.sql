-- Add reply-to-message fields to messages (snapshot preserved when original is deleted)
alter table public.messages
  add column if not exists reply_to_message_id uuid null,
  add column if not exists reply_to_sender_id uuid null,
  add column if not exists reply_to_sender_name text null,
  add column if not exists reply_to_preview_text text null,
  add column if not exists reply_to_has_image boolean null;

-- Self-reference FK: when original message is deleted, only the link is nulled; snapshot columns stay
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'messages_reply_to_message_id_fkey'
  ) then
    alter table public.messages
      add constraint messages_reply_to_message_id_fkey
      foreign key (reply_to_message_id) references public.messages(id)
      on delete set null;
  end if;
end $$;

comment on column public.messages.reply_to_message_id is 'ID of the message this one replies to; null if no reply or original was deleted.';
comment on column public.messages.reply_to_sender_id is 'Snapshot: sender id of the replied-to message.';
comment on column public.messages.reply_to_sender_name is 'Snapshot: display name of the replied-to message.';
comment on column public.messages.reply_to_preview_text is 'Snapshot: preview text of the replied-to message.';
comment on column public.messages.reply_to_has_image is 'Snapshot: whether the replied-to message had an image.';
