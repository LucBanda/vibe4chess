create extension if not exists pgcrypto;

create or replace function public.is_valid_chess_player_ids(candidate jsonb)
returns boolean
language sql
immutable
as $$
  select
    jsonb_typeof(candidate) = 'object'
    and (candidate - 'white' - 'red' - 'black' - 'blue') = '{}'::jsonb
    and not exists (
      select 1
      from jsonb_each_text(candidate) as players(slot, player_id)
      where players.player_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    );
$$;

create table if not exists public.chess_games (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid,
  visibility text not null default 'private' check (visibility in ('public', 'private')),
  player_ids jsonb not null default '{}'::jsonb,
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
  add column if not exists visibility text;

alter table public.chess_games
  alter column visibility set default 'private';

update public.chess_games
set visibility = 'private'
where visibility is null;

alter table public.chess_games
  alter column visibility set not null;

alter table public.chess_games
  drop constraint if exists chess_games_visibility_check;

alter table public.chess_games
  add constraint chess_games_visibility_check
  check (visibility in ('public', 'private'));

alter table public.chess_games
  add column if not exists player_ids jsonb;

alter table public.chess_games
  alter column player_ids set default '{}'::jsonb;

update public.chess_games
set player_ids = '{}'::jsonb
where player_ids is null;

alter table public.chess_games
  alter column player_ids set not null;

alter table public.chess_games
  drop constraint if exists chess_games_player_ids_object_check;

alter table public.chess_games
  add constraint chess_games_player_ids_object_check
  check (public.is_valid_chess_player_ids(player_ids));

alter table public.chess_games
  drop constraint if exists chess_games_player_ids_keys_check;

alter table public.chess_games
  drop constraint if exists chess_games_player_ids_uuid_check;

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

create index if not exists chess_games_visibility_idx
  on public.chess_games(visibility);

alter table public.chess_games enable row level security;
alter table public.chess_games force row level security;

revoke all on public.chess_games from anon;
revoke all on public.chess_games from authenticated;
grant select, insert, update on public.chess_games to authenticated;

drop policy if exists "Allow anon read chess games" on public.chess_games;
drop policy if exists "Allow anon insert chess games" on public.chess_games;
drop policy if exists "Allow anon update chess games" on public.chess_games;
drop policy if exists "Allow owner read chess games" on public.chess_games;
drop policy if exists "Allow owner insert chess games" on public.chess_games;
drop policy if exists "Allow owner update chess games" on public.chess_games;
drop policy if exists "Allow multiplayer read chess games" on public.chess_games;
drop policy if exists "Allow multiplayer insert chess games" on public.chess_games;
drop policy if exists "Allow multiplayer update chess games" on public.chess_games;
drop policy if exists "Allow owner full update chess games" on public.chess_games;
drop policy if exists "Allow participant state update chess games" on public.chess_games;

create or replace function public.chess_games_guard_update()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if new.owner_id <> old.owner_id then
    raise exception 'owner_id is immutable';
  end if;

  if new.created_at <> old.created_at then
    raise exception 'created_at is immutable';
  end if;

  if auth.uid() <> old.owner_id then
    if new.visibility <> old.visibility then
      raise exception 'Only owner can change visibility';
    end if;

    if new.player_ids <> old.player_ids then
      raise exception 'Only owner can change player_ids';
    end if;
  end if;

  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists chess_games_guard_update_trigger on public.chess_games;

create trigger chess_games_guard_update_trigger
before update on public.chess_games
for each row
execute function public.chess_games_guard_update();

create policy "Allow multiplayer read chess games"
on public.chess_games
for select
to authenticated
using (
  visibility = 'public'
  or owner_id = auth.uid()
  or exists (
    select 1
    from jsonb_each_text(player_ids) as players(slot, player_id)
    where players.player_id = auth.uid()::text
  )
);

create policy "Allow multiplayer insert chess games"
on public.chess_games
for insert
to authenticated
with check (
  owner_id = auth.uid()
  and exists (
    select 1
    from jsonb_each_text(player_ids) as players(slot, player_id)
    where players.player_id = auth.uid()::text
  )
);

create policy "Allow owner full update chess games"
on public.chess_games
for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "Allow participant state update chess games"
on public.chess_games
for update
to authenticated
using (
  exists (
    select 1
    from jsonb_each_text(player_ids) as players(slot, player_id)
    where players.player_id = auth.uid()::text
  )
)
with check (
  exists (
    select 1
    from jsonb_each_text(player_ids) as players(slot, player_id)
    where players.player_id = auth.uid()::text
  )
);
