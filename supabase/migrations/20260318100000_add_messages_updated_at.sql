-- Add updated_at to messages (only set on edit, not on insert)
alter table public.messages
  add column if not exists updated_at timestamptz null;

comment on column public.messages.updated_at is 'Set when the message text was edited; null if never edited.';
