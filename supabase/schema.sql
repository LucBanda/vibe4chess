create extension if not exists pgcrypto;

create table if not exists public.chess_games (
  id uuid primary key default gen_random_uuid(),
  fen text not null,
  pgn text not null default '',
  turn text not null check (turn in ('w', 'b')),
  status text not null default 'active' check (status in ('active', 'finished')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.chess_games enable row level security;

create policy "Allow anon read chess games"
on public.chess_games
for select
to anon
using (true);

create policy "Allow anon insert chess games"
on public.chess_games
for insert
to anon
with check (true);

create policy "Allow anon update chess games"
on public.chess_games
for update
to anon
using (true)
with check (true);
