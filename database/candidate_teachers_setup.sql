create extension if not exists pgcrypto;

create table if not exists public.candidate_teachers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  branches text[] not null default '{}',
  graduation text,
  notes jsonb not null default '[]'::jsonb,
  suitability smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint candidate_teachers_suitability_check
    check (suitability between 0 and 3)
);

create index if not exists idx_candidate_teachers_full_name
  on public.candidate_teachers (full_name);

create index if not exists idx_candidate_teachers_branches
  on public.candidate_teachers using gin (branches);

create index if not exists idx_candidate_teachers_created_at
  on public.candidate_teachers (created_at desc);

alter table public.candidate_teachers
  add column if not exists branches text[] not null default '{}';

update public.candidate_teachers
set branches = case
  when coalesce(array_length(branches, 1), 0) > 0 then branches
  when exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'candidate_teachers'
      and column_name = 'branch'
  ) and branch is not null and branch <> '' then array[branch]
  else '{}'
end;

create or replace function public.set_candidate_teachers_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_candidate_teachers_updated_at
  on public.candidate_teachers;

create trigger trg_candidate_teachers_updated_at
before update on public.candidate_teachers
for each row
execute function public.set_candidate_teachers_updated_at();

alter table public.candidate_teachers enable row level security;

drop policy if exists candidate_teachers_select on public.candidate_teachers;
create policy candidate_teachers_select
on public.candidate_teachers
for select
to authenticated
using (true);

drop policy if exists candidate_teachers_insert on public.candidate_teachers;
create policy candidate_teachers_insert
on public.candidate_teachers
for insert
to authenticated
with check (true);

drop policy if exists candidate_teachers_update on public.candidate_teachers;
create policy candidate_teachers_update
on public.candidate_teachers
for update
to authenticated
using (true)
with check (true);

drop policy if exists candidate_teachers_delete on public.candidate_teachers;
create policy candidate_teachers_delete
on public.candidate_teachers
for delete
to authenticated
using (true);
