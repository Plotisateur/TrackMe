import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { validateBackup } from '@/domain/backup/backupSchema';
import {
  buildSummary,
  loadInsights,
  startSessionFromTemplate,
} from '@/features/workout/workoutService';
import { createTestDb } from '@/testing/nodeSqliteDb';
import { DEFAULT_SETTINGS } from '@/types/settings';
import type { Db } from './database';
import { GAMMA_TEMPLATE_ID } from './migrations/002_seed_gamma';
import { LATEST_SCHEMA_VERSION, getSchemaVersion, migrate } from './migrations/runner';
import { createRepositories, type Repositories } from './repositories';
import { ActiveSessionExistsError } from './repositories/workoutRepository';

let db: Db & { close(): void };
let repos: Repositories;

beforeEach(async () => {
  db = createTestDb();
  await migrate(db);
  repos = createRepositories(db);
});

afterEach(() => db.close());

/** Starts the Gamma template and completes every prefilled set with the given reps. */
async function logGammaSession(reps: number[], opts: { techniqueValid?: boolean } = {}) {
  const session = await startSessionFromTemplate(repos, GAMMA_TEMPLATE_ID, DEFAULT_SETTINGS);
  const detail = (await repos.workouts.getSession(session.id))!;
  for (const ex of detail.exercises) {
    for (let i = 0; i < ex.sets.length; i++) {
      await repos.workouts.completeSet(ex.sets[i].id, {
        reps: reps[i] ?? reps[reps.length - 1],
        rir: 1,
        techniqueValid: opts.techniqueValid ?? true,
      });
    }
  }
  await repos.workouts.completeSession(session.id);
  return session.id;
}

describe('migrations', () => {
  it('execute from a clean database and store the schema version', async () => {
    expect(await getSchemaVersion(db)).toBe(LATEST_SCHEMA_VERSION);
    // Idempotent on relaunch.
    expect(await migrate(db)).toBe(LATEST_SCHEMA_VERSION);
    const tpl = await repos.templates.getTemplate(GAMMA_TEMPLATE_ID);
    expect(tpl?.exercises.map((e) => e.variant.exercise.name)).toEqual([
      'Lat Pulldown',
      'Horizontal Cable Row',
      'Incline Chest Press',
      'Pec Deck',
      'Shoulder Press',
      'Overhead Triceps Extension',
      'Preacher Curl',
      'Cable Crunch',
    ]);
    expect(tpl?.exercises[0].variant.label).toBe('Cable / Straight Bar');
  });

  it('enforces foreign keys', async () => {
    await expect(
      db.runAsync(
        `INSERT INTO workout_exercise_instances (id, session_id, exercise_variant_id, order_index,
           target_sets, target_rep_min, target_rep_max) VALUES ('x', 'missing', 'missing', 0, 2, 10, 12)`,
      ),
    ).rejects.toThrow(/FOREIGN KEY/i);
  });
});

describe('workout sessions', () => {
  it('round-trips a session with prefilled reference values and technique snapshot', async () => {
    const s = await startSessionFromTemplate(repos, GAMMA_TEMPLATE_ID, DEFAULT_SETTINGS);
    const detail = (await repos.workouts.getSession(s.id))!;
    expect(detail.session.status).toBe('active');
    expect(detail.exercises).toHaveLength(8);
    const lat = detail.exercises[0];
    expect(lat.sets.map((x) => [x.weightKg, x.reps])).toEqual([
      [45, 10],
      [45, 10],
    ]);
    expect(JSON.parse(lat.instance.techniqueProfileSnapshot!).cues).toMatch(
      /Elbows toward pockets/,
    );

    await repos.workouts.completeSet(lat.sets[0].id, { reps: 11, rir: 1 });
    const reloaded = (await repos.workouts.getSession(s.id))!;
    expect(reloaded.exercises[0].sets[0]).toMatchObject({ reps: 11, rir: 1, completed: true });
  });

  it('prevents duplicate active sessions', async () => {
    await startSessionFromTemplate(repos, GAMMA_TEMPLATE_ID, DEFAULT_SETTINGS);
    await expect(
      startSessionFromTemplate(repos, GAMMA_TEMPLATE_ID, DEFAULT_SETTINGS),
    ).rejects.toBeInstanceOf(ActiveSessionExistsError);
  });

  it('completing removes placeholder sets and previous performance appears next session', async () => {
    const first = await startSessionFromTemplate(repos, GAMMA_TEMPLATE_ID, DEFAULT_SETTINGS);
    const d = (await repos.workouts.getSession(first.id))!;
    await repos.workouts.completeSet(d.exercises[0].sets[0].id, { reps: 12, rir: 1 });
    await repos.workouts.completeSession(first.id);
    const done = (await repos.workouts.getSession(first.id))!;
    expect(done.session.status).toBe('completed');
    expect(done.exercises[0].sets).toHaveLength(1);
    expect(done.exercises[1].sets).toHaveLength(0);

    const second = await startSessionFromTemplate(repos, GAMMA_TEMPLATE_ID, DEFAULT_SETTINGS);
    const d2 = (await repos.workouts.getSession(second.id))!;
    const insights = await loadInsights(repos, d2, DEFAULT_SETTINGS);
    expect(insights[d2.exercises[0].instance.id].last?.sets[0]).toMatchObject({
      weightKg: 45,
      reps: 12,
    });
    expect(d2.exercises[0].sets[0]).toMatchObject({ weightKg: 45, reps: 12 });
  });

  it('suggests and prefills a load increase after 12/12', async () => {
    await logGammaSession([12, 12]);
    const next = await startSessionFromTemplate(repos, GAMMA_TEMPLATE_ID, DEFAULT_SETTINGS);
    const d = (await repos.workouts.getSession(next.id))!;
    // Lat pulldown: 45 → 50 (5 kg stack step), restart at 10 reps.
    expect(d.exercises[0].sets.map((s) => [s.weightKg, s.reps])).toEqual([
      [50, 10],
      [50, 10],
    ]);
  });

  it('keeps variants distinct in history', async () => {
    await logGammaSession([10, 10]);
    const technogym = await repos.exercises.getExerciseHistory('seed-var-lat-pulldown-technogym');
    const cable = await repos.exercises.getExerciseHistory('seed-var-lat-pulldown-cable-bar');
    expect(technogym).toHaveLength(0);
    expect(cable).toHaveLength(1);
  });

  it('builds a summary with PRs and next-session targets', async () => {
    await logGammaSession([10, 10]);
    const id = await logGammaSession([11, 10]);
    const report = (await buildSummary(repos, id, DEFAULT_SETTINGS))!;
    expect(report.summary.totalSets).toBe(16);
    expect(report.summary.totalReps).toBe(8 * 21);
    expect(
      report.records.some((r) => r.type === 'technical' && r.name.startsWith('Lat Pulldown')),
    ).toBe(true);
    const lat = report.next.find((n) => n.name.startsWith('Lat Pulldown'))!;
    expect(lat.suggestion).toMatchObject({ type: 'increase_reps', targetReps: 11 });
  });
});

describe('backup', () => {
  it('export/import round trip into a fresh database', async () => {
    await logGammaSession([10, 10]);
    await repos.bodyWeight.add({ weightKg: 93.2, context: 'morning' });
    const backup = JSON.parse(JSON.stringify(await repos.backup.exportAll()));
    const check = validateBackup(backup, LATEST_SCHEMA_VERSION);
    expect(check.ok).toBe(true);
    if (!check.ok) return;

    const other = createTestDb();
    await migrate(other);
    const otherRepos = createRepositories(other);
    await otherRepos.backup.importAll(check.backup, 'replace');
    const sessions = await otherRepos.workouts.listSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].completedSetCount).toBe(16);
    expect((await otherRepos.bodyWeight.latest())?.weightKg).toBe(93.2);
    other.close();
  });

  it('merge never overwrites existing rows', async () => {
    const backup = await repos.backup.exportAll();
    await repos.templates.updateTemplate(GAMMA_TEMPLATE_ID, { name: 'Renamed' });
    const res = await repos.backup.importAll(backup, 'merge');
    expect(res.inserted).toBe(0);
    expect((await repos.templates.getTemplate(GAMMA_TEMPLATE_ID))?.name).toBe('Renamed');
  });

  it('exports CSV files', async () => {
    await logGammaSession([10, 10]);
    const sets = await repos.backup.setsCsv();
    expect(sets.split('\r\n')[0]).toMatch(/^session_id,started_at/);
    expect(sets.trim().split('\r\n')).toHaveLength(17);
    expect(await repos.backup.workoutsCsv()).toMatch(/Gamma Upper/);
  });
});
