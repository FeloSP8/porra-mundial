# ⚽ Porra Mundial 2026

Porra entre amigos para el **Mundial 2026**. Cada jugador entra con su **nombre
de usuario** y contraseña, rellena sus pronósticos por fase y los envía. Tras
cada partido se actualiza la clasificación. Una rutina diaria comprueba los
resultados automáticamente y recalcula los puntos.

- **Stack:** Next.js 14 (App Router, TypeScript) + Tailwind.
- **BD + login:** Supabase (Postgres + Auth).
- **Resultados:** football-data.org (plan gratuito, competición `WC`).
- **Hosting + rutina diaria:** Vercel (plan Hobby gratuito + Vercel Cron).
- **Coste:** 0 € para ~5 jugadores.
- **Diseño mobile-first:** pensada para usarse sobre todo desde el móvil.

Las 6 fases: **grupos → dieciseisavos (R32) → octavos (R16) → cuartos →
semifinales → final**.

---

## Funcionalidades

- **Login por nombre de usuario** (oscar, juanmi, …), sin necesidad de correos
  reales. Internamente se mapea a `<usuario>@porra.local`
  (ver [`lib/username.ts`](lib/username.ts)).
- **Pronósticos por fase** con guardado de borrador y envío que bloquea la
  edición. Cierre automático por fecha límite.
- **Clasificación de grupo automática**: el orden de cada grupo se calcula solo
  a partir de los marcadores pronosticados, con los **criterios de desempate
  oficiales de la FIFA 2026** (ver [`lib/groupTable.ts`](lib/groupTable.ts)).
- **Banderas** (SVG, vía `flag-icons`) y **nombres de países en español**
  (ver [`lib/flags.ts`](lib/flags.ts)).
- **Vista por jornadas** (`/jornadas`): qué pronosticó cada uno en cada partido,
  con navegación por jornadas y centrada en la jornada actual/próxima.
- **Privacidad de pronósticos** estricta: nadie ve los pronósticos de otros
  hasta que se cierra la fase (o, en fase abierta, hasta que tanto tú como el
  otro habéis enviado). El filtrado se hace en el servidor
  ([`lib/predictionVisibility.ts`](lib/predictionVisibility.ts)).
- **Cuadro completo (bracket):** pronóstico de toda la eliminatoria hasta la
  final, incluido el campeón, que se rellena una vez antes del Mundial. Se
  construye a partir de tu propio pronóstico de grupos. Suma **1 punto extra por
  cada cruce acertado** (+1 por el campeón), aparte de lo demás. Ver
  [`lib/bracket.ts`](lib/bracket.ts).
- **Clasificación general** (Partidos + Grupos + Cuadro) + **estado de envíos**
  de cada jugador en la home.
- **Panel admin** para abrir/cerrar fases, fijar deadlines, meter resultados a
  mano y recalcular.
- **Generación automática de cruces:** entre fases, el cron crea los partidos de
  eliminatoria a medida que football-data confirma los emparejamientos.

---

## Puntuación (editable)

Definida en [`lib/scoring.ts`](lib/scoring.ts). Valores por defecto:

| Acierto                                   | Puntos |
| ----------------------------------------- | ------ |
| Marcador exacto de un partido             | 3      |
| Solo el resultado (1, X o 2)              | 1      |
| Cada equipo bien colocado en su grupo     | 1      |

Para cambiarlos: edita `SCORING` en `lib/scoring.ts`, vuelve a desplegar y pulsa
**“Recalcular puntos ahora”** en el panel admin.

> El orden de los grupos **no se elige a mano**: se deduce de los marcadores que
> pronostica cada jugador, aplicando los desempates oficiales de la FIFA
> (enfrentamiento directo → diferencia de goles directa → goles directos →
> diferencia de goles global → goles globales). Lo mismo se usa para calcular el
> orden real de cada grupo cuando terminan los partidos.

---

## Puesta en marcha (paso a paso)

### 1. Crear el proyecto en Supabase

1. Entra en <https://supabase.com> → **New project** (plan Free).
2. Cuando esté listo: **SQL Editor → New query**, pega TODO el contenido de
   [`supabase/schema.sql`](supabase/schema.sql) y pulsa **Run**. Esto crea las
   tablas, las políticas de seguridad (RLS) y las 6 fases.
3. Ve a **Project Settings → API** y copia:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key (¡secreta!) → `SUPABASE_SERVICE_ROLE_KEY`

### 2. Token de football-data.org

1. Regístrate gratis en <https://www.football-data.org/client/register>.
2. Copia tu token → `FOOTBALL_DATA_TOKEN`.

### 3. Variables de entorno locales

Copia el ejemplo y rellénalo:

```bash
cp .env.local.example .env.local
```

Rellena las 5 variables (las 3 de Supabase, el token de football-data y un
`CRON_SECRET` que te inventes: una cadena larga y aleatoria).

### 4. Instalar y arrancar en local

```bash
npm install
npm run dev
```

Abre <http://localhost:3000>. Te pedirá login (todavía no hay usuarios → paso 5).

### 5. Dar de alta a los jugadores

Los jugadores entran por **nombre de usuario** (no por email). Internamente cada
usuario se mapea a `<usuario>@porra.local` (ver [`lib/username.ts`](lib/username.ts));
nadie necesita un correo real.

1. Edita la lista `PLAYERS` en [`scripts/seed-users.ts`](scripts/seed-users.ts)
   con tus jugadores (`username`, `displayName`). Marca a uno como `isAdmin: true`.
   La contraseña temporal común está en `TEMP_PASSWORD` (por defecto `porra2026`).
2. Ejecuta:

   ```bash
   npm run seed:users
   ```

3. Reparte a cada jugador su **usuario** y la **contraseña temporal** por privado.

### 6. Cargar el calendario del Mundial

```bash
npm run load:calendar
```

Trae todos los partidos desde football-data y los asigna a su fase. Vuelve a
ejecutarlo cuando se conozcan los emparejamientos de cada eliminatoria (crea los
nuevos y actualiza los existentes).

### 7. Comprobar que todo está bien configurado

```bash
npm run check     # valida variables, conexión a Supabase, esquema, token...
npm test          # tests (puntuación, clasificación de grupos, privacidad, ...)
```

`npm run check` te dice exactamente qué falta (variables, esquema sin aplicar,
sin usuarios, sin calendario…) antes de desplegar. Solo lee, no modifica nada.

Entra como admin → **Admin** → introduce un resultado a mano → comprueba que la
**Clasificación** se actualiza.

---

## Despliegue en Vercel (gratis)

1. Sube el proyecto a un repo de GitHub.
2. En <https://vercel.com> → **New Project** → importa el repo.
3. En **Settings → Environment Variables**, añade las 5 variables del
   `.env.local` (para los entornos Production y Preview).
4. **Deploy.**
5. El cron de [`vercel.json`](vercel.json) (`0 7 * * *`, una vez al día — máximo
   del plan Hobby) aparecerá en **Settings → Cron Jobs**. Vercel envía
   automáticamente el header `Authorization: Bearer <CRON_SECRET>`, así que el
   endpoint queda protegido.

> ⏰ La hora del cron (07:00 UTC) y la zona horaria se ajustan en `vercel.json`.
> El plan gratuito solo permite **una ejecución diaria**, que es justo lo que
> necesita esta porra (“cada mañana”).

---

## Cómo funciona la rutina diaria

`/api/cron/actualizar-resultados`:

1. Cierra las fases cuyo `deadline` ya pasó.
2. Llama a football-data (`status=FINISHED`) y actualiza los marcadores
   (casando por `external_id`).
3. Calcula la clasificación real de los grupos completados.
4. Recalcula los puntos de todos los jugadores ([`lib/recalc.ts`](lib/recalc.ts)).

Si football-data falla o se queda sin cuota, la rutina **no rompe**: recalcula
con lo que haya en la BD, y siempre puedes meter resultados a mano desde el panel
admin.

Probar el cron a mano:

```bash
curl -H "Authorization: Bearer TU_CRON_SECRET" \
  http://localhost:3000/api/cron/actualizar-resultados
```

---

## Flujo de cada fase (tu rutina como organizador)

1. Cuando se conozcan los emparejamientos de la fase → `npm run load:calendar`.
2. En el panel **Admin**: fija el **deadline** (justo antes del primer partido)
   y pulsa **Abrir** la fase.
3. Los jugadores rellenan y **envían** su pronóstico (al enviar se bloquea).
4. Al llegar el deadline, la fase se cierra sola (o ciérrala a mano).
5. Cada mañana el cron actualiza resultados y puntos. Si hace falta, edita
   resultados a mano y pulsa **Recalcular**.
6. Repite para la siguiente fase (6 en total).

---

## Estructura del proyecto

```
app/
  login/                     ← pantalla de acceso (por nombre de usuario)
  (app)/                     ← área logueada (con barra de navegación)
    page.tsx                 ← inicio: clasificación + jornada actual + estado
    predicciones/            ← lista de fases con su estado
    predicciones/[fase]/     ← rellenar/enviar pronóstico de una fase
    jornadas/                ← pronósticos por jornada (+ modo demo admin)
    clasificacion/           ← tabla general (la ven todos)
    reglas/                  ← puntuación y normas
  admin/                     ← panel del organizador (solo admin)
  api/
    predicciones/            ← guardar/enviar (valida deadline y envío)
    cron/actualizar-resultados/  ← rutina diaria
    admin/                   ← abrir/cerrar fase, resultados, recálculo
components/
  NavBar / Flag / PredictionForm / GroupStandings   ← UI común
  MatchdayView / MatchCard / HomeMatchdayCard       ← vista de jornadas
  LeaderboardTable / PhaseProgress                  ← clasificación y estado
  admin/                                            ← controles del panel admin
lib/
  scoring.ts                 ← puntuación (única fuente de verdad) + tests
  groupTable.ts              ← clasificación de grupo + desempates FIFA + tests
  recalc.ts                  ← recálculo de puntos y clasificación de grupos
  predictionVisibility.ts    ← filtro de privacidad de pronósticos + tests
  loadMatchdayData.ts        ← carga de datos de jornadas (server)
  matchdays.ts               ← agrupar/ordenar jornadas
  flags.ts                   ← banderas (ISO) + nombres en español
  username.ts                ← login por usuario ↔ email interno
  footballdata.ts            ← cliente de football-data.org
  supabase/                  ← clientes (browser / server / admin) + middleware
supabase/schema.sql          ← tablas + RLS + seed de fases
  bracket.ts                 ← estructura del cuadro + construcción desde grupos
  bracketScoring.ts          ← puntuación del cuadro (1 pt/cruce + campeón)
  syncCalendar.ts            ← crea/actualiza partidos desde football-data
supabase/migration-bracket.sql  ← migración para activar el cuadro
scripts/
  seed-users.ts              ← alta de jugadores
  load-calendar.ts           ← carga del calendario
  check-setup.ts             ← verificación previa al despliegue
  migrate-bracket.ts         ← reset de envíos (parte de la migración del cuadro)
vercel.json                  ← cron diario
vitest.config.ts             ← config de tests
```

---

## Seguridad y privacidad (resumen)

- **RLS activado** en todas las tablas: cada jugador solo escribe lo suyo.
- **Privacidad de pronósticos:** nadie ve los pronósticos de otros hasta que se
  cierra la fase. En fase abierta, solo ves los de un jugador si **ambos** habéis
  enviado. El filtrado se aplica en el **servidor** antes de mandar nada al
  cliente ([`lib/predictionVisibility.ts`](lib/predictionVisibility.ts)), así
  que ningún pronóstico ajeno llega al navegador antes de tiempo.
- La **service_role key** (salta RLS) solo vive en el servidor: cron, rutas de
  admin y scripts. Nunca se expone al navegador.
- El **panel admin** está protegido por `is_admin` en el servidor.
- El **cron** está protegido por `CRON_SECRET`.

### Modo demo (solo admin)

`/jornadas?demo=1` muestra una previsualización de la vista de jornadas **con
jugadores y pronósticos ficticios** (nunca borradores reales). Útil para ver
cómo quedará la página cuando se cierre una fase. Solo lo ve el admin.
