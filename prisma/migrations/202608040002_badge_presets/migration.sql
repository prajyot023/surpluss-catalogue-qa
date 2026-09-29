create table badge_presets (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  bg text not null check (bg ~ '^#[0-9a-f]{6}$'),
  fg text not null check (fg in ('black', 'white')),
  created_at timestamptz not null default now()
);
create unique index badge_presets_text_key on badge_presets (lower(text));

-- Starter badges; admins can delete or replace them like any saved badge.
insert into badge_presets (text, bg, fg) values
  ('Hot Deal', '#ffde59', 'black'),
  ('Limited Time', '#ef4444', 'white');
