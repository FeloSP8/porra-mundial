-- ============================================================================
--  Migración: registro de ejecuciones de la rutina de actualización.
--
--  Cómo aplicarla:
--    Supabase → SQL Editor → New query → pega este archivo → Run.
--    Es idempotente.
--
--  Qué hace:
--    Crea la tabla `cron_runs`, donde cada ejecución de runFullUpdate (el cron
--    diario y el botón "Actualizar" del panel) deja una fila con su resultado:
--    cuándo corrió, si fue bien, cuánto tardó, si football-data falló y un
--    resumen completo (partidos creados/actualizados, fases abiertas/cerradas,
--    puntos recalculados, etc.). Así se puede auditar si el cron falló.
-- ============================================================================

create table if not exists public.cron_runs (
  id                  bigint generated always as identity primary key,
  ran_at              timestamptz not null default now(),
  source              text not null default 'cron',   -- 'cron' | 'admin'
  ok                  boolean not null,               -- terminó sin lanzar error
  duration_ms         integer,
  football_data_error text,                            -- null si el sync fue bien
  error               text,                            -- error global si petó todo
  summary             jsonb                            -- log completo de runFullUpdate
);

create index if not exists idx_cron_runs_ran_at
  on public.cron_runs (ran_at desc);

-- Solo el service_role (cron y panel admin) accede: RLS activo y sin políticas.
alter table public.cron_runs enable row level security;

-- Refrescar el schema cache de PostgREST.
notify pgrst, 'reload schema';
