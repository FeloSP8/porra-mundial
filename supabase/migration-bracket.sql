-- ============================================================================
--  MIGRACIÓN: modalidad "Cuadro completo" (bracket)
--
--  Cómo aplicarla:
--    Supabase → SQL Editor → New query → pega TODO esto → Run.
--  Es idempotente y NO borra pronósticos: solo crea la tabla/fase del cuadro
--  y devuelve a BORRADOR a quien ya había enviado la fase de grupos (para que
--  pueda completar también el cuadro). Los marcadores y el orden de grupos se
--  conservan intactos.
-- ============================================================================

-- 1) Tabla del pronóstico-cuadro.
create table if not exists public.bracket_predictions (
  id             bigint generated always as identity primary key,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  slot           text not null,
  round          text not null,
  team           text not null,
  points_awarded int not null default 0,
  unique (user_id, slot)
);

create index if not exists idx_bracket_user on public.bracket_predictions (user_id);

-- 2) RLS: lectura para autenticados, escritura solo lo propio.
alter table public.bracket_predictions enable row level security;

drop policy if exists "read bracket" on public.bracket_predictions;
create policy "read bracket" on public.bracket_predictions
  for select to authenticated using (true);

drop policy if exists "insert own bracket" on public.bracket_predictions;
create policy "insert own bracket" on public.bracket_predictions
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "update own bracket" on public.bracket_predictions;
create policy "update own bracket" on public.bracket_predictions
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "delete own bracket" on public.bracket_predictions;
create policy "delete own bracket" on public.bracket_predictions
  for delete to authenticated using (auth.uid() = user_id);

-- 3) Fase virtual 'bracket' (order 0, mismo deadline que grupos, abierta).
insert into public.phases (key, name, "order", deadline, is_open)
select 'bracket', 'Cuadro completo', 0,
       (select deadline from public.phases where key = 'groups'),
       true
where not exists (select 1 from public.phases where key = 'bracket');

-- 4) Reset de envíos de la fase de grupos → todos vuelven a BORRADOR.
--    NO toca predictions ni group_standings_predictions.
delete from public.submissions
where phase_id = (select id from public.phases where key = 'groups');

-- 5) Forzar recarga del schema cache de PostgREST (para que la API vea la tabla).
notify pgrst, 'reload schema';
