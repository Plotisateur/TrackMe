import type {
  PainSeverity,
  TargetPrescription,
  WorkoutExerciseDetail,
  WorkoutSession,
  WorkoutSessionDetail,
  WorkoutSessionListItem,
  WorkoutSet,
} from '@/types/domain';
import { newId } from '@/utils/id';
import { nowIso } from '@/utils/date';
import { type Db, type SqlValue, v } from '../database';
import {
  type InstanceRow,
  type SessionRow,
  type SetRow,
  type VariantWithExerciseRow,
  mapInstance,
  mapSession,
  mapSet,
  mapVariantWithExercise,
  VARIANT_WITH_EXERCISE_COLUMNS,
} from './rows';

export class ActiveSessionExistsError extends Error {
  constructor(public readonly sessionId: string) {
    super('A workout is already in progress. Resume or finish it first.');
    this.name = 'ActiveSessionExistsError';
  }
}

export interface SetValues {
  weightKg?: number;
  reps?: number;
}

export interface NewInstanceInput {
  variantId: string;
  prescription: TargetPrescription;
  notes?: string;
  techniqueSnapshot?: string;
  sets: SetValues[];
}

export interface CreateWorkoutSessionInput {
  templateId?: string;
  name: string;
  bodyWeightKg?: number;
  exercises: NewInstanceInput[];
}

export type SetPatch = Partial<{
  weightKg: number | undefined;
  reps: number | undefined;
  rir: number | undefined;
  techniqueValid: boolean;
  painFlag: boolean;
  painArea: string | undefined;
  painSeverity: PainSeverity | undefined;
  notes: string | undefined;
}>;

const SET_COLUMNS: Record<keyof SetPatch, string> = {
  weightKg: 'weight_kg',
  reps: 'reps',
  rir: 'rir',
  techniqueValid: 'technique_valid',
  painFlag: 'pain_flag',
  painArea: 'pain_area',
  painSeverity: 'pain_severity',
  notes: 'notes',
};

export function createWorkoutRepository(db: Db) {
  async function insertInstance(sessionId: string, orderIndex: number, input: NewInstanceInput) {
    const id = newId();
    const p = input.prescription;
    await db.runAsync(
      `INSERT INTO workout_exercise_instances (id, session_id, exercise_variant_id, order_index, notes,
         technique_profile_snapshot, target_sets, target_rep_min, target_rep_max, target_rir_min,
         target_rir_max, rest_seconds)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      sessionId,
      input.variantId,
      orderIndex,
      v(input.notes),
      v(input.techniqueSnapshot),
      p.targetSets,
      p.targetRepMin,
      p.targetRepMax,
      v(p.targetRirMin),
      v(p.targetRirMax),
      v(p.restSeconds),
    );
    for (let i = 0; i < input.sets.length; i++) {
      await insertSet(id, i, input.sets[i]);
    }
    return id;
  }

  async function insertSet(instanceId: string, setIndex: number, values: SetValues) {
    const id = newId();
    await db.runAsync(
      `INSERT INTO workout_sets (id, workout_exercise_instance_id, set_index, weight_kg, reps,
         completed, technique_valid, pain_flag)
       VALUES (?, ?, ?, ?, ?, 0, 1, 0)`,
      id,
      instanceId,
      setIndex,
      v(values.weightKg),
      v(values.reps),
    );
    return id;
  }

  async function getSet(id: string): Promise<WorkoutSet | null> {
    const r = await db.getFirstAsync<SetRow>('SELECT * FROM workout_sets WHERE id = ?', id);
    return r ? mapSet(r) : null;
  }

  async function reindexSets(instanceId: string) {
    const rows = await db.getAllAsync<{ id: string }>(
      'SELECT id FROM workout_sets WHERE workout_exercise_instance_id = ? ORDER BY set_index',
      instanceId,
    );
    for (let i = 0; i < rows.length; i++) {
      await db.runAsync('UPDATE workout_sets SET set_index = ? WHERE id = ?', i, rows[i].id);
    }
  }

  const repo = {
    async createSession(input: CreateWorkoutSessionInput): Promise<WorkoutSession> {
      const active = await repo.getActiveSession();
      if (active) throw new ActiveSessionExistsError(active.id);
      const id = newId();
      await db.withTransactionAsync(async () => {
        await db.runAsync(
          `INSERT INTO workout_sessions (id, template_id, name, started_at, body_weight_kg, status)
           VALUES (?, ?, ?, ?, ?, 'active')`,
          id,
          v(input.templateId),
          input.name,
          nowIso(),
          v(input.bodyWeightKg),
        );
        for (let i = 0; i < input.exercises.length; i++) {
          await insertInstance(id, i, input.exercises[i]);
        }
      });
      return (await repo.getSessionRow(id))!;
    },

    async getSessionRow(id: string): Promise<WorkoutSession | null> {
      const r = await db.getFirstAsync<SessionRow>(
        'SELECT * FROM workout_sessions WHERE id = ?',
        id,
      );
      return r ? mapSession(r) : null;
    },

    async getActiveSession(): Promise<WorkoutSession | null> {
      const r = await db.getFirstAsync<SessionRow>(
        "SELECT * FROM workout_sessions WHERE status = 'active' ORDER BY started_at DESC LIMIT 1",
      );
      return r ? mapSession(r) : null;
    },

    async getSession(id: string): Promise<WorkoutSessionDetail | null> {
      const session = await repo.getSessionRow(id);
      if (!session) return null;
      const instRows = await db.getAllAsync<
        InstanceRow & VariantWithExerciseRow & { i_id: string; i_notes: string | null }
      >(
        `SELECT i.*, i.id AS i_id, i.notes AS i_notes, ${VARIANT_WITH_EXERCISE_COLUMNS}
         FROM workout_exercise_instances i
         JOIN exercise_variants v ON v.id = i.exercise_variant_id
         JOIN exercises e ON e.id = v.exercise_id
         WHERE i.session_id = ?
         ORDER BY i.order_index`,
        id,
      );
      const setRows = await db.getAllAsync<SetRow>(
        `SELECT ws.* FROM workout_sets ws
         JOIN workout_exercise_instances i ON i.id = ws.workout_exercise_instance_id
         WHERE i.session_id = ?
         ORDER BY ws.set_index`,
        id,
      );
      const sets = setRows.map(mapSet);
      const exercises: WorkoutExerciseDetail[] = instRows.map((r) => {
        const instance = mapInstance({ ...r, id: r.i_id, notes: r.i_notes });
        return {
          instance,
          variant: mapVariantWithExercise(r),
          sets: sets.filter((s) => s.workoutExerciseInstanceId === instance.id),
        };
      });
      return { session, exercises };
    },

    async listSessions(
      opts: {
        status?: WorkoutSession['status'];
        limit?: number;
        offset?: number;
        since?: string;
      } = {},
    ): Promise<WorkoutSessionListItem[]> {
      const rows = await db.getAllAsync<
        SessionRow & { exercise_count: number; completed_set_count: number }
      >(
        `SELECT s.*,
           (SELECT COUNT(*) FROM workout_exercise_instances i WHERE i.session_id = s.id) AS exercise_count,
           (SELECT COUNT(*) FROM workout_sets ws JOIN workout_exercise_instances i
              ON i.id = ws.workout_exercise_instance_id
            WHERE i.session_id = s.id AND ws.completed = 1) AS completed_set_count
         FROM workout_sessions s
         WHERE s.status = ? AND s.started_at >= ?
         ORDER BY s.started_at DESC
         LIMIT ? OFFSET ?`,
        opts.status ?? 'completed',
        opts.since ?? '',
        opts.limit ?? 200,
        opts.offset ?? 0,
      );
      return rows.map((r) => ({
        ...mapSession(r),
        exerciseCount: r.exercise_count,
        completedSetCount: r.completed_set_count,
      }));
    },

    async countCompletedSince(sinceIso: string): Promise<number> {
      const r = await db.getFirstAsync<{ n: number }>(
        "SELECT COUNT(*) AS n FROM workout_sessions WHERE status = 'completed' AND started_at >= ?",
        sinceIso,
      );
      return r?.n ?? 0;
    },

    /** Completed working sets per primary muscle group since a date. */
    async setsPerMuscleSince(sinceIso: string): Promise<{ muscleGroup: string; sets: number }[]> {
      const rows = await db.getAllAsync<{ muscle_group: string; sets: number }>(
        `SELECT e.muscle_group, COUNT(*) AS sets
         FROM workout_sets ws
         JOIN workout_exercise_instances i ON i.id = ws.workout_exercise_instance_id
         JOIN workout_sessions s ON s.id = i.session_id
         JOIN exercise_variants v ON v.id = i.exercise_variant_id
         JOIN exercises e ON e.id = v.exercise_id
         WHERE s.status = 'completed' AND ws.completed = 1 AND s.started_at >= ?
         GROUP BY e.muscle_group
         ORDER BY sets DESC`,
        sinceIso,
      );
      return rows.map((r) => ({ muscleGroup: r.muscle_group, sets: r.sets }));
    },

    /** Finalises a session. Placeholder sets that were never completed are removed. */
    async completeSession(id: string): Promise<void> {
      await db.withTransactionAsync(async () => {
        await db.runAsync(
          `DELETE FROM workout_sets WHERE completed = 0 AND workout_exercise_instance_id IN
             (SELECT id FROM workout_exercise_instances WHERE session_id = ?)`,
          id,
        );
        await db.runAsync(
          "UPDATE workout_sessions SET status = 'completed', completed_at = ? WHERE id = ?",
          nowIso(),
          id,
        );
      });
    },

    /** Abandons an active session. The row is kept (status 'discarded'), never silently lost. */
    async discardSession(id: string): Promise<void> {
      await db.runAsync(
        "UPDATE workout_sessions SET status = 'discarded', completed_at = ? WHERE id = ?",
        nowIso(),
        id,
      );
    },

    async deleteSession(id: string): Promise<void> {
      await db.runAsync('DELETE FROM workout_sessions WHERE id = ?', id);
    },

    async updateSession(
      id: string,
      patch: Partial<
        Pick<WorkoutSession, 'name' | 'notes' | 'bodyWeightKg' | 'startedAt' | 'completedAt'>
      >,
    ): Promise<void> {
      const cols: Record<string, string> = {
        name: 'name',
        notes: 'notes',
        bodyWeightKg: 'body_weight_kg',
        startedAt: 'started_at',
        completedAt: 'completed_at',
      };
      const sets: string[] = [];
      const params: SqlValue[] = [];
      for (const [k, val] of Object.entries(patch)) {
        if (!(k in cols)) continue;
        sets.push(`${cols[k]} = ?`);
        params.push(v(val as string | number | undefined));
      }
      if (sets.length === 0) return;
      await db.runAsync(
        `UPDATE workout_sessions SET ${sets.join(', ')} WHERE id = ?`,
        ...params,
        id,
      );
    },

    async addExercise(sessionId: string, input: NewInstanceInput): Promise<string> {
      const row = await db.getFirstAsync<{ n: number | null }>(
        'SELECT MAX(order_index) AS n FROM workout_exercise_instances WHERE session_id = ?',
        sessionId,
      );
      let id = '';
      await db.withTransactionAsync(async () => {
        id = await insertInstance(sessionId, (row?.n ?? -1) + 1, input);
      });
      return id;
    },

    async removeExercise(instanceId: string): Promise<void> {
      await db.runAsync('DELETE FROM workout_exercise_instances WHERE id = ?', instanceId);
    },

    async reorderExercises(sessionId: string, orderedInstanceIds: string[]): Promise<void> {
      await db.withTransactionAsync(async () => {
        for (let i = 0; i < orderedInstanceIds.length; i++) {
          await db.runAsync(
            'UPDATE workout_exercise_instances SET order_index = ? WHERE id = ? AND session_id = ?',
            i,
            orderedInstanceIds[i],
            sessionId,
          );
        }
      });
    },

    async updateInstance(
      instanceId: string,
      patch: Partial<{ notes: string | undefined; restSeconds: number | undefined }>,
    ): Promise<void> {
      if ('notes' in patch) {
        await db.runAsync(
          'UPDATE workout_exercise_instances SET notes = ? WHERE id = ?',
          v(patch.notes?.trim() || undefined),
          instanceId,
        );
      }
      if ('restSeconds' in patch) {
        await db.runAsync(
          'UPDATE workout_exercise_instances SET rest_seconds = ? WHERE id = ?',
          v(patch.restSeconds),
          instanceId,
        );
      }
    },

    async addSet(instanceId: string, values: SetValues = {}): Promise<WorkoutSet> {
      const row = await db.getFirstAsync<{ n: number | null }>(
        'SELECT MAX(set_index) AS n FROM workout_sets WHERE workout_exercise_instance_id = ?',
        instanceId,
      );
      const id = await insertSet(instanceId, (row?.n ?? -1) + 1, values);
      return (await getSet(id))!;
    },

    getSet,

    async updateSet(setId: string, patch: SetPatch): Promise<void> {
      const sets: string[] = [];
      const params: SqlValue[] = [];
      for (const key of Object.keys(patch) as (keyof SetPatch)[]) {
        sets.push(`${SET_COLUMNS[key]} = ?`);
        params.push(v(patch[key] as string | number | boolean | undefined));
      }
      if (sets.length === 0) return;
      await db.runAsync(
        `UPDATE workout_sets SET ${sets.join(', ')} WHERE id = ?`,
        ...params,
        setId,
      );
    },

    /** Marks a set done with its final values — persisted immediately. */
    async completeSet(setId: string, patch: SetPatch = {}): Promise<void> {
      await repo.updateSet(setId, patch);
      await db.runAsync(
        'UPDATE workout_sets SET completed = 1, completed_at = ? WHERE id = ?',
        nowIso(),
        setId,
      );
    },

    async uncompleteSet(setId: string): Promise<void> {
      await db.runAsync(
        'UPDATE workout_sets SET completed = 0, completed_at = NULL WHERE id = ?',
        setId,
      );
    },

    async deleteSet(setId: string): Promise<void> {
      const s = await getSet(setId);
      if (!s) return;
      await db.withTransactionAsync(async () => {
        await db.runAsync('DELETE FROM workout_sets WHERE id = ?', setId);
        await reindexSets(s.workoutExerciseInstanceId);
      });
    },
  };
  return repo;
}

export type WorkoutRepository = ReturnType<typeof createWorkoutRepository>;
