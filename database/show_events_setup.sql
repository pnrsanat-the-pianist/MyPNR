-- Yeni Gösteri Tanımla sayfası için Supabase tablo kurulumu.
-- Supabase SQL Editor içinde çalıştırın.

create extension if not exists pgcrypto;

create table if not exists public.show_events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  show_date date not null,
  hall_name text not null default '',
  rent_expense numeric(12, 2) not null default 0,
  participants jsonb not null default '[]'::jsonb,
  venue_expenses jsonb not null default '[]'::jsonb,
  teachers jsonb not null default '[]'::jsonb,
  program jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint show_events_name_not_empty check (length(trim(name)) > 0),
  constraint show_events_participants_array check (jsonb_typeof(participants) = 'array'),
  constraint show_events_venue_expenses_array check (jsonb_typeof(venue_expenses) = 'array'),
  constraint show_events_teachers_array check (jsonb_typeof(teachers) = 'array'),
  constraint show_events_program_array check (jsonb_typeof(program) = 'array')
);

create index if not exists idx_show_events_show_date
  on public.show_events (show_date desc);

create index if not exists idx_show_events_created_at
  on public.show_events (created_at desc);

create or replace function public.set_show_events_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_show_events_updated_at
  on public.show_events;

create trigger trg_show_events_updated_at
before update on public.show_events
for each row
execute function public.set_show_events_updated_at();

alter table public.show_events enable row level security;

drop policy if exists show_events_select on public.show_events;
create policy show_events_select
on public.show_events
for select
to authenticated
using (true);

drop policy if exists show_events_insert on public.show_events;
create policy show_events_insert
on public.show_events
for insert
to authenticated
with check (true);

drop policy if exists show_events_update on public.show_events;
create policy show_events_update
on public.show_events
for update
to authenticated
using (true)
with check (true);

drop policy if exists show_events_delete on public.show_events;
create policy show_events_delete
on public.show_events
for delete
to authenticated
using (true);
