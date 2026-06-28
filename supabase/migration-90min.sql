-- ============================================================================
--  Migración: puntuar las eliminatorias por el resultado a los 90 minutos.
--
--  Cómo aplicarla:
--    Supabase → SQL Editor → New query → pega este archivo → Run.
--    Es idempotente.
--
--  Qué hace:
--    Añade la columna `winner` a `matches`. A partir de ahora `home_score` /
--    `away_score` guardan el marcador a los 90' (sin prórroga ni penaltis), que
--    es contra lo que se puntúan los pronósticos. `winner` guarda el ganador
--    REAL del cruce (incluyendo prórroga/penaltis) y solo se usa para
--    determinar el campeón en el cuadro.
--
--  Tras aplicarla, lanza "Actualizar" en el panel admin (o espera al cron) para
--  re-sincronizar los marcadores ya jugados con el valor a 90'.
-- ============================================================================

alter table public.matches
  add column if not exists winner text; -- HOME_TEAM | AWAY_TEAM | DRAW | null
