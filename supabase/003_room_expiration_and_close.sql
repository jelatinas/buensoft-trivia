-- ============================================================================
-- Buensoft Trivia (ver. 1.0.1)
--   * Presencia activa (last_seen_at) y expulsión automática al cerrar app/pestaña
--   * Salida limpia (trivia_mp_leave_room) y cierre automático si sale el anfitrión
--   * Expiración automática de salas inactivas (> 30 minutos)
-- Ejecutar una vez en el SQL Editor de Supabase (fminldhflehobacskjfp).
-- ============================================================================

begin;

-- 1. Columna de presencia en trivia_room_players
alter table public.trivia_room_players
  add column if not exists last_seen_at timestamptz not null default now();

-- 2. Función interna para limpiar jugadores desconectados (>25s sin pulso)
create or replace function public._trivia_mp_prune_room(p_room_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_room public.trivia_rooms%rowtype;
  v_host_alive boolean;
  v_remaining integer;
  v_answered integer;
begin
  select * into v_room from public.trivia_rooms where id = p_room_id;
  if v_room.id is null or v_room.status = 'finished' then
    return;
  end if;

  -- Expirar sala si lleva más de 30 minutos sin actividad
  if coalesce(v_room.question_started_at, v_room.created_at) < now() - interval '30 minutes' then
    update public.trivia_rooms
    set status = 'finished', finished_at = now()
    where id = p_room_id;
    return;
  end if;

  -- Eliminar jugadores cuya app/pestaña dejó de enviar pulso hace más de 25 segundos
  delete from public.trivia_room_players
  where room_id = p_room_id
    and last_seen_at < now() - interval '25 seconds';

  select exists(
    select 1 from public.trivia_room_players
    where room_id = p_room_id and student_id = v_room.host_student_id
  ) into v_host_alive;

  select count(*) into v_remaining
  from public.trivia_room_players
  where room_id = p_room_id;

  -- Si el anfitrión se desconectó o ya no queda nadie, cerrar la sala
  if not v_host_alive or v_remaining = 0 then
    update public.trivia_rooms
    set status = 'finished', finished_at = now()
    where id = p_room_id;
    return;
  end if;

  -- Si estamos en playing y todos los jugadores restantes ya contestaron, revelar
  if v_room.status = 'playing' and v_room.current_ordinal > 0 then
    select count(*) into v_answered
    from public.trivia_room_answers a
    join public.trivia_room_players p
      on p.room_id = a.room_id and p.student_id = a.student_id
    where a.room_id = p_room_id
      and a.ordinal = v_room.current_ordinal
      and a.answered_at is not null;

    if v_answered >= v_remaining then
      update public.trivia_rooms set status = 'reveal' where id = p_room_id;
    end if;
  end if;
end;
$$;

-- 3. Pulso de presencia (cada 8s desde el cliente)
create or replace function public.trivia_mp_heartbeat(
  p_room_id uuid,
  p_student_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  update public.trivia_room_players
  set last_seen_at = now()
  where room_id = p_room_id and student_id = p_student_id;

  perform public._trivia_mp_prune_room(p_room_id);
  return public.trivia_mp_get_state(p_room_id, p_student_id);
end;
$$;

-- 4. Salida inmediata (al pulsar Salir/Cerrar o al cerrar pestaña/app)
create or replace function public.trivia_mp_leave_room(
  p_room_id uuid,
  p_student_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_room public.trivia_rooms%rowtype;
  v_remaining integer;
  v_answered integer;
begin
  select * into v_room from public.trivia_rooms where id = p_room_id;
  if v_room.id is null then
    return jsonb_build_object('ok', true);
  end if;

  if v_room.host_student_id = p_student_id then
    if v_room.status <> 'finished' then
      update public.trivia_rooms
      set status = 'finished', finished_at = now()
      where id = p_room_id;
    end if;
  else
    delete from public.trivia_room_players
    where room_id = p_room_id and student_id = p_student_id;

    if v_room.status = 'playing' and v_room.current_ordinal > 0 then
      select count(*) into v_remaining from public.trivia_room_players where room_id = p_room_id;
      if v_remaining = 0 then
        update public.trivia_rooms set status = 'finished', finished_at = now() where id = p_room_id;
      else
        select count(*) into v_answered
        from public.trivia_room_answers a
        join public.trivia_room_players p
          on p.room_id = a.room_id and p.student_id = a.student_id
        where a.room_id = p_room_id
          and a.ordinal = v_room.current_ordinal
          and a.answered_at is not null;
        if v_answered >= v_remaining then
          update public.trivia_rooms set status = 'reveal' where id = p_room_id;
        end if;
      end if;
    end if;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- Alias compatible con trivia_mp_close_room
create or replace function public.trivia_mp_close_room(
  p_room_id uuid,
  p_student_id uuid
)
returns jsonb
language sql
volatile
security definer
set search_path = public
as $$
  select public.trivia_mp_leave_room(p_room_id, p_student_id);
$$;

-- 5. Actualizar trivia_mp_join_room: rechazar salas cerradas o expiradas y refrescar last_seen_at
create or replace function public.trivia_mp_join_room(
  p_code text,
  p_student_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_room public.trivia_rooms%rowtype;
  v_student_name text;
begin
  select name into v_student_name from public.students where id = p_student_id;
  if v_student_name is null then
    raise exception 'Jugador no encontrado.';
  end if;

  select * into v_room from public.trivia_rooms where code = upper(btrim(p_code));
  if v_room.id is null then
    raise exception 'No se encontró ninguna sala con ese código.';
  end if;

  perform public._trivia_mp_prune_room(v_room.id);
  select * into v_room from public.trivia_rooms where id = v_room.id;

  if v_room.status = 'finished' then
    raise exception 'Esta sala ya expiró o fue cerrada por el anfitrión.';
  end if;

  if v_room.status <> 'lobby' and not exists (
    select 1 from public.trivia_room_players where room_id = v_room.id and student_id = p_student_id
  ) then
    raise exception 'La partida ya comenzó.';
  end if;

  insert into public.trivia_room_players (room_id, student_id, student_name, is_host, is_ready, last_seen_at)
  values (v_room.id, p_student_id, v_student_name, false, false, now())
  on conflict (room_id, student_id) do update
    set last_seen_at = now();

  return public.trivia_mp_get_state(v_room.id, p_student_id);
end;
$$;

-- 6. Actualizar trivia_mp_start_room: limpiar ausentes antes de verificar si todos están listos
create or replace function public.trivia_mp_start_room(
  p_room_id uuid,
  p_student_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_room public.trivia_rooms%rowtype;
  v_unready integer;
begin
  update public.trivia_room_players
  set last_seen_at = now()
  where room_id = p_room_id and student_id = p_student_id;

  perform public._trivia_mp_prune_room(p_room_id);

  select * into v_room from public.trivia_rooms where id = p_room_id;
  if v_room.id is null or v_room.status = 'finished' then
    raise exception 'Esta sala ya expiró o fue cerrada.';
  end if;
  if v_room.host_student_id <> p_student_id then
    raise exception 'Solo el anfitrión puede iniciar la partida.';
  end if;
  if v_room.status <> 'lobby' then
    return public.trivia_mp_get_state(p_room_id, p_student_id);
  end if;

  select count(*) into v_unready
  from public.trivia_room_players
  where room_id = p_room_id and not is_ready;

  if v_unready > 0 then
    raise exception 'Espera a que todos los jugadores marquen Listo.';
  end if;

  update public.trivia_rooms
  set status = 'playing', current_ordinal = 1, question_started_at = now()
  where id = p_room_id;

  return public.trivia_mp_get_state(p_room_id, p_student_id);
end;
$$;

-- 7. Cerrar de inmediato cualquier sala vieja abierta hace más de 30 minutos
update public.trivia_rooms
set status = 'finished', finished_at = coalesce(finished_at, now())
where status <> 'finished'
  and coalesce(question_started_at, created_at) < now() - interval '30 minutes';

grant execute on function public.trivia_mp_heartbeat(uuid, uuid) to anon, authenticated;
grant execute on function public.trivia_mp_leave_room(uuid, uuid) to anon, authenticated;
grant execute on function public.trivia_mp_close_room(uuid, uuid) to anon, authenticated;

commit;
