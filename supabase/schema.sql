create extension if not exists pgcrypto;

create table if not exists public.chess_games (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid,
  fen text not null,
  pgn text not null default '',
  turn text not null,
  status text not null default 'active' check (status in ('active', 'finished')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.chess_games
  add column if not exists owner_id uuid;

alter table public.chess_games
  alter column owner_id set default auth.uid();

update public.chess_games
set owner_id = gen_random_uuid()
where owner_id is null;

alter table public.chess_games
  alter column owner_id set not null;

alter table public.chess_games
  drop constraint if exists chess_games_turn_check;

alter table public.chess_games
  add constraint chess_games_turn_check
  check (turn in ('w', 'b', 'white', 'red', 'black', 'blue'));

create index if not exists chess_games_owner_id_idx
  on public.chess_games(owner_id);

alter table public.chess_games enable row level security;

drop policy if exists "Allow anon read chess games" on public.chess_games;
drop policy if exists "Allow anon insert chess games" on public.chess_games;
drop policy if exists "Allow anon update chess games" on public.chess_games;
drop policy if exists "Allow owner read chess games" on public.chess_games;
drop policy if exists "Allow owner insert chess games" on public.chess_games;
drop policy if exists "Allow owner update chess games" on public.chess_games;

create policy "Allow owner read chess games"
on public.chess_games
for select
to authenticated
using (owner_id = auth.uid());

create policy "Allow owner insert chess games"
on public.chess_games
for insert
to authenticated
with check (owner_id = auth.uid());

create policy "Allow owner update chess games"
on public.chess_games
for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());
