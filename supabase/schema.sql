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
      where players.player_id <> 'robot'
        and players.player_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    );
$$;

create table if not exists public.chess_games (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid,
  visibility text not null default 'public' check (visibility = 'public'),
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
  alter column visibility set default 'public';

update public.chess_games
set visibility = 'public'
where visibility is null;

alter table public.chess_games
  alter column visibility set not null;

alter table public.chess_games
  drop constraint if exists chess_games_visibility_check;

alter table public.chess_games
  add constraint chess_games_visibility_check
  check (visibility = 'public');

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
grant select, insert, update, delete on public.chess_games to authenticated;

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
drop policy if exists "Allow owner delete chess games" on public.chess_games;

create or replace function public.chess_games_guard_update()
returns trigger
language plpgsql
as $$
declare
  join_context boolean := coalesce(current_setting('app.chess_join', true), '') = 'on';
  slot text;
  old_value text;
  new_value text;
  changed_slots integer := 0;
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
    if join_context then
      if new.visibility <> old.visibility then
        raise exception 'Visibility is immutable';
      end if;

      if new.fen <> old.fen or new.pgn <> old.pgn or new.turn <> old.turn or new.status <> old.status then
        raise exception 'Join can only update player assignment';
      end if;

      foreach slot in array array['white', 'red', 'black', 'blue'] loop
        old_value := old.player_ids ->> slot;
        new_value := new.player_ids ->> slot;

        if old_value is distinct from new_value then
          changed_slots := changed_slots + 1;
          if old_value is not null then
            raise exception 'Join cannot overwrite assigned slot';
          end if;
          if new_value <> auth.uid()::text then
            raise exception 'Join can only assign current user';
          end if;
        end if;
      end loop;

      if changed_slots <> 1 then
        raise exception 'Join must claim exactly one free slot';
      end if;
    else
      if new.visibility <> old.visibility then
        raise exception 'Only owner can change visibility';
      end if;

      if new.player_ids <> old.player_ids then
        raise exception 'Only owner can change player_ids';
      end if;
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

create or replace function public.join_chess_game(p_game_id uuid, p_color text default null)
returns table (
  id uuid,
  player_ids jsonb,
  assigned_color text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  game_row public.chess_games%rowtype;
  target_color text;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_color is not null and p_color not in ('white', 'red', 'black', 'blue') then
    raise exception 'Invalid color: %', p_color;
  end if;

  select * into game_row
  from public.chess_games
  where chess_games.id = p_game_id
  for update;

  if not found then
    raise exception 'Game not found';
  end if;

  if game_row.visibility <> 'public' then
    raise exception 'Game is not joinable';
  end if;

  assigned_color := (
    select players.slot
    from jsonb_each_text(game_row.player_ids) as players(slot, player_id)
    where players.player_id = current_user_id::text
    limit 1
  );
  if assigned_color is not null then
    id := game_row.id;
    player_ids := game_row.player_ids;
    return next;
    return;
  end if;

  if p_color is not null then
    if coalesce(game_row.player_ids ->> p_color, '') <> '' then
      raise exception 'Selected color is already assigned';
    end if;
    target_color := p_color;
  else
    select slot into target_color
    from unnest(array['white', 'red', 'black', 'blue']) as slot
    where coalesce(game_row.player_ids ->> slot, '') = ''
    limit 1;
  end if;

  if target_color is null then
    raise exception 'No free color available';
  end if;

  perform set_config('app.chess_join', 'on', true);

  update public.chess_games
  set player_ids = jsonb_set(
    game_row.player_ids,
    array[target_color],
    to_jsonb(current_user_id::text),
    true
  ),
  updated_at = now()
  where chess_games.id = game_row.id
  returning chess_games.id, chess_games.player_ids
  into id, player_ids;

  assigned_color := target_color;
  return next;
end;
$$;

grant execute on function public.join_chess_game(uuid, text) to authenticated;

create policy "Allow multiplayer read chess games"
on public.chess_games
for select
to authenticated
using (visibility = 'public');

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

create policy "Allow owner delete chess games"
on public.chess_games
for delete
to authenticated
using (owner_id = auth.uid());
