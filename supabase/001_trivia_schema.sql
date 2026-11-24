-- ============================================================================
-- BUENSOFT TRIVIA — Esquema y Funciones RPC en Supabase
-- Comparte base de datos y banco de preguntas con Buensoft Evalua:
--   * Reutiliza public.students, public.subjects, public.questions
--   * Crea únicamente tablas nuevas con prefijo trivia_* (no altera Evalua)
--   * Valida respuestas, puntajes, comodines y logros 100% en el servidor
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Metadatos extendidos de preguntas (dificultad, etiquetas, extra_metadata)
-- ----------------------------------------------------------------------------
create table if not exists public.trivia_question_meta (
  question_id uuid primary key references public.questions (id) on delete cascade,
  difficulty text not null default 'media',
  tags text[] not null default '{}',
  extra_metadata jsonb not null default '{}'::jsonb,
  prompt_hash text not null default '',
  updated_at timestamptz not null default now(),
  constraint trivia_qmeta_difficulty check (difficulty in ('facil', 'media', 'dificil'))
);

create index if not exists trivia_qmeta_difficulty_idx
  on public.trivia_question_meta (difficulty);

create index if not exists trivia_qmeta_prompt_hash_idx
  on public.trivia_question_meta (prompt_hash);

-- ----------------------------------------------------------------------------
-- 2. MODO SOLO: partidas y preguntas instanciadas (sin Realtime)
-- ----------------------------------------------------------------------------
create table if not exists public.trivia_solo_games (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  mode text not null default 'competitivo',
  status text not null default 'active',
  config jsonb not null default '{}'::jsonb,
  total_rounds integer not null default 6,
  questions_per_round integer not null default 5,
  time_limit_sec integer not null default 15,
  lifelines_enabled boolean not null default true,
  lifelines_used jsonb not null default '{"fifty_fifty":false,"extra_time":false,"double_points":false,"skip":false}'::jsonb,
  score integer not null default 0,
  correct_count integer not null default 0,
  incorrect_count integer not null default 0,
  current_streak integer not null default 0,
  best_streak integer not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  constraint trivia_solo_mode_chk check (mode in ('competitivo', 'practica')),
  constraint trivia_solo_status_chk check (status in ('active', 'finished', 'abandoned'))
);

create index if not exists trivia_solo_games_student_idx
  on public.trivia_solo_games (student_id, started_at desc);

create table if not exists public.trivia_solo_questions (
  game_id uuid not null references public.trivia_solo_games (id) on delete cascade,
  ordinal integer not null,
  round_number integer not null,
  question_in_round integer not null,
  question_id uuid not null references public.questions (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  subject_name text not null,
  difficulty text not null default 'media',
  qtype text not null,
  prompt text not null,
  options_shuffled jsonb not null,
  correct_text text not null,
  explanation text not null default '',
  base_points integer not null default 100,
  multiplier numeric(4,2) not null default 1.00,
  eliminated_options jsonb not null default '[]'::jsonb,
  double_active boolean not null default false,
  extra_time_sec integer not null default 0,
  selected_text text,
  is_correct boolean,
  is_skipped boolean not null default false,
  points_earned integer not null default 0,
  time_ms integer,
  answered_at timestamptz,
  primary key (game_id, ordinal)
);

-- ----------------------------------------------------------------------------
-- 3. MODO MULTIJUGADOR: salas, jugadores, preguntas y respuestas
-- ----------------------------------------------------------------------------
create table if not exists public.trivia_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_student_id uuid not null references public.students (id) on delete cascade,
  status text not null default 'lobby',
  config jsonb not null default '{}'::jsonb,
  total_rounds integer not null default 6,
  questions_per_round integer not null default 5,
  time_limit_sec integer not null default 15,
  lifelines_enabled boolean not null default true,
  current_ordinal integer not null default 0,
  question_started_at timestamptz,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  constraint trivia_rooms_status_chk check (status in ('lobby', 'playing', 'reveal', 'finished'))
);

create index if not exists trivia_rooms_code_idx on public.trivia_rooms (code);

create table if not exists public.trivia_room_players (
  room_id uuid not null references public.trivia_rooms (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  student_name text not null,
  is_host boolean not null default false,
  is_ready boolean not null default false,
  score integer not null default 0,
  correct_count integer not null default 0,
  incorrect_count integer not null default 0,
  current_streak integer not null default 0,
  best_streak integer not null default 0,
  lifelines_used jsonb not null default '{"fifty_fifty":false,"extra_time":false,"double_points":false,"skip":false}'::jsonb,
  was_behind boolean not null default false,
  final_rank integer,
  joined_at timestamptz not null default now(),
  primary key (room_id, student_id)
);

create table if not exists public.trivia_room_questions (
  room_id uuid not null references public.trivia_rooms (id) on delete cascade,
  ordinal integer not null,
  round_number integer not null,
  question_in_round integer not null,
  question_id uuid not null references public.questions (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  subject_name text not null,
  difficulty text not null default 'media',
  qtype text not null,
  prompt text not null,
  options_shuffled jsonb not null,
  correct_text text not null,
  explanation text not null default '',
  base_points integer not null default 100,
  multiplier numeric(4,2) not null default 1.00,
  primary key (room_id, ordinal)
);

create table if not exists public.trivia_room_answers (
  room_id uuid not null references public.trivia_rooms (id) on delete cascade,
  ordinal integer not null,
  student_id uuid not null references public.students (id) on delete cascade,
  selected_text text,
  is_correct boolean not null default false,
  is_skipped boolean not null default false,
  double_active boolean not null default false,
  eliminated_options jsonb not null default '[]'::jsonb,
  extra_time_sec integer not null default 0,
  points_earned integer not null default 0,
  time_ms integer,
  answered_at timestamptz,
  primary key (room_id, ordinal, student_id)
);

-- ----------------------------------------------------------------------------
-- 4. Logros personales
-- ----------------------------------------------------------------------------
create table if not exists public.trivia_achievements (
  student_id uuid not null references public.students (id) on delete cascade,
  code text not null,
  title text not null,
  description text not null,
  unlocked_at timestamptz not null default now(),
  primary key (student_id, code)
);

-- ----------------------------------------------------------------------------
-- 5. Seguridad RLS (el navegador nunca lee respuestas correctas ni manipula puntajes)
-- ----------------------------------------------------------------------------
alter table public.trivia_question_meta enable row level security;
alter table public.trivia_solo_games enable row level security;
alter table public.trivia_solo_questions enable row level security;
alter table public.trivia_rooms enable row level security;
alter table public.trivia_room_players enable row level security;
alter table public.trivia_room_questions enable row level security;
alter table public.trivia_room_answers enable row level security;
alter table public.trivia_achievements enable row level security;

revoke all on public.trivia_question_meta from anon, authenticated;
revoke all on public.trivia_solo_games from anon, authenticated;
revoke all on public.trivia_solo_questions from anon, authenticated;
revoke all on public.trivia_rooms from anon, authenticated;
revoke all on public.trivia_room_players from anon, authenticated;
revoke all on public.trivia_room_questions from anon, authenticated;
revoke all on public.trivia_room_answers from anon, authenticated;
revoke all on public.trivia_achievements from anon, authenticated;

-- Solo lectura pública en trivia_rooms y trivia_room_players para Realtime en Multijugador
grant select on public.trivia_rooms to anon, authenticated;
grant select on public.trivia_room_players to anon, authenticated;

drop policy if exists trivia_rooms_select on public.trivia_rooms;
create policy trivia_rooms_select on public.trivia_rooms
  for select to anon, authenticated using (true);

drop policy if exists trivia_room_players_select on public.trivia_room_players;
create policy trivia_room_players_select on public.trivia_room_players
  for select to anon, authenticated using (true);

-- Habilitar Supabase Realtime solo para salas y jugadores multijugador
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'trivia_rooms'
  ) then
    alter publication supabase_realtime add table public.trivia_rooms;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'trivia_room_players'
  ) then
    alter publication supabase_realtime add table public.trivia_room_players;
  end if;
exception when others then
  null;
end $$;

-- ----------------------------------------------------------------------------
-- 6. Funciones auxiliares internas
-- ----------------------------------------------------------------------------
create or replace function public._trivia_round_points(p_round integer)
returns integer
language sql
immutable
as $$
  select case p_round
    when 1 then 100
    when 2 then 200
    when 3 then 300
    when 4 then 400
    when 5 then 500
    when 6 then 1000
    when 7 then 1200
    when 8 then 1500
    when 9 then 2000
    else 2500
  end;
$$;

create or replace function public._trivia_round_multiplier(p_round integer)
returns numeric
language sql
immutable
as $$
  select case
    when p_round <= 1 then 1.00
    when p_round = 2 then 1.25
    when p_round = 3 then 1.50
    when p_round = 4 then 1.75
    when p_round = 5 then 2.00
    when p_round = 6 then 2.50
    else 3.00
  end;
$$;

create or replace function public._trivia_shuffle(p_options jsonb)
returns jsonb
language sql
volatile
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(val order by random()), '[]'::jsonb)
  from jsonb_array_elements(p_options) as val;
$$;

create or replace function public._trivia_norm_prompt(p_text text)
returns text
language sql
immutable
as $$
  select lower(regexp_replace(btrim(coalesce(p_text, '')), '\s+', ' ', 'g'));
$$;

create or replace function public._trivia_unlock_achievement(
  p_student_id uuid,
  p_code text,
  p_title text,
  p_description text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  inserted_count integer;
begin
  insert into public.trivia_achievements (student_id, code, title, description)
  values (p_student_id, p_code, p_title, p_description)
  on conflict (student_id, code) do nothing;
  get diagnostics inserted_count = row_count;
  return inserted_count > 0;
end;
$$;

-- ----------------------------------------------------------------------------
-- 7. Catálogo de categorías (reutiliza public.subjects + public.questions)
-- ----------------------------------------------------------------------------
create or replace function public.trivia_list_categories()
returns table (
  id uuid,
  slug text,
  name text,
  description text,
  question_count integer,
  facil_count integer,
  media_count integer,
  dificil_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id,
    s.slug,
    s.name,
    s.description,
    count(q.id) filter (where q.active)::integer as question_count,
    count(q.id) filter (where q.active and coalesce(m.difficulty, 'media') = 'facil')::integer as facil_count,
    count(q.id) filter (where q.active and coalesce(m.difficulty, 'media') = 'media')::integer as media_count,
    count(q.id) filter (where q.active and coalesce(m.difficulty, 'media') = 'dificil')::integer as dificil_count
  from public.subjects s
  left join public.questions q on q.subject_id = s.id
  left join public.trivia_question_meta m on m.question_id = q.id
  group by s.id
  order by s.name;
$$;

-- ----------------------------------------------------------------------------
-- 8. MODO SOLO — RPCs
-- ----------------------------------------------------------------------------
create or replace function public.trivia_solo_start(
  p_student_id uuid,
  p_mode text default 'competitivo',
  p_total_rounds integer default 6,
  p_questions_per_round integer default 5,
  p_time_limit_sec integer default 15,
  p_subject_ids uuid[] default null,
  p_difficulty text default 'mixta',
  p_lifelines_enabled boolean default true,
  p_question_ids uuid[] default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_mode text := case when p_mode = 'practica' then 'practica' else 'competitivo' end;
  v_rounds integer := greatest(1, least(coalesce(p_total_rounds, 6), 10));
  v_qpr integer := greatest(1, least(coalesce(p_questions_per_round, 5), 15));
  v_time integer := case when v_mode = 'practica' then 0 else greatest(5, least(coalesce(p_time_limit_sec, 15), 60)) end;
  v_total_needed integer := v_rounds * v_qpr;
  v_game_id uuid;
  v_inserted integer;
  v_actual_rounds integer;
  v_personal_best integer;
begin
  if not exists (select 1 from public.students where id = p_student_id) then
    raise exception 'Jugador no encontrado.';
  end if;

  insert into public.trivia_solo_games (
    student_id, mode, status, config, total_rounds, questions_per_round,
    time_limit_sec, lifelines_enabled
  )
  values (
    p_student_id,
    v_mode,
    'active',
    jsonb_build_object(
      'subject_ids', coalesce(to_jsonb(p_subject_ids), '[]'::jsonb),
      'difficulty', coalesce(p_difficulty, 'mixta'),
      'practice_custom', p_question_ids is not null
    ),
    v_rounds,
    v_qpr,
    v_time,
    coalesce(p_lifelines_enabled, true)
  )
  returning id into v_game_id;

  with pool as (
    select
      q.id as question_id,
      q.subject_id,
      s.name as subject_name,
      coalesce(m.difficulty, 'media') as difficulty,
      q.qtype,
      q.prompt,
      q.options,
      q.explanation,
      row_number() over (order by random()) as rn
    from public.questions q
    join public.subjects s on s.id = q.subject_id
    left join public.trivia_question_meta m on m.question_id = q.id
    where q.active
      and jsonb_array_length(q.options) >= 2
      and (
        p_question_ids is not null
        and q.id = any(p_question_ids)
        or (
          p_question_ids is null
          and (p_subject_ids is null or cardinality(p_subject_ids) = 0 or q.subject_id = any(p_subject_ids))
          and (p_difficulty is null or p_difficulty = 'mixta' or coalesce(m.difficulty, 'media') = p_difficulty)
        )
      )
  ),
  picked as (
    select * from pool where rn <= v_total_needed order by rn
  )
  insert into public.trivia_solo_questions (
    game_id, ordinal, round_number, question_in_round,
    question_id, subject_id, subject_name, difficulty,
    qtype, prompt, options_shuffled, correct_text, explanation,
    base_points, multiplier
  )
  select
    v_game_id,
    p.rn::integer as ordinal,
    (((p.rn - 1) / v_qpr) + 1)::integer as round_number,
    (((p.rn - 1) % v_qpr) + 1)::integer as question_in_round,
    p.question_id,
    p.subject_id,
    p.subject_name,
    p.difficulty,
    p.qtype,
    p.prompt,
    public._trivia_shuffle(p.options),
    p.options ->> 0,
    coalesce(p.explanation, ''),
    public._trivia_round_points((((p.rn - 1) / v_qpr) + 1)::integer),
    public._trivia_round_multiplier((((p.rn - 1) / v_qpr) + 1)::integer)
  from picked p;

  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    delete from public.trivia_solo_games where id = v_game_id;
    raise exception 'No hay preguntas disponibles con los filtros seleccionados.';
  end if;

  v_actual_rounds := ceil(v_inserted::numeric / v_qpr)::integer;
  update public.trivia_solo_games
  set total_rounds = v_actual_rounds
  where id = v_game_id;

  select coalesce(max(score), 0) into v_personal_best
  from public.trivia_solo_games
  where student_id = p_student_id and status = 'finished' and mode = 'competitivo';

  return public.trivia_solo_get_state(v_game_id, p_student_id);
end;
$$;

create or replace function public.trivia_solo_get_state(
  p_game_id uuid,
  p_student_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_game public.trivia_solo_games%rowtype;
  v_personal_best integer;
  v_total_questions integer;
  v_answered_count integer;
  v_next_q public.trivia_solo_questions%rowtype;
  v_questions_summary jsonb;
begin
  select * into v_game
  from public.trivia_solo_games
  where id = p_game_id and student_id = p_student_id;

  if v_game.id is null then
    raise exception 'Partida SOLO no encontrada.';
  end if;

  select coalesce(max(score), 0) into v_personal_best
  from public.trivia_solo_games
  where student_id = p_student_id and status = 'finished' and mode = 'competitivo' and id <> p_game_id;

  select count(*), count(*) filter (where answered_at is not null)
    into v_total_questions, v_answered_count
  from public.trivia_solo_questions
  where game_id = p_game_id;

  select * into v_next_q
  from public.trivia_solo_questions
  where game_id = p_game_id and answered_at is null
  order by ordinal asc
  limit 1;

  if v_game.status = 'finished' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'ordinal', q.ordinal,
      'round_number', q.round_number,
      'question_id', q.question_id,
      'subject_id', q.subject_id,
      'subject_name', q.subject_name,
      'difficulty', q.difficulty,
      'qtype', q.qtype,
      'prompt', q.prompt,
      'options', q.options_shuffled,
      'selected_text', q.selected_text,
      'correct_text', q.correct_text,
      'explanation', q.explanation,
      'is_correct', q.is_correct,
      'is_skipped', q.is_skipped,
      'points_earned', q.points_earned
    ) order by q.ordinal), '[]'::jsonb)
    into v_questions_summary
    from public.trivia_solo_questions q
    where q.game_id = p_game_id;
  else
    v_questions_summary := '[]'::jsonb;
  end if;

  return jsonb_build_object(
    'game_id', v_game.id,
    'mode', v_game.mode,
    'status', v_game.status,
    'total_rounds', v_game.total_rounds,
    'questions_per_round', v_game.questions_per_round,
    'time_limit_sec', v_game.time_limit_sec,
    'lifelines_enabled', v_game.lifelines_enabled,
    'lifelines_used', v_game.lifelines_used,
    'score', v_game.score,
    'correct_count', v_game.correct_count,
    'incorrect_count', v_game.incorrect_count,
    'current_streak', v_game.current_streak,
    'best_streak', v_game.best_streak,
    'personal_best', v_personal_best,
    'total_questions', v_total_questions,
    'answered_count', v_answered_count,
    'current_question', case
      when v_next_q.game_id is null then null
      else jsonb_build_object(
        'ordinal', v_next_q.ordinal,
        'round_number', v_next_q.round_number,
        'question_in_round', v_next_q.question_in_round,
        'subject_name', v_next_q.subject_name,
        'difficulty', v_next_q.difficulty,
        'qtype', v_next_q.qtype,
        'prompt', v_next_q.prompt,
        'options', v_next_q.options_shuffled,
        'base_points', v_next_q.base_points,
        'multiplier', v_next_q.multiplier,
        'eliminated_options', v_next_q.eliminated_options,
        'double_active', v_next_q.double_active,
        'extra_time_sec', v_next_q.extra_time_sec
      )
    end,
    'review_questions', v_questions_summary
  );
end;
$$;

create or replace function public.trivia_solo_use_lifeline(
  p_game_id uuid,
  p_student_id uuid,
  p_ordinal integer,
  p_lifeline text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_game public.trivia_solo_games%rowtype;
  v_q public.trivia_solo_questions%rowtype;
  v_eliminated jsonb := '[]'::jsonb;
begin
  select * into v_game from public.trivia_solo_games
  where id = p_game_id and student_id = p_student_id and status = 'active';
  if v_game.id is null then
    raise exception 'Partida no activa.';
  end if;
  if not v_game.lifelines_enabled then
    raise exception 'Los comodines están desactivados en esta partida.';
  end if;
  if p_lifeline not in ('fifty_fifty', 'extra_time', 'double_points', 'skip') then
    raise exception 'Comodín no válido.';
  end if;
  if coalesce((v_game.lifelines_used ->> p_lifeline)::boolean, false) then
    raise exception 'Este comodín ya fue utilizado en la partida.';
  end if;

  select * into v_q from public.trivia_solo_questions
  where game_id = p_game_id and ordinal = p_ordinal and answered_at is null;
  if v_q.game_id is null then
    raise exception 'Pregunta no disponible.';
  end if;

  if p_lifeline = 'fifty_fifty' then
    if v_q.qtype <> 'opcion_multiple' or jsonb_array_length(v_q.options_shuffled) < 4 then
      raise exception 'El comodín 50/50 solo aplica a preguntas de 4 opciones.';
    end if;
    select coalesce(jsonb_agg(opt), '[]'::jsonb) into v_eliminated
    from (
      select val as opt
      from jsonb_array_elements_text(v_q.options_shuffled) as val
      where val <> v_q.correct_text
      order by random()
      limit 2
    ) sub;
    update public.trivia_solo_questions
    set eliminated_options = v_eliminated
    where game_id = p_game_id and ordinal = p_ordinal;
  elsif p_lifeline = 'extra_time' then
    update public.trivia_solo_questions
    set extra_time_sec = extra_time_sec + 10
    where game_id = p_game_id and ordinal = p_ordinal;
  elsif p_lifeline = 'double_points' then
    update public.trivia_solo_questions
    set double_active = true
    where game_id = p_game_id and ordinal = p_ordinal;
  elsif p_lifeline = 'skip' then
    update public.trivia_solo_questions
    set is_skipped = true, is_correct = false, points_earned = 0, answered_at = now()
    where game_id = p_game_id and ordinal = p_ordinal;
  end if;

  update public.trivia_solo_games
  set lifelines_used = jsonb_set(lifelines_used, array[p_lifeline], 'true'::jsonb, true)
  where id = p_game_id;

  return jsonb_build_object(
    'lifeline', p_lifeline,
    'eliminated_options', v_eliminated,
    'extra_time_sec', case when p_lifeline = 'extra_time' then v_q.extra_time_sec + 10 else v_q.extra_time_sec end,
    'double_active', case when p_lifeline = 'double_points' then true else v_q.double_active end,
    'skipped', p_lifeline = 'skip',
    'correct_text', case when p_lifeline = 'skip' then v_q.correct_text else null end,
    'explanation', case when p_lifeline = 'skip' then v_q.explanation else null end
  );
end;
$$;

create or replace function public.trivia_solo_answer(
  p_game_id uuid,
  p_student_id uuid,
  p_ordinal integer,
  p_selected_text text,
  p_time_ms integer default 0
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_game public.trivia_solo_games%rowtype;
  v_q public.trivia_solo_questions%rowtype;
  v_correct boolean;
  v_points integer := 0;
  v_new_streak integer;
  v_best_streak integer;
  v_remaining integer;
  v_unlocked jsonb := '[]'::jsonb;
  v_total_q integer;
begin
  select * into v_game from public.trivia_solo_games
  where id = p_game_id and student_id = p_student_id and status = 'active';
  if v_game.id is null then
    raise exception 'Partida no activa.';
  end if;

  select * into v_q from public.trivia_solo_questions
  where game_id = p_game_id and ordinal = p_ordinal and answered_at is null;
  if v_q.game_id is null then
    raise exception 'Pregunta ya respondida o inexistente.';
  end if;

  v_correct := (p_selected_text is not null and p_selected_text = v_q.correct_text);

  if v_correct then
    v_new_streak := v_game.current_streak + 1;
    v_best_streak := greatest(v_game.best_streak, v_new_streak);
    if v_game.mode = 'competitivo' then
      v_points := round(v_q.base_points * v_q.multiplier)::integer;
      if v_new_streak >= 3 then
        v_points := v_points + least(v_new_streak * 25, 250);
      end if;
      if v_q.double_active then
        v_points := v_points * 2;
      end if;
    end if;
  else
    v_new_streak := 0;
    v_best_streak := v_game.best_streak;
    v_points := 0;
  end if;

  update public.trivia_solo_questions
  set selected_text = p_selected_text,
      is_correct = v_correct,
      points_earned = v_points,
      time_ms = greatest(0, coalesce(p_time_ms, 0)),
      answered_at = now()
  where game_id = p_game_id and ordinal = p_ordinal;

  update public.trivia_solo_games
  set score = score + v_points,
      correct_count = correct_count + case when v_correct then 1 else 0 end,
      incorrect_count = incorrect_count + case when v_correct then 0 else 1 end,
      current_streak = v_new_streak,
      best_streak = v_best_streak
  where id = p_game_id
  returning * into v_game;

  select count(*) into v_remaining
  from public.trivia_solo_questions
  where game_id = p_game_id and answered_at is null;

  if v_remaining = 0 then
    update public.trivia_solo_games
    set status = 'finished', finished_at = now()
    where id = p_game_id
    returning * into v_game;

    select count(*) into v_total_q from public.trivia_solo_questions where game_id = p_game_id;

    if public._trivia_unlock_achievement(p_student_id, 'first_solo', 'Primer Desafío SOLO', 'Completaste tu primera partida en Modo SOLO.') then
      v_unlocked := v_unlocked || jsonb_build_object('code', 'first_solo', 'title', 'Primer Desafío SOLO');
    end if;
    if v_game.best_streak >= 5 and public._trivia_unlock_achievement(p_student_id, 'streak_5', 'En Llamas (x5)', 'Lograste una racha de 5 aciertos consecutivos.') then
      v_unlocked := v_unlocked || jsonb_build_object('code', 'streak_5', 'title', 'En Llamas (x5)');
    end if;
    if v_game.best_streak >= 10 and public._trivia_unlock_achievement(p_student_id, 'streak_10', 'Imparable (x10)', 'Lograste una racha de 10 aciertos consecutivos.') then
      v_unlocked := v_unlocked || jsonb_build_object('code', 'streak_10', 'title', 'Imparable (x10)');
    end if;
    if v_total_q >= 5 and v_game.incorrect_count = 0 and public._trivia_unlock_achievement(p_student_id, 'perfect_solo', 'Mente Perfecta', 'Completaste una partida SOLO con 100% de aciertos.') then
      v_unlocked := v_unlocked || jsonb_build_object('code', 'perfect_solo', 'title', 'Mente Perfecta');
    end if;
    if v_game.mode = 'competitivo' and v_game.score >= 5000 and public._trivia_unlock_achievement(p_student_id, 'high_scorer', 'Maestro del Puntaje', 'Superaste los 5,000 puntos en una partida SOLO.') then
      v_unlocked := v_unlocked || jsonb_build_object('code', 'high_scorer', 'title', 'Maestro del Puntaje');
    end if;
  end if;

  return jsonb_build_object(
    'ordinal', p_ordinal,
    'is_correct', v_correct,
    'correct_text', v_q.correct_text,
    'explanation', v_q.explanation,
    'points_earned', v_points,
    'total_score', v_game.score,
    'current_streak', v_game.current_streak,
    'best_streak', v_game.best_streak,
    'finished', v_remaining = 0,
    'newly_unlocked', v_unlocked
  );
end;
$$;

create or replace function public.trivia_solo_finish(
  p_game_id uuid,
  p_student_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  update public.trivia_solo_games
  set status = 'finished', finished_at = coalesce(finished_at, now())
  where id = p_game_id and student_id = p_student_id;
  return public.trivia_solo_get_state(p_game_id, p_student_id);
end;
$$;

-- ----------------------------------------------------------------------------
-- 9. MODO MULTIJUGADOR — RPCs
-- ----------------------------------------------------------------------------
create or replace function public._trivia_random_code()
returns text
language plpgsql
volatile
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i integer;
begin
  for i in 1..6 loop
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  end loop;
  return result;
end;
$$;

create or replace function public.trivia_mp_create_room(
  p_student_id uuid,
  p_total_rounds integer default 6,
  p_questions_per_round integer default 5,
  p_time_limit_sec integer default 15,
  p_subject_ids uuid[] default null,
  p_difficulty text default 'mixta',
  p_lifelines_enabled boolean default true
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_student_name text;
  v_code text;
  v_room_id uuid;
  v_rounds integer := greatest(1, least(coalesce(p_total_rounds, 6), 10));
  v_qpr integer := greatest(1, least(coalesce(p_questions_per_round, 5), 15));
  v_time integer := greatest(5, least(coalesce(p_time_limit_sec, 15), 30));
  v_total_needed integer := v_rounds * v_qpr;
  v_inserted integer;
begin
  select name into v_student_name from public.students where id = p_student_id;
  if v_student_name is null then
    raise exception 'Jugador no encontrado.';
  end if;

  loop
    v_code := public._trivia_random_code();
    exit when not exists (select 1 from public.trivia_rooms where code = v_code);
  end loop;

  insert into public.trivia_rooms (
    code, host_student_id, status, config, total_rounds,
    questions_per_round, time_limit_sec, lifelines_enabled
  )
  values (
    v_code,
    p_student_id,
    'lobby',
    jsonb_build_object(
      'subject_ids', coalesce(to_jsonb(p_subject_ids), '[]'::jsonb),
      'difficulty', coalesce(p_difficulty, 'mixta')
    ),
    v_rounds,
    v_qpr,
    v_time,
    coalesce(p_lifelines_enabled, true)
  )
  returning id into v_room_id;

  with pool as (
    select
      q.id as question_id,
      q.subject_id,
      s.name as subject_name,
      coalesce(m.difficulty, 'media') as difficulty,
      q.qtype,
      q.prompt,
      q.options,
      q.explanation,
      row_number() over (order by random()) as rn
    from public.questions q
    join public.subjects s on s.id = q.subject_id
    left join public.trivia_question_meta m on m.question_id = q.id
    where q.active
      and jsonb_array_length(q.options) >= 2
      and (p_subject_ids is null or cardinality(p_subject_ids) = 0 or q.subject_id = any(p_subject_ids))
      and (p_difficulty is null or p_difficulty = 'mixta' or coalesce(m.difficulty, 'media') = p_difficulty)
  ),
  picked as (
    select * from pool where rn <= v_total_needed order by rn
  )
  insert into public.trivia_room_questions (
    room_id, ordinal, round_number, question_in_round,
    question_id, subject_id, subject_name, difficulty,
    qtype, prompt, options_shuffled, correct_text, explanation,
    base_points, multiplier
  )
  select
    v_room_id,
    p.rn::integer,
    (((p.rn - 1) / v_qpr) + 1)::integer,
    (((p.rn - 1) % v_qpr) + 1)::integer,
    p.question_id,
    p.subject_id,
    p.subject_name,
    p.difficulty,
    p.qtype,
    p.prompt,
    public._trivia_shuffle(p.options),
    p.options ->> 0,
    coalesce(p.explanation, ''),
    public._trivia_round_points((((p.rn - 1) / v_qpr) + 1)::integer),
    public._trivia_round_multiplier((((p.rn - 1) / v_qpr) + 1)::integer)
  from picked p;

  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    delete from public.trivia_rooms where id = v_room_id;
    raise exception 'No hay preguntas disponibles para crear la sala.';
  end if;

  update public.trivia_rooms
  set total_rounds = ceil(v_inserted::numeric / v_qpr)::integer
  where id = v_room_id;

  insert into public.trivia_room_players (room_id, student_id, student_name, is_host, is_ready)
  values (v_room_id, p_student_id, v_student_name, true, true);

  return public.trivia_mp_get_state(v_room_id, p_student_id);
end;
$$;

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
  if v_room.status <> 'lobby' and not exists (
    select 1 from public.trivia_room_players where room_id = v_room.id and student_id = p_student_id
  ) then
    raise exception 'La partida ya comenzó.';
  end if;

  insert into public.trivia_room_players (room_id, student_id, student_name, is_host, is_ready)
  values (v_room.id, p_student_id, v_student_name, false, false)
  on conflict (room_id, student_id) do nothing;

  return public.trivia_mp_get_state(v_room.id, p_student_id);
end;
$$;

create or replace function public.trivia_mp_set_ready(
  p_room_id uuid,
  p_student_id uuid,
  p_ready boolean
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  update public.trivia_room_players
  set is_ready = coalesce(p_ready, false)
  where room_id = p_room_id and student_id = p_student_id;
  return public.trivia_mp_get_state(p_room_id, p_student_id);
end;
$$;

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
  select * into v_room from public.trivia_rooms where id = p_room_id;
  if v_room.id is null then
    raise exception 'Sala no encontrada.';
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

create or replace function public.trivia_mp_use_lifeline(
  p_room_id uuid,
  p_student_id uuid,
  p_lifeline text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_room public.trivia_rooms%rowtype;
  v_player public.trivia_room_players%rowtype;
  v_q public.trivia_room_questions%rowtype;
  v_eliminated jsonb := '[]'::jsonb;
begin
  select * into v_room from public.trivia_rooms where id = p_room_id and status = 'playing';
  if v_room.id is null then
    raise exception 'La sala no está en juego.';
  end if;
  if not v_room.lifelines_enabled then
    raise exception 'Los comodines están desactivados en esta sala.';
  end if;
  select * into v_player from public.trivia_room_players where room_id = p_room_id and student_id = p_student_id;
  if v_player.student_id is null then
    raise exception 'No perteneces a esta sala.';
  end if;
  if p_lifeline not in ('fifty_fifty', 'extra_time', 'double_points', 'skip') then
    raise exception 'Comodín inválido.';
  end if;
  if coalesce((v_player.lifelines_used ->> p_lifeline)::boolean, false) then
    raise exception 'Ya usaste este comodín.';
  end if;

  select * into v_q from public.trivia_room_questions
  where room_id = p_room_id and ordinal = v_room.current_ordinal;

  insert into public.trivia_room_answers (room_id, ordinal, student_id)
  values (p_room_id, v_room.current_ordinal, p_student_id)
  on conflict (room_id, ordinal, student_id) do nothing;

  if p_lifeline = 'fifty_fifty' then
    if v_q.qtype <> 'opcion_multiple' then
      raise exception '50/50 solo aplica a opción múltiple.';
    end if;
    select coalesce(jsonb_agg(opt), '[]'::jsonb) into v_eliminated
    from (
      select val as opt
      from jsonb_array_elements_text(v_q.options_shuffled) as val
      where val <> v_q.correct_text
      order by random()
      limit 2
    ) sub;
    update public.trivia_room_answers
    set eliminated_options = v_eliminated
    where room_id = p_room_id and ordinal = v_room.current_ordinal and student_id = p_student_id;
  elsif p_lifeline = 'double_points' then
    update public.trivia_room_answers
    set double_active = true
    where room_id = p_room_id and ordinal = v_room.current_ordinal and student_id = p_student_id;
  elsif p_lifeline = 'extra_time' then
    update public.trivia_room_answers
    set extra_time_sec = extra_time_sec + 10
    where room_id = p_room_id and ordinal = v_room.current_ordinal and student_id = p_student_id;
  elsif p_lifeline = 'skip' then
    update public.trivia_room_answers
    set is_skipped = true, is_correct = false, points_earned = 0, answered_at = now()
    where room_id = p_room_id and ordinal = v_room.current_ordinal and student_id = p_student_id;
  end if;

  update public.trivia_room_players
  set lifelines_used = jsonb_set(lifelines_used, array[p_lifeline], 'true'::jsonb, true)
  where room_id = p_room_id and student_id = p_student_id;

  return public.trivia_mp_get_state(p_room_id, p_student_id);
end;
$$;

create or replace function public.trivia_mp_answer(
  p_room_id uuid,
  p_student_id uuid,
  p_selected_text text,
  p_time_ms integer default 0
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_room public.trivia_rooms%rowtype;
  v_player public.trivia_room_players%rowtype;
  v_q public.trivia_room_questions%rowtype;
  v_ans public.trivia_room_answers%rowtype;
  v_correct boolean;
  v_points integer := 0;
  v_new_streak integer;
  v_max_score integer;
  v_total_players integer;
  v_answered_players integer;
begin
  select * into v_room from public.trivia_rooms where id = p_room_id and status = 'playing';
  if v_room.id is null then
    raise exception 'La sala no está aceptando respuestas.';
  end if;

  select * into v_player from public.trivia_room_players where room_id = p_room_id and student_id = p_student_id;
  if v_player.student_id is null then
    raise exception 'Jugador no pertenece a la sala.';
  end if;

  select * into v_q from public.trivia_room_questions
  where room_id = p_room_id and ordinal = v_room.current_ordinal;

  insert into public.trivia_room_answers (room_id, ordinal, student_id)
  values (p_room_id, v_room.current_ordinal, p_student_id)
  on conflict (room_id, ordinal, student_id) do nothing;

  select * into v_ans from public.trivia_room_answers
  where room_id = p_room_id and ordinal = v_room.current_ordinal and student_id = p_student_id;

  if v_ans.answered_at is not null then
    return public.trivia_mp_get_state(p_room_id, p_student_id);
  end if;

  v_correct := (p_selected_text is not null and p_selected_text = v_q.correct_text);

  if v_correct then
    v_new_streak := v_player.current_streak + 1;
    v_points := round(v_q.base_points * v_q.multiplier)::integer;
    if v_new_streak >= 3 then
      v_points := v_points + least(v_new_streak * 25, 250);
    end if;
    if v_ans.double_active then
      v_points := v_points * 2;
    end if;
  else
    v_new_streak := 0;
    v_points := 0;
  end if;

  update public.trivia_room_answers
  set selected_text = p_selected_text,
      is_correct = v_correct,
      points_earned = v_points,
      time_ms = greatest(0, coalesce(p_time_ms, 0)),
      answered_at = now()
  where room_id = p_room_id and ordinal = v_room.current_ordinal and student_id = p_student_id;

  update public.trivia_room_players
  set score = score + v_points,
      correct_count = correct_count + case when v_correct then 1 else 0 end,
      incorrect_count = incorrect_count + case when v_correct then 0 else 1 end,
      current_streak = v_new_streak,
      best_streak = greatest(best_streak, v_new_streak)
  where room_id = p_room_id and student_id = p_student_id;

  select max(score) into v_max_score from public.trivia_room_players where room_id = p_room_id;
  update public.trivia_room_players
  set was_behind = true
  where room_id = p_room_id and score < v_max_score;

  select count(*) into v_total_players from public.trivia_room_players where room_id = p_room_id;
  select count(*) into v_answered_players
  from public.trivia_room_answers
  where room_id = p_room_id and ordinal = v_room.current_ordinal and answered_at is not null;

  if v_answered_players >= v_total_players then
    update public.trivia_rooms set status = 'reveal' where id = p_room_id;
  end if;

  return public.trivia_mp_get_state(p_room_id, p_student_id);
end;
$$;

create or replace function public.trivia_mp_advance(
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
  v_total_q integer;
  v_winner record;
begin
  select * into v_room from public.trivia_rooms where id = p_room_id;
  if v_room.id is null then
    raise exception 'Sala no encontrada.';
  end if;
  if v_room.host_student_id <> p_student_id then
    raise exception 'Solo el anfitrión puede avanzar.';
  end if;

  select count(*) into v_total_q from public.trivia_room_questions where room_id = p_room_id;

  if v_room.status = 'playing' then
    update public.trivia_rooms set status = 'reveal' where id = p_room_id;
  elsif v_room.status = 'reveal' then
    if v_room.current_ordinal >= v_total_q then
      with ranked as (
        select
          student_id,
          dense_rank() over (order by score desc, correct_count desc, best_streak desc) as rnk
        from public.trivia_room_players
        where room_id = p_room_id
      )
      update public.trivia_room_players p
      set final_rank = r.rnk
      from ranked r
      where p.room_id = p_room_id and p.student_id = r.student_id;

      update public.trivia_rooms
      set status = 'finished', finished_at = now()
      where id = p_room_id;

      for v_winner in
        select student_id, was_behind
        from public.trivia_room_players
        where room_id = p_room_id and final_rank = 1
      loop
        perform public._trivia_unlock_achievement(
          v_winner.student_id, 'first_mp_win', 'Campeón Multijugador', 'Ganaste una partida en Modo Multijugador.'
        );
        if v_winner.was_behind then
          perform public._trivia_unlock_achievement(
            v_winner.student_id, 'comeback_king', 'Remontada Épica', 'Ganaste una partida multijugador tras estar por debajo en el marcador.'
          );
        end if;
      end loop;
    else
      update public.trivia_rooms
      set status = 'playing',
          current_ordinal = current_ordinal + 1,
          question_started_at = now()
      where id = p_room_id;
    end if;
  end if;

  return public.trivia_mp_get_state(p_room_id, p_student_id);
end;
$$;

create or replace function public.trivia_mp_get_state(
  p_room_id uuid,
  p_student_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_room public.trivia_rooms%rowtype;
  v_total_q integer;
  v_q public.trivia_room_questions%rowtype;
  v_my_ans public.trivia_room_answers%rowtype;
  v_players jsonb;
  v_answered_count integer := 0;
  v_reveal boolean;
begin
  select * into v_room from public.trivia_rooms where id = p_room_id;
  if v_room.id is null then
    raise exception 'Sala no encontrada.';
  end if;

  select count(*) into v_total_q from public.trivia_room_questions where room_id = p_room_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'student_id', p.student_id,
    'student_name', p.student_name,
    'is_host', p.is_host,
    'is_ready', p.is_ready,
    'score', p.score,
    'correct_count', p.correct_count,
    'incorrect_count', p.incorrect_count,
    'current_streak', p.current_streak,
    'best_streak', p.best_streak,
    'lifelines_used', p.lifelines_used,
    'was_behind', p.was_behind,
    'final_rank', p.final_rank
  ) order by p.score desc, p.joined_at asc), '[]'::jsonb)
  into v_players
  from public.trivia_room_players p
  where p.room_id = p_room_id;

  if v_room.current_ordinal > 0 then
    select * into v_q
    from public.trivia_room_questions
    where room_id = p_room_id and ordinal = v_room.current_ordinal;

    select * into v_my_ans
    from public.trivia_room_answers
    where room_id = p_room_id and ordinal = v_room.current_ordinal and student_id = p_student_id;

    select count(*) into v_answered_count
    from public.trivia_room_answers
    where room_id = p_room_id and ordinal = v_room.current_ordinal and answered_at is not null;
  end if;

  v_reveal := (v_room.status in ('reveal', 'finished') or v_my_ans.answered_at is not null);

  return jsonb_build_object(
    'room_id', v_room.id,
    'code', v_room.code,
    'host_student_id', v_room.host_student_id,
    'status', v_room.status,
    'total_rounds', v_room.total_rounds,
    'questions_per_round', v_room.questions_per_round,
    'total_questions', v_total_q,
    'time_limit_sec', v_room.time_limit_sec,
    'lifelines_enabled', v_room.lifelines_enabled,
    'current_ordinal', v_room.current_ordinal,
    'question_started_at', v_room.question_started_at,
    'answered_players_count', v_answered_count,
    'players', v_players,
    'current_question', case
      when v_q.room_id is null then null
      else jsonb_build_object(
        'ordinal', v_q.ordinal,
        'round_number', v_q.round_number,
        'question_in_round', v_q.question_in_round,
        'subject_name', v_q.subject_name,
        'difficulty', v_q.difficulty,
        'qtype', v_q.qtype,
        'prompt', v_q.prompt,
        'options', v_q.options_shuffled,
        'base_points', v_q.base_points,
        'multiplier', v_q.multiplier,
        'correct_text', case when v_reveal then v_q.correct_text else null end,
        'explanation', case when v_reveal then v_q.explanation else null end
      )
    end,
    'my_answer', case
      when v_my_ans.room_id is null then null
      else jsonb_build_object(
        'selected_text', v_my_ans.selected_text,
        'is_correct', v_my_ans.is_correct,
        'is_skipped', v_my_ans.is_skipped,
        'double_active', v_my_ans.double_active,
        'eliminated_options', v_my_ans.eliminated_options,
        'extra_time_sec', v_my_ans.extra_time_sec,
        'points_earned', v_my_ans.points_earned,
        'answered', v_my_ans.answered_at is not null
      )
    end
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 10. ADMINISTRACIÓN E IMPORTACIÓN JSON — RPCs
-- ----------------------------------------------------------------------------
create or replace function public.trivia_admin_import_batch(
  p_subjects jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_sub jsonb;
  v_q jsonb;
  v_subject_id uuid;
  v_question_id uuid;
  v_slug text;
  v_name text;
  v_desc text;
  v_prompt_hash text;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_skipped integer := 0;
begin
  if jsonb_typeof(p_subjects) <> 'array' then
    raise exception 'El lote de importación debe ser un arreglo.';
  end if;

  for v_sub in select * from jsonb_array_elements(p_subjects) loop
    v_slug := btrim(coalesce(v_sub ->> 'slug', ''));
    v_name := btrim(coalesce(v_sub ->> 'name', ''));
    v_desc := coalesce(v_sub ->> 'description', '');
    if v_slug = '' or v_name = '' then
      continue;
    end if;

    insert into public.subjects (slug, name, description)
    values (v_slug, v_name, v_desc)
    on conflict (slug) do update
      set name = excluded.name,
          description = case when excluded.description <> '' then excluded.description else public.subjects.description end
    returning id into v_subject_id;

    for v_q in select * from jsonb_array_elements(coalesce(v_sub -> 'questions', '[]'::jsonb)) loop
      v_prompt_hash := md5(public._trivia_norm_prompt(v_q ->> 'prompt'));

      if exists (
        select 1 from public.questions q
        where q.subject_id = v_subject_id
          and public._trivia_norm_prompt(q.prompt) = public._trivia_norm_prompt(v_q ->> 'prompt')
          and q.external_id <> coalesce(v_q ->> 'external_id', '')
      ) then
        v_skipped := v_skipped + 1;
        continue;
      end if;

      insert into public.questions (subject_id, external_id, qtype, prompt, options, explanation, active)
      values (
        v_subject_id,
        coalesce(v_q ->> 'external_id', gen_random_uuid()::text),
        coalesce(v_q ->> 'qtype', 'opcion_multiple'),
        v_q ->> 'prompt',
        v_q -> 'options',
        coalesce(v_q ->> 'explanation', ''),
        true
      )
      on conflict (subject_id, external_id) do update
        set qtype = excluded.qtype,
            prompt = excluded.prompt,
            options = excluded.options,
            explanation = excluded.explanation,
            active = true
      returning id into v_question_id;

      if found then
        v_inserted := v_inserted + 1;
      end if;

      insert into public.trivia_question_meta (question_id, difficulty, tags, extra_metadata, prompt_hash, updated_at)
      values (
        v_question_id,
        case when (v_q ->> 'difficulty') in ('facil', 'media', 'dificil') then v_q ->> 'difficulty' else 'media' end,
        coalesce(array(select jsonb_array_elements_text(coalesce(v_q -> 'tags', '[]'::jsonb))), '{}'::text[]),
        coalesce(v_q -> 'extra_metadata', '{}'::jsonb),
        v_prompt_hash,
        now()
      )
      on conflict (question_id) do update
        set difficulty = excluded.difficulty,
            tags = excluded.tags,
            extra_metadata = excluded.extra_metadata,
            prompt_hash = excluded.prompt_hash,
            updated_at = now();
    end loop;
  end loop;

  return jsonb_build_object(
    'imported', v_inserted,
    'updated', v_updated,
    'skipped_duplicates', v_skipped
  );
end;
$$;

create or replace function public.trivia_admin_list_questions(
  p_subject_id uuid default null,
  p_difficulty text default null,
  p_search text default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with filtered as (
    select
      q.id,
      q.subject_id,
      s.slug as subject_slug,
      s.name as subject_name,
      q.external_id,
      q.qtype,
      q.prompt,
      q.options,
      q.explanation,
      q.active,
      coalesce(m.difficulty, 'media') as difficulty,
      coalesce(m.tags, '{}'::text[]) as tags,
      coalesce(m.extra_metadata, '{}'::jsonb) as extra_metadata
    from public.questions q
    join public.subjects s on s.id = q.subject_id
    left join public.trivia_question_meta m on m.question_id = q.id
    where q.active
      and (p_subject_id is null or q.subject_id = p_subject_id)
      and (p_difficulty is null or p_difficulty = '' or p_difficulty = 'todas' or coalesce(m.difficulty, 'media') = p_difficulty)
      and (
        p_search is null or btrim(p_search) = ''
        or q.prompt ilike '%' || btrim(p_search) || '%'
        or q.explanation ilike '%' || btrim(p_search) || '%'
        or q.external_id ilike '%' || btrim(p_search) || '%'
      )
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'items', coalesce((
      select jsonb_agg(row_to_json(t))
      from (
        select * from filtered
        order by subject_name, external_id
        limit greatest(1, least(coalesce(p_limit, 100), 500))
        offset greatest(0, coalesce(p_offset, 0))
      ) t
    ), '[]'::jsonb)
  );
$$;

create or replace function public.trivia_admin_update_question(
  p_question_id uuid,
  p_prompt text,
  p_options jsonb,
  p_explanation text,
  p_difficulty text default 'media',
  p_qtype text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if jsonb_typeof(p_options) <> 'array' or jsonb_array_length(p_options) < 2 then
    raise exception 'La pregunta debe tener al menos 2 opciones.';
  end if;

  update public.questions
  set prompt = btrim(p_prompt),
      options = p_options,
      explanation = coalesce(p_explanation, ''),
      qtype = coalesce(p_qtype, qtype)
  where id = p_question_id;

  if not found then
    raise exception 'Pregunta no encontrada.';
  end if;

  insert into public.trivia_question_meta (question_id, difficulty, prompt_hash, updated_at)
  values (
    p_question_id,
    case when p_difficulty in ('facil', 'media', 'dificil') then p_difficulty else 'media' end,
    md5(public._trivia_norm_prompt(p_prompt)),
    now()
  )
  on conflict (question_id) do update
    set difficulty = excluded.difficulty,
        prompt_hash = excluded.prompt_hash,
        updated_at = now();

  return jsonb_build_object('ok', true, 'id', p_question_id);
end;
$$;

create or replace function public.trivia_admin_delete_question(
  p_question_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  -- Desactivar para no romper referencias históricas de exámenes en Evalua
  update public.questions
  set active = false
  where id = p_question_id;

  return jsonb_build_object('ok', true, 'id', p_question_id);
end;
$$;

create or replace function public.trivia_admin_export_questions(
  p_subject_id uuid default null
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'titulo_libro', s.name,
    'slug', s.slug,
    'descripcion', s.description,
    'preguntas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.external_id,
        'tipo', q.qtype,
        'pregunta', q.prompt,
        'opciones', q.options,
        'explicacion', q.explanation,
        'dificultad', coalesce(m.difficulty, 'media')
      ) order by q.external_id)
      from public.questions q
      left join public.trivia_question_meta m on m.question_id = q.id
      where q.subject_id = s.id and q.active
    ), '[]'::jsonb)
  ) order by s.name), '[]'::jsonb)
  from public.subjects s
  where p_subject_id is null or s.id = p_subject_id;
$$;

-- ----------------------------------------------------------------------------
-- 11. ESTADÍSTICAS INDEPENDIENTES Y COMBINADAS — RPC
-- ----------------------------------------------------------------------------
create or replace function public.trivia_player_stats(p_student_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_solo jsonb;
  v_mp jsonb;
  v_categories jsonb;
  v_achievements jsonb;
  v_recent_solo jsonb;
begin
  select jsonb_build_object(
    'games_played', count(*),
    'competitive_games', count(*) filter (where mode = 'competitivo'),
    'practice_games', count(*) filter (where mode = 'practica'),
    'best_score', coalesce(max(score) filter (where mode = 'competitivo'), 0),
    'avg_score', coalesce(round(avg(score) filter (where mode = 'competitivo'))::integer, 0),
    'total_correct', coalesce(sum(correct_count), 0),
    'total_incorrect', coalesce(sum(incorrect_count), 0),
    'accuracy_pct', case
      when coalesce(sum(correct_count + incorrect_count), 0) = 0 then 0
      else round((sum(correct_count)::numeric / sum(correct_count + incorrect_count)) * 100, 1)
    end,
    'best_streak', coalesce(max(best_streak), 0)
  ) into v_solo
  from public.trivia_solo_games
  where student_id = p_student_id and status = 'finished';

  select jsonb_build_object(
    'games_played', count(*),
    'wins', count(*) filter (where p.final_rank = 1),
    'win_rate_pct', case
      when count(*) = 0 then 0
      else round((count(*) filter (where p.final_rank = 1)::numeric / count(*)) * 100, 1)
    end,
    'avg_score', coalesce(round(avg(p.score))::integer, 0),
    'best_score', coalesce(max(p.score), 0),
    'comebacks', count(*) filter (where p.final_rank = 1 and p.was_behind),
    'podiums', count(*) filter (where p.final_rank <= 3),
    'avg_rank', coalesce(round(avg(p.final_rank)::numeric, 1), 0),
    'total_correct', coalesce(sum(p.correct_count), 0),
    'total_incorrect', coalesce(sum(p.incorrect_count), 0)
  ) into v_mp
  from public.trivia_room_players p
  join public.trivia_rooms r on r.id = p.room_id
  where p.student_id = p_student_id and r.status = 'finished';

  select coalesce(jsonb_agg(jsonb_build_object(
    'subject_id', sub.subject_id,
    'subject_name', sub.subject_name,
    'answered', sub.answered,
    'correct', sub.correct,
    'accuracy_pct', round((sub.correct::numeric / greatest(sub.answered, 1)) * 100, 1),
    'best_points', sub.best_points
  ) order by sub.accuracy_pct desc, sub.answered desc), '[]'::jsonb)
  into v_categories
  from (
    select
      q.subject_id,
      max(q.subject_name) as subject_name,
      count(*) as answered,
      count(*) filter (where q.is_correct) as correct,
      coalesce(sum(q.points_earned), 0) as best_points,
      round((count(*) filter (where q.is_correct)::numeric / greatest(count(*), 1)) * 100, 1) as accuracy_pct
    from public.trivia_solo_questions q
    join public.trivia_solo_games g on g.id = q.game_id
    where g.student_id = p_student_id and g.status = 'finished' and q.answered_at is not null
    group by q.subject_id
  ) sub;

  select coalesce(jsonb_agg(jsonb_build_object(
    'code', a.code,
    'title', a.title,
    'description', a.description,
    'unlocked_at', a.unlocked_at
  ) order by a.unlocked_at desc), '[]'::jsonb)
  into v_achievements
  from public.trivia_achievements a
  where a.student_id = p_student_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', g.id,
    'mode', g.mode,
    'score', g.score,
    'correct_count', g.correct_count,
    'incorrect_count', g.incorrect_count,
    'best_streak', g.best_streak,
    'finished_at', g.finished_at
  ) order by g.finished_at desc), '[]'::jsonb)
  into v_recent_solo
  from (
    select * from public.trivia_solo_games
    where student_id = p_student_id and status = 'finished'
    order by finished_at desc
    limit 10
  ) g;

  return jsonb_build_object(
    'solo', v_solo,
    'multiplayer', v_mp,
    'categories', v_categories,
    'achievements', v_achievements,
    'recent_solo', v_recent_solo
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 12. Permisos EXECUTE para las RPCs
-- ----------------------------------------------------------------------------
grant execute on function public.trivia_list_categories() to anon, authenticated;
grant execute on function public.trivia_solo_start(uuid, text, integer, integer, integer, uuid[], text, boolean, uuid[]) to anon, authenticated;
grant execute on function public.trivia_solo_get_state(uuid, uuid) to anon, authenticated;
grant execute on function public.trivia_solo_use_lifeline(uuid, uuid, integer, text) to anon, authenticated;
grant execute on function public.trivia_solo_answer(uuid, uuid, integer, text, integer) to anon, authenticated;
grant execute on function public.trivia_solo_finish(uuid, uuid) to anon, authenticated;
grant execute on function public.trivia_mp_create_room(uuid, integer, integer, integer, uuid[], text, boolean) to anon, authenticated;
grant execute on function public.trivia_mp_join_room(text, uuid) to anon, authenticated;
grant execute on function public.trivia_mp_set_ready(uuid, uuid, boolean) to anon, authenticated;
grant execute on function public.trivia_mp_start_room(uuid, uuid) to anon, authenticated;
grant execute on function public.trivia_mp_use_lifeline(uuid, uuid, text) to anon, authenticated;
grant execute on function public.trivia_mp_answer(uuid, uuid, text, integer) to anon, authenticated;
grant execute on function public.trivia_mp_advance(uuid, uuid) to anon, authenticated;
grant execute on function public.trivia_mp_get_state(uuid, uuid) to anon, authenticated;
grant execute on function public.trivia_admin_import_batch(jsonb) to anon, authenticated;
grant execute on function public.trivia_admin_list_questions(uuid, text, text, integer, integer) to anon, authenticated;
grant execute on function public.trivia_admin_update_question(uuid, text, jsonb, text, text, text) to anon, authenticated;
grant execute on function public.trivia_admin_delete_question(uuid) to anon, authenticated;
grant execute on function public.trivia_admin_export_questions(uuid) to anon, authenticated;
grant execute on function public.trivia_player_stats(uuid) to anon, authenticated;

commit;
