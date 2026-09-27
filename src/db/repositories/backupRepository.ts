import {
  BACKUP_FORMAT,
  BACKUP_TABLES,
  type Backup,
  type BackupTable,
  PRIMARY_KEYS,
} from '@/domain/backup/backupSchema';
import { toCsv } from '@/domain/backup/csv';
import type { Db, SqlValue } from '../database';
import { m002SeedGamma } from '../migrations/002_seed_gamma';
import { getSchemaVersion } from '../migrations/runner';

export type ImportMode = 'merge' | 'replace';

export interface ImportResult {
  inserted: number;
  skipped: number;
}

export function createBackupRepository(db: Db) {
  async function columnsOf(table: BackupTable): Promise<Set<string>> {
    const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
    return new Set(rows.map((r) => r.name));
  }

  return {
    async exportAll(): Promise<Backup> {
      const data = {} as Backup['data'];
      for (const t of BACKUP_TABLES) {
        data[t] = await db.getAllAsync<Record<string, SqlValue>>(`SELECT * FROM ${t}`);
      }
      return {
        format: BACKUP_FORMAT,
        schemaVersion: await getSchemaVersion(db),
        exportedAt: new Date().toISOString(),
        data,
      };
    },

    /**
     * merge: keeps every existing row and only adds rows whose key is new.
     * replace: wipes all data first. Callers must confirm with the user before using it.
     */
    async importAll(backup: Backup, mode: ImportMode): Promise<ImportResult> {
      const result: ImportResult = { inserted: 0, skipped: 0 };
      const columns = new Map<BackupTable, Set<string>>();
      for (const t of BACKUP_TABLES) columns.set(t, await columnsOf(t));

      await db.withTransactionAsync(async () => {
        if (mode === 'replace') {
          for (const t of [...BACKUP_TABLES].reverse()) await db.runAsync(`DELETE FROM ${t}`);
        }
        for (const t of BACKUP_TABLES) {
          const allowed = columns.get(t)!;
          for (const row of backup.data[t]) {
            const keys = Object.keys(row).filter((k) => allowed.has(k));
            if (!keys.includes(PRIMARY_KEYS[t])) continue;
            // An imported active session must not collide with one already in progress.
            if (t === 'workout_sessions' && row.status === 'active') {
              const active = await db.getFirstAsync<{ id: string }>(
                "SELECT id FROM workout_sessions WHERE status = 'active' AND id != ?",
                row.id as string,
              );
              if (active) row.status = 'discarded';
            }
            const res = await db.runAsync(
              `INSERT OR IGNORE INTO ${t} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
              ...keys.map((k) => row[k]),
            );
            if (res.changes > 0) result.inserted++;
            else result.skipped++;
          }
        }
      });
      return result;
    },

    /** Deletes every row and restores the default Gamma exercises and template. */
    async resetAll(): Promise<void> {
      await db.withTransactionAsync(async () => {
        for (const t of [...BACKUP_TABLES].reverse()) await db.runAsync(`DELETE FROM ${t}`);
        await m002SeedGamma.up(db);
      });
    },

    async workoutsCsv(): Promise<string> {
      const rows = await db.getAllAsync<{
        id: string;
        started_at: string;
        completed_at: string | null;
        name: string;
        template_name: string | null;
        body_weight_kg: number | null;
        notes: string | null;
        exercises: number;
        sets: number;
        reps: number | null;
        volume: number | null;
      }>(
        `SELECT s.id, s.started_at, s.completed_at, s.name, t.name AS template_name, s.body_weight_kg, s.notes,
           (SELECT COUNT(*) FROM workout_exercise_instances i WHERE i.session_id = s.id) AS exercises,
           (SELECT COUNT(*) FROM workout_sets ws JOIN workout_exercise_instances i ON i.id = ws.workout_exercise_instance_id
              WHERE i.session_id = s.id AND ws.completed = 1) AS sets,
           (SELECT SUM(ws.reps) FROM workout_sets ws JOIN workout_exercise_instances i ON i.id = ws.workout_exercise_instance_id
              WHERE i.session_id = s.id AND ws.completed = 1) AS reps,
           (SELECT SUM(ws.reps * ws.weight_kg) FROM workout_sets ws JOIN workout_exercise_instances i ON i.id = ws.workout_exercise_instance_id
              WHERE i.session_id = s.id AND ws.completed = 1) AS volume
         FROM workout_sessions s LEFT JOIN workout_templates t ON t.id = s.template_id
         WHERE s.status = 'completed'
         ORDER BY s.started_at`,
      );
      return toCsv(
        [
          'session_id',
          'started_at',
          'completed_at',
          'duration_min',
          'name',
          'template',
          'exercises',
          'sets',
          'reps',
          'volume_kg',
          'body_weight_kg',
          'notes',
        ],
        rows.map((r) => [
          r.id,
          r.started_at,
          r.completed_at,
          r.completed_at
            ? Math.round((Date.parse(r.completed_at) - Date.parse(r.started_at)) / 60000)
            : null,
          r.name,
          r.template_name,
          r.exercises,
          r.sets,
          r.reps ?? 0,
          r.volume ?? 0,
          r.body_weight_kg,
          r.notes,
        ]),
      );
    },

    async setsCsv(): Promise<string> {
      const rows = await db.getAllAsync<Record<string, SqlValue>>(
        `SELECT s.id AS session_id, s.started_at, s.name AS session, e.name AS exercise, v.label AS variant,
           v.equipment_type AS equipment, ws.set_index + 1 AS set_number, ws.weight_kg, ws.reps, ws.rir,
           ws.technique_valid, ws.pain_flag, ws.pain_area, ws.pain_severity, ws.notes, ws.completed_at
         FROM workout_sets ws
         JOIN workout_exercise_instances i ON i.id = ws.workout_exercise_instance_id
         JOIN workout_sessions s ON s.id = i.session_id
         JOIN exercise_variants v ON v.id = i.exercise_variant_id
         JOIN exercises e ON e.id = v.exercise_id
         WHERE s.status = 'completed' AND ws.completed = 1
         ORDER BY s.started_at, i.order_index, ws.set_index`,
      );
      const header = [
        'session_id',
        'started_at',
        'session',
        'exercise',
        'variant',
        'equipment',
        'set_number',
        'weight_kg',
        'reps',
        'rir',
        'technique_valid',
        'pain_flag',
        'pain_area',
        'pain_severity',
        'notes',
        'completed_at',
      ];
      return toCsv(
        header,
        rows.map((r) => header.map((h) => r[h])),
      );
    },

    async bodyWeightCsv(): Promise<string> {
      const rows = await db.getAllAsync<Record<string, SqlValue>>(
        'SELECT recorded_at, weight_kg, context, notes FROM body_weight_entries ORDER BY recorded_at',
      );
      const header = ['recorded_at', 'weight_kg', 'context', 'notes'];
      return toCsv(
        header,
        rows.map((r) => header.map((h) => r[h])),
      );
    },
  };
}

export type BackupRepository = ReturnType<typeof createBackupRepository>;
