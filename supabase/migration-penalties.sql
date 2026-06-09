-- ============================================================================
--  MIGRACIÓN: penalizaciones por no enviar a tiempo
--
--  Cómo aplicarla:
--    Supabase → SQL Editor → New query → pega TODO esto → Run.
--  Idempotente. Crea la tabla phase_penalties y su RLS. No borra nada.
--
--  Regla: cuando cierra una fase, el cron marca como enviados a quienes no
--  enviaron y les resta 2 puntos por cada partido de la fase sin marcador.
-- ============================================================================

create table if not exists public.phase_penalties (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  phase_id     bigint not null references public.phases (id) on delete cascade,
  missing      int not null default 0,
  points       int not null default 0,
  created_at   timestamptz not null default now(),
  unique (user_id, phase_id)
);

create index if not exists idx_penalties_user on public.phase_penalties (user_id);

alter table public.phase_penalties enable row level security;

drop policy if exists "read penalties" on public.phase_penalties;
create policy "read penalties" on public.phase_penalties
  for select to authenticated using (true);

-- Recargar el schema cache de PostgREST para que la API vea la tabla.
notify pgrst, 'reload schema';
