-- ============================================================================
--  Porra Mundial 2026 — Esquema de base de datos (Supabase / Postgres)
--
--  Cómo aplicarlo:
--    1. Crea un proyecto en https://supabase.com (plan free).
--    2. En el panel: SQL Editor → New query → pega TODO este archivo → Run.
--    Es idempotente: puedes volver a ejecutarlo sin romper nada.
-- ============================================================================

-- ----------------------------------------------------------------------------
--  PERFILES (1 fila por jugador, enlazada a auth.users de Supabase Auth)
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  is_admin     boolean not null default false,
  created_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
--  FASES (las 6: groups, r32, r16, qf, sf, final)
-- ----------------------------------------------------------------------------
create table if not exists public.phases (
  id         bigint generated always as identity primary key,
  key        text not null unique,        -- groups | r32 | r16 | qf | sf | final
  name       text not null,
  "order"    int  not null,
  deadline   timestamptz,                 -- cierre automático de envíos
  is_open    boolean not null default false
);

-- ----------------------------------------------------------------------------
--  PARTIDOS
-- ----------------------------------------------------------------------------
create table if not exists public.matches (
  id          bigint generated always as identity primary key,
  external_id bigint unique,              -- id del partido en football-data.org
  phase_id    bigint not null references public.phases (id) on delete cascade,
  stage       text,                       -- GROUP_STAGE, LAST_32, ...
  group_label text,                       -- A..L (null en eliminatorias)
  matchday    int,
  home_team   text not null,
  away_team   text not null,
  kickoff     timestamptz,
  home_score  int,                        -- marcador a los 90' (sin prórroga/penaltis)
  away_score  int,
  winner      text,                        -- HOME_TEAM | AWAY_TEAM | DRAW | null (ganador real del cruce)
  status      text not null default 'SCHEDULED', -- SCHEDULED | FINISHED
  updated_at  timestamptz not null default now()
);
-- Por si la tabla ya existía sin la columna `winner` (instalaciones previas).
alter table public.matches add column if not exists winner text;

create index if not exists idx_matches_phase on public.matches (phase_id);
create index if not exists idx_matches_status on public.matches (status);

-- ----------------------------------------------------------------------------
--  PRONÓSTICOS DE PARTIDOS
-- ----------------------------------------------------------------------------
create table if not exists public.predictions (
  id             bigint generated always as identity primary key,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  match_id       bigint not null references public.matches (id) on delete cascade,
  pred_home      int not null,
  pred_away      int not null,
  points_awarded int not null default 0,
  updated_at     timestamptz not null default now(),
  unique (user_id, match_id)
);

create index if not exists idx_predictions_user on public.predictions (user_id);
create index if not exists idx_predictions_match on public.predictions (match_id);

-- ----------------------------------------------------------------------------
--  PRONÓSTICOS DE ORDEN DE GRUPOS
--  (1 fila por jugador+grupo+equipo, con la posición pronosticada 1..4)
-- ----------------------------------------------------------------------------
create table if not exists public.group_standings_predictions (
  id             bigint generated always as identity primary key,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  phase_id       bigint not null references public.phases (id) on delete cascade,
  group_label    text not null,           -- A..L
  team           text not null,
  predicted_rank int not null,            -- 1..4
  points_awarded int not null default 0,
  unique (user_id, group_label, team)
);

create index if not exists idx_gsp_user on public.group_standings_predictions (user_id);

-- ----------------------------------------------------------------------------
--  PRONÓSTICO-CUADRO (bracket): pronóstico de TODO el cuadro de eliminatorias
--  hasta la final, incluido el campeón. Se rellena una vez antes del Mundial.
--  1 fila por jugador + slot del cuadro. (slot/round definidos en lib/bracket.ts)
-- ----------------------------------------------------------------------------
create table if not exists public.bracket_predictions (
  id             bigint generated always as identity primary key,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  slot           text not null,           -- hueco del cuadro (ver lib/bracket.ts)
  round          text not null,           -- r32 | r16 | qf | sf | final | champion
  team           text not null,           -- equipo que avanza a ese hueco
  points_awarded int not null default 0,
  unique (user_id, slot)
);

create index if not exists idx_bracket_user on public.bracket_predictions (user_id);

-- ----------------------------------------------------------------------------
--  ENVÍOS (marca que un jugador "envió" una fase → bloquea ediciones)
-- ----------------------------------------------------------------------------
create table if not exists public.submissions (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  phase_id     bigint not null references public.phases (id) on delete cascade,
  submitted_at timestamptz not null default now(),
  unique (user_id, phase_id)
);

-- ----------------------------------------------------------------------------
--  PENALIZACIONES POR FASE
--  Si un jugador NO envía una fase antes del deadline, el cron lo marca como
--  enviado igualmente y le aplica una penalización: -2 puntos por cada partido
--  de la fase sin marcador. 1 fila por jugador+fase (idempotente).
-- ----------------------------------------------------------------------------
create table if not exists public.phase_penalties (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  phase_id     bigint not null references public.phases (id) on delete cascade,
  missing      int not null default 0,    -- partidos sin pronóstico
  points       int not null default 0,    -- penalización total (negativa)
  created_at   timestamptz not null default now(),
  unique (user_id, phase_id)
);

create index if not exists idx_penalties_user on public.phase_penalties (user_id);

-- ----------------------------------------------------------------------------
--  CLASIFICACIÓN REAL DE GRUPOS (la rellena el cron al terminar los grupos)
-- ----------------------------------------------------------------------------
create table if not exists public.group_results (
  id          bigint generated always as identity primary key,
  group_label text not null,
  team        text not null,
  rank        int not null,               -- posición real 1..4
  unique (group_label, team)
);

-- ----------------------------------------------------------------------------
--  SEED de las 6 fases con deadlines reales del Mundial 2026 (en UTC).
--
--  Fechas oficiales de inicio de cada ronda:
--    Grupos    11 jun  (inaugural: México–Sudáfrica en Ciudad de México)
--    R32       28 jun
--    R16        4 jul
--    Cuartos    9 jul
--    Semis     14 jul
--    Final     19 jul
--
--  Cada deadline está fijado al inicio (00:00 UTC) del día de la primera
--  jornada de la fase, lo que cae ANTES de cualquier partido de esa ronda.
--  Solo la fase de grupos arranca abierta; el resto las abres tú desde el
--  panel admin cuando se conozcan los emparejamientos. Ajusta horas/zona a
--  tu gusto en el panel admin.
-- ----------------------------------------------------------------------------
insert into public.phases (key, name, "order", deadline, is_open) values
  ('bracket','Cuadro completo',             0, '2026-06-11T00:00:00Z', true),
  ('groups', 'Fase de grupos',              1, '2026-06-11T00:00:00Z', true),
  ('r32',    'Dieciseisavos (Ronda de 32)', 2, '2026-06-28T00:00:00Z', false),
  ('r16',    'Octavos (Ronda de 16)',       3, '2026-07-04T00:00:00Z', false),
  ('qf',     'Cuartos de final',            4, '2026-07-09T00:00:00Z', false),
  ('sf',     'Semifinales',                 5, '2026-07-14T00:00:00Z', false),
  ('final',  'Final',                       6, '2026-07-19T00:00:00Z', false)
on conflict (key) do nothing;

-- ----------------------------------------------------------------------------
--  TRIGGER: al crearse un usuario en auth.users, crea su fila en profiles.
--  El display_name sale del metadata; is_admin se ajusta luego a mano.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
--  ROW LEVEL SECURITY (RLS)
--
--  Filosofía:
--   - Todo el mundo logueado PUEDE LEER: fases, partidos, perfiles,
--     resultados de grupos y la clasificación (predictions con sus puntos).
--   - Cada jugador solo PUEDE ESCRIBIR sus propios pronósticos/envíos.
--   - El cron y el admin escriben resultados usando la service_role key,
--     que SALTA RLS por diseño (por eso es secreta y solo vive en el servidor).
-- ============================================================================

alter table public.profiles                    enable row level security;
alter table public.phases                       enable row level security;
alter table public.matches                      enable row level security;
alter table public.predictions                  enable row level security;
alter table public.group_standings_predictions  enable row level security;
alter table public.bracket_predictions          enable row level security;
alter table public.submissions                  enable row level security;
alter table public.group_results                enable row level security;
alter table public.phase_penalties              enable row level security;

-- --- LECTURA: cualquier usuario autenticado ---
drop policy if exists "read profiles"   on public.profiles;
create policy "read profiles"   on public.profiles   for select to authenticated using (true);

drop policy if exists "read phases"     on public.phases;
create policy "read phases"     on public.phases     for select to authenticated using (true);

drop policy if exists "read matches"    on public.matches;
create policy "read matches"    on public.matches    for select to authenticated using (true);

drop policy if exists "read predictions" on public.predictions;
create policy "read predictions" on public.predictions for select to authenticated using (true);

drop policy if exists "read gsp"        on public.group_standings_predictions;
create policy "read gsp"        on public.group_standings_predictions for select to authenticated using (true);

drop policy if exists "read bracket"    on public.bracket_predictions;
create policy "read bracket"    on public.bracket_predictions for select to authenticated using (true);

drop policy if exists "read submissions" on public.submissions;
create policy "read submissions" on public.submissions for select to authenticated using (true);

drop policy if exists "read group_results" on public.group_results;
create policy "read group_results" on public.group_results for select to authenticated using (true);

drop policy if exists "read penalties" on public.phase_penalties;
create policy "read penalties" on public.phase_penalties for select to authenticated using (true);

-- --- ESCRITURA de pronósticos: solo lo propio ---
drop policy if exists "insert own predictions" on public.predictions;
create policy "insert own predictions" on public.predictions
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "update own predictions" on public.predictions;
create policy "update own predictions" on public.predictions
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "delete own predictions" on public.predictions;
create policy "delete own predictions" on public.predictions
  for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "insert own gsp" on public.group_standings_predictions;
create policy "insert own gsp" on public.group_standings_predictions
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "update own gsp" on public.group_standings_predictions;
create policy "update own gsp" on public.group_standings_predictions
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "delete own gsp" on public.group_standings_predictions;
create policy "delete own gsp" on public.group_standings_predictions
  for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "insert own bracket" on public.bracket_predictions;
create policy "insert own bracket" on public.bracket_predictions
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "update own bracket" on public.bracket_predictions;
create policy "update own bracket" on public.bracket_predictions
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "delete own bracket" on public.bracket_predictions;
create policy "delete own bracket" on public.bracket_predictions
  for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "insert own submissions" on public.submissions;
create policy "insert own submissions" on public.submissions
  for insert to authenticated with check (auth.uid() = user_id);

-- NOTA: no hay policies de escritura para matches / phases / group_results.
-- Eso es intencional: solo la service_role key (servidor) puede modificarlas.
