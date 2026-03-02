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
        and players.player_id !~* '^[a-z0-9_-]{1,32}$'
    );
$$;

create or replace function public.is_valid_chess_player_instances(candidate jsonb)
returns boolean
language sql
immutable
as $$
  select
    jsonb_typeof(candidate) = 'object'
    and (candidate - 'white' - 'red' - 'black' - 'blue') = '{}'::jsonb
    and not exists (
      select 1
      from jsonb_each_text(candidate) as players(slot, instance_id)
      where length(trim(players.instance_id)) = 0
    );
$$;

create or replace function public.is_valid_chess_player_usernames(candidate jsonb)
returns boolean
language sql
immutable
as $$
  select
    jsonb_typeof(candidate) = 'object'
    and (candidate - 'white' - 'red' - 'black' - 'blue') = '{}'::jsonb
    and not exists (
      select 1
      from jsonb_each_text(candidate) as players(slot, username)
      where length(trim(players.username)) = 0
    );
$$;

create table if not exists public.chess_games (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid,
  visibility text not null default 'public' check (visibility = 'public'),
  player_ids jsonb not null default '{}'::jsonb,
  player_instances jsonb not null default '{}'::jsonb,
  player_usernames jsonb not null default '{}'::jsonb,
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
  add column if not exists player_instances jsonb;

alter table public.chess_games
  alter column player_instances set default '{}'::jsonb;

update public.chess_games
set player_instances = '{}'::jsonb
where player_instances is null;

alter table public.chess_games
  alter column player_instances set not null;

alter table public.chess_games
  drop constraint if exists chess_games_player_instances_object_check;

alter table public.chess_games
  add constraint chess_games_player_instances_object_check
  check (public.is_valid_chess_player_instances(player_instances));

alter table public.chess_games
  add column if not exists player_usernames jsonb;

alter table public.chess_games
  alter column player_usernames set default '{}'::jsonb;

update public.chess_games
set player_usernames = '{}'::jsonb
where player_usernames is null;

alter table public.chess_games
  alter column player_usernames set not null;

alter table public.chess_games
  drop constraint if exists chess_games_player_usernames_object_check;

alter table public.chess_games
  add constraint chess_games_player_usernames_object_check
  check (public.is_valid_chess_player_usernames(player_usernames));

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
  join_instance_id text := nullif(coalesce(current_setting('app.chess_instance', true), ''), '');
  join_username text := nullif(coalesce(current_setting('app.chess_username', true), ''), '');
  slot text;
  old_value text;
  new_value text;
  old_instance text;
  new_instance text;
  old_username text;
  new_username text;
  changed_user_slots integer := 0;
  changed_instance_slots integer := 0;
  changed_username_slots integer := 0;
  changed_slot text;
begin
  if auth.uid() is null then
    -- SQL editor / migrations run without JWT context (auth.uid() = null).
    -- Keep guard checks for authenticated clients, but do not block admin migrations.
    new.updated_at = now();
    return new;
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
        old_instance := old.player_instances ->> slot;
        new_instance := new.player_instances ->> slot;
        old_username := old.player_usernames ->> slot;
        new_username := new.player_usernames ->> slot;

        if old_value is distinct from new_value then
          changed_user_slots := changed_user_slots + 1;
          if changed_slot is null then
            changed_slot := slot;
          elsif changed_slot <> slot then
            raise exception 'Join must update one seat only';
          end if;
          if old_value is not null then
            raise exception 'Join cannot overwrite assigned slot';
          end if;
          if join_username is null then
            raise exception 'Join username required';
          end if;
          if new_value <> join_username then
            raise exception 'Join can only assign current username';
          end if;
        end if;

        if old_instance is distinct from new_instance then
          changed_instance_slots := changed_instance_slots + 1;
          if changed_slot is null then
            changed_slot := slot;
          elsif changed_slot <> slot then
            raise exception 'Join must update one seat only';
          end if;
          if old_instance is not null then
            raise exception 'Join cannot overwrite assigned seat instance';
          end if;
          if join_instance_id is null then
            raise exception 'Join instance id required';
          end if;
          if new_instance <> join_instance_id then
            raise exception 'Join can only assign current instance';
          end if;
        end if;

        if old_username is distinct from new_username then
          changed_username_slots := changed_username_slots + 1;
          if changed_slot is null then
            changed_slot := slot;
          elsif changed_slot <> slot then
            raise exception 'Join must update one seat only';
          end if;
          if old_username is not null then
            raise exception 'Join cannot overwrite assigned seat username';
          end if;
          if join_username is null then
            raise exception 'Join username required';
          end if;
          if new_username <> join_username then
            raise exception 'Join can only assign current username';
          end if;
        end if;
      end loop;

      if changed_user_slots <> 1 then
        raise exception 'Join must claim exactly one free slot';
      end if;
      if changed_instance_slots <> 1 then
        raise exception 'Join must record exactly one seat instance';
      end if;
      if changed_username_slots <> 1 then
        raise exception 'Join must record exactly one seat username';
      end if;
    else
      if new.visibility <> old.visibility then
        raise exception 'Only owner can change visibility';
      end if;

      if new.player_ids <> old.player_ids then
        raise exception 'Only owner can change player_ids';
      end if;
      if new.player_instances <> old.player_instances then
        raise exception 'Only owner can change player_instances';
      end if;
      if new.player_usernames <> old.player_usernames then
        raise exception 'Only owner can change player_usernames';
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

drop function if exists public.join_chess_game(uuid, text);
drop function if exists public.join_chess_game(uuid, text, text);
drop function if exists public.join_chess_game(uuid, text, text, text);

create or replace function public.join_chess_game(
  p_game_id uuid,
  p_color text default null,
  p_instance_id text default null,
  p_username text default null
)
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
  current_instance_id text := nullif(trim(coalesce(p_instance_id, '')), '');
  current_username text := lower(regexp_replace(trim(coalesce(p_username, '')), '[^a-zA-Z0-9_-]', '', 'g'));
  game_row public.chess_games%rowtype;
  target_color text;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_color is not null and p_color not in ('white', 'red', 'black', 'blue') then
    raise exception 'Invalid color: %', p_color;
  end if;
  if current_username is null or length(current_username) = 0 then
    raise exception 'Username required';
  end if;
  if length(current_username) > 32 then
    current_username := left(current_username, 32);
  end if;
  if current_instance_id is null or length(current_instance_id) = 0 then
    current_instance_id := current_username;
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
    from jsonb_each_text(game_row.player_usernames) as players(slot, username)
    where players.username = current_username
    limit 1
  );
  if assigned_color is not null then
    id := game_row.id;
    player_ids := game_row.player_ids;
    return next;
    return;
  end if;

  if p_color is not null then
    if coalesce(game_row.player_ids ->> p_color, '') <> ''
       or coalesce(game_row.player_instances ->> p_color, '') <> ''
       or coalesce(game_row.player_usernames ->> p_color, '') <> '' then
      raise exception 'Selected color is already assigned';
    end if;
    target_color := p_color;
  else
    select slot into target_color
    from unnest(array['white', 'red', 'black', 'blue']) as slot
    where coalesce(game_row.player_ids ->> slot, '') = ''
      and coalesce(game_row.player_instances ->> slot, '') = ''
      and coalesce(game_row.player_usernames ->> slot, '') = ''
    limit 1;
  end if;

  if target_color is null then
    raise exception 'No free color available';
  end if;

  perform set_config('app.chess_join', 'on', true);
  perform set_config('app.chess_instance', current_instance_id, true);
  perform set_config('app.chess_username', current_username, true);

  update public.chess_games
  set player_ids = jsonb_set(
    game_row.player_ids,
    array[target_color],
    to_jsonb(current_username),
    true
  ),
  player_instances = jsonb_set(
    game_row.player_instances,
    array[target_color],
    to_jsonb(current_instance_id),
    true
  ),
  player_usernames = jsonb_set(
    game_row.player_usernames,
    array[target_color],
    to_jsonb(current_username),
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

grant execute on function public.join_chess_game(uuid, text, text, text) to authenticated;

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
using (true)
with check (true);

create policy "Allow owner delete chess games"
on public.chess_games
for delete
to authenticated
using (owner_id = auth.uid());

create table if not exists public.chess_player_status (
  username text primary key,
  status text not null default 'idle' check (status in ('idle', 'in_game')),
  session_mode text not null default 'local' check (session_mode in ('local', 'remote_create', 'remote_join')),
  current_game_id uuid null references public.chess_games(id) on delete set null,
  current_color text null check (current_color in ('white', 'red', 'black', 'blue')),
  is_owner boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.chess_player_status
  add column if not exists status text;

alter table public.chess_player_status
  alter column status set default 'idle';

update public.chess_player_status
set status = 'idle'
where status is null;

alter table public.chess_player_status
  alter column status set not null;

alter table public.chess_player_status
  drop constraint if exists chess_player_status_status_check;

alter table public.chess_player_status
  add constraint chess_player_status_status_check
  check (status in ('idle', 'in_game'));

alter table public.chess_player_status
  add column if not exists session_mode text;

alter table public.chess_player_status
  alter column session_mode set default 'local';

update public.chess_player_status
set session_mode = 'local'
where session_mode is null;

alter table public.chess_player_status
  alter column session_mode set not null;

alter table public.chess_player_status
  drop constraint if exists chess_player_status_session_mode_check;

alter table public.chess_player_status
  add constraint chess_player_status_session_mode_check
  check (session_mode in ('local', 'remote_create', 'remote_join'));

alter table public.chess_player_status
  add column if not exists current_game_id uuid;

alter table public.chess_player_status
  add column if not exists current_color text;

alter table public.chess_player_status
  drop constraint if exists chess_player_status_current_color_check;

alter table public.chess_player_status
  add constraint chess_player_status_current_color_check
  check (current_color in ('white', 'red', 'black', 'blue'));

alter table public.chess_player_status
  add column if not exists is_owner boolean;

alter table public.chess_player_status
  alter column is_owner set default false;

update public.chess_player_status
set is_owner = false
where is_owner is null;

alter table public.chess_player_status
  alter column is_owner set not null;

alter table public.chess_player_status
  add column if not exists updated_at timestamptz;

update public.chess_player_status
set updated_at = now()
where updated_at is null;

alter table public.chess_player_status
  alter column updated_at set default now();

alter table public.chess_player_status
  alter column updated_at set not null;

alter table public.chess_player_status
  add column if not exists username text;

update public.chess_player_status
set username = lower(regexp_replace(coalesce(username, ''), '[^a-zA-Z0-9_-]', '', 'g'))
where username is not null;

update public.chess_player_status
set username = 'player'
where username is null or length(trim(username)) = 0;

alter table public.chess_player_status
  alter column username set default 'player';

alter table public.chess_player_status
  alter column username set not null;

alter table public.chess_player_status
  drop constraint if exists chess_player_status_user_id_fkey;

alter table public.chess_player_status
  drop constraint if exists chess_player_status_current_game_id_fkey;

alter table public.chess_player_status
  add constraint chess_player_status_current_game_id_fkey
  foreign key (current_game_id)
  references public.chess_games(id)
  on delete set null;

create index if not exists chess_player_status_updated_at_idx
  on public.chess_player_status(updated_at desc);

drop index if exists chess_player_status_user_username_uq;

alter table public.chess_player_status
  drop constraint if exists chess_player_status_pkey;

alter table public.chess_player_status
  add constraint chess_player_status_pkey
  primary key (username);

alter table public.chess_player_status
  drop column if exists user_id;

alter table public.chess_player_status
  drop column if exists instance_id;

alter table public.chess_player_status enable row level security;
alter table public.chess_player_status force row level security;

revoke all on public.chess_player_status from anon;
revoke all on public.chess_player_status from authenticated;
grant select, insert, update, delete on public.chess_player_status to authenticated;

drop policy if exists "Allow own status read" on public.chess_player_status;
drop policy if exists "Allow own status insert" on public.chess_player_status;
drop policy if exists "Allow own status update" on public.chess_player_status;
drop policy if exists "Allow own status delete" on public.chess_player_status;

create policy "Allow own status read"
on public.chess_player_status
for select
to authenticated
using (true);

create policy "Allow own status insert"
on public.chess_player_status
for insert
to authenticated
with check (true);

create policy "Allow own status update"
on public.chess_player_status
for update
to authenticated
using (true)
with check (true);

create policy "Allow own status delete"
on public.chess_player_status
for delete
to authenticated
using (true);
