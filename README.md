# Gamma Tracker V2

Offline-first Android workout tracker focused on repeatable strength/hypertrophy sessions:
technique consistency, double progression, fast set entry, and history that never compares
different equipment variants.

Built with Expo SDK 57, React Native, TypeScript, Expo Router, `expo-sqlite`, and Zustand.

## Getting started

```bash
npm install
npx expo start            # dev server
npm run typecheck
npm run lint
npm test
```

The app uses native modules (SQLite, notifications, haptics), so use a development build
on a physical Android phone rather than Expo Go:

```bash
npx eas-cli@latest build -p android --profile development   # dev client
npx eas-cli@latest build -p android --profile preview       # installable APK
```

`eas.json` sets `preview` to produce an APK. Android package: `com.gamma.workouttracker`.

## Architecture

```text
src/
  app/                 Expo Router routes (screens only)
    (tabs)/            Today · History · Exercises · Progress · Settings
    workout/[id]       Active workout
    summary/[id]       Post-workout summary
    session/[id]       Historical session detail/editing
    exercise/, variant/, template/, pick-exercise
  components/          Presentational UI (buttons, steppers, chart, …)
  features/            Feature logic + feature components (workout, timer, settings, …)
  domain/              Pure TS, no React: progression, records, summary, body-weight trend, backup schema
  db/
    database.ts        Minimal async DB interface (expo-sqlite satisfies it; tests use node:sqlite)
    migrations/        Append-only migrations, schema version in PRAGMA user_version
    repositories/      All SQL lives here
  stores/              Zustand: ephemeral state only (rest timer, active-session pointer)
  state/               App context: repositories, settings, theme
  testing/             node:sqlite test adapter
```

Rules: UI never runs SQL; domain logic never imports React; repositories own persistence;
SQLite is the source of truth.

### Key behaviours

- **Variants**: every performance is tied to an `exercise_variant` (e.g. *Lat Pulldown — Cable /
  Straight Bar* vs *Technogym Machine*). History, suggestions and PRs only ever use the same variant.
- **Progression** (`src/domain/progression`): double progression. Reps first; load increases only
  when every target set reaches the top of the range with valid technique; restart at the bottom of
  the range after a load increase; technique-invalid sets never count; a top-of-range set at RIR 0
  does not unlock load unless enabled in Settings.
- **Persistence**: every set change is written immediately; the active session survives restarts;
  at most one active session (enforced by a partial unique index).
- **Technique snapshots**: each session stores a copy of the technique cues, so editing a profile
  never rewrites how old sessions read.
- **Rest timer**: absolute end time persisted in SQLite; Android notification scheduled for the end
  time; haptic feedback in the foreground.
- **PRs**: technical (best e1RM inside the rep range, valid technique — highlighted by default),
  load, reps-at-load, and estimated 1RM. First sessions are baselines, not PRs.
- **Backup**: JSON export/import of all tables (validated with Zod, schema-version checked,
  merge-or-replace with explicit confirmation), plus `workouts.csv`, `sets.csv`, `body-weight.csv`
  via the Android share sheet.

### Seed data

Migration `002` seeds the **Gamma Upper** template (8 exercises, 2 sets each, references such as
Lat Pulldown 45 × 10) with technique cues for Lat Pulldown, Incline Press (ILIP) and Overhead
Triceps Extension. References prefill the first session.

## Tests

`npm test` runs Vitest:

- progression scenarios (10/10 → maintain, 11/10 → increase reps, 12/12 → +load, invalid
  technique / RIR 0 → no increase, other variants ignored, the full Gamma sequence)
- PR detection, body-weight smoothing/trend, backup validation, CSV escaping
- SQLite integration on an in-memory `node:sqlite` database: migrations from clean, foreign keys,
  session round trip, single active session, prefill after 12/12, variant isolation,
  summary/PRs, JSON export/import round trip, merge never overwriting, CSV export
- rest timer store

## Status against the V2 plan

Implemented: all screens and features in the plan's minimum V2 checklist, plus optional daily macro
totals (off by default, Settings → Body & nutrition).

Deviations / still to do on a device:

- Exercise reordering uses ▲/▼ buttons instead of drag-and-drop (large targets; no gesture
  dependencies). Order can be saved back to the template.
- UI flows are covered through service-level tests, not React Native Testing Library.
- Not yet verified on a physical phone: APK build via EAS, notification delivery while backgrounded,
  and a real gym session (plan phase 10).
- The icon and splash use the default Expo template artwork; replace the files in `assets/`.
