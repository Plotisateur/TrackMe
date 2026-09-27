import type {
  EquipmentType,
  Exercise,
  ExerciseCategory,
  ExerciseHistoryEntry,
  ExercisePerformance,
  ExerciseVariant,
  MuscleGroup,
  TechniqueProfile,
  VariantWithExercise,
} from '@/types/domain';
import { newId } from '@/utils/id';
import { nowIso } from '@/utils/date';
import { type Db, v } from '../database';
import {
  type ExerciseRow,
  type TechniqueRow,
  type VariantRow,
  type VariantWithExerciseRow,
  mapExercise,
  mapTechnique,
  mapVariant,
  mapVariantWithExercise,
  VARIANT_WITH_EXERCISE_COLUMNS,
} from './rows';

export interface ExerciseInput {
  name: string;
  muscleGroup: MuscleGroup;
  secondaryMuscles?: MuscleGroup[];
  category: ExerciseCategory;
  defaultRepRangeMin?: number;
  defaultRepRangeMax?: number;
}

export interface VariantInput {
  label: string;
  equipmentType: EquipmentType;
  manufacturer?: string;
  machineModel?: string;
  attachment?: string;
  seatSetting?: string;
  notes?: string;
  weightIncrementKg: number;
  referenceWeightKg?: number;
  referenceReps?: number;
}

export type TechniqueInput = Omit<TechniqueProfile, 'id' | 'createdAt' | 'updatedAt'>;

export interface ExerciseListItem extends Exercise {
  variants: ExerciseVariant[];
  lastPerformedAt?: string;
}

interface HistoryRow {
  session_id: string;
  session_name: string;
  started_at: string;
  instance_id: string;
  instance_notes: string | null;
  variant_id: string;
  weight_kg: number | null;
  reps: number | null;
  rir: number | null;
  technique_valid: number;
  pain_flag: number;
}

export function createExerciseRepository(db: Db) {
  async function getHistory(
    variantId: string,
    opts: { limit?: number; excludeSessionId?: string; before?: string } = {},
  ): Promise<ExerciseHistoryEntry[]> {
    const limit = opts.limit ?? 50;
    // Latest `limit` completed sessions containing this variant, then their completed sets.
    const rows = await db.getAllAsync<HistoryRow>(
      `WITH recent AS (
         SELECT i.id AS instance_id
         FROM workout_exercise_instances i
         JOIN workout_sessions s ON s.id = i.session_id
         WHERE i.exercise_variant_id = ? AND s.status = 'completed'
           AND s.id != ? AND s.started_at < ?
         ORDER BY s.started_at DESC
         LIMIT ?
       )
       SELECT s.id AS session_id, s.name AS session_name, s.started_at, i.id AS instance_id,
              i.notes AS instance_notes, i.exercise_variant_id AS variant_id,
              ws.weight_kg, ws.reps, ws.rir, ws.technique_valid, ws.pain_flag
       FROM recent r
       JOIN workout_exercise_instances i ON i.id = r.instance_id
       JOIN workout_sessions s ON s.id = i.session_id
       LEFT JOIN workout_sets ws ON ws.workout_exercise_instance_id = i.id
         AND ws.completed = 1 AND ws.reps > 0
       ORDER BY s.started_at DESC, i.order_index, ws.set_index`,
      variantId,
      opts.excludeSessionId ?? '',
      opts.before ?? '9999',
      limit,
    );
    const byInstance = new Map<string, ExerciseHistoryEntry>();
    for (const r of rows) {
      let entry = byInstance.get(r.instance_id);
      if (!entry) {
        entry = {
          sessionId: r.session_id,
          sessionName: r.session_name,
          instanceId: r.instance_id,
          instanceNotes: r.instance_notes ?? undefined,
          variantId: r.variant_id,
          date: r.started_at,
          sets: [],
        };
        byInstance.set(r.instance_id, entry);
      }
      if (r.reps !== null) {
        entry.sets.push({
          weightKg: r.weight_kg ?? 0,
          reps: r.reps,
          rir: r.rir ?? undefined,
          techniqueValid: r.technique_valid === 1,
          painFlag: r.pain_flag === 1,
        });
      }
    }
    return [...byInstance.values()];
  }

  const repo = {
    async listExercises(opts: { includeArchived?: boolean } = {}): Promise<ExerciseListItem[]> {
      const exRows = await db.getAllAsync<ExerciseRow>(
        `SELECT * FROM exercises ${opts.includeArchived ? '' : 'WHERE archived = 0'} ORDER BY name COLLATE NOCASE`,
      );
      const varRows = await db.getAllAsync<VariantRow>(
        `SELECT * FROM exercise_variants ${opts.includeArchived ? '' : 'WHERE archived = 0'} ORDER BY label COLLATE NOCASE`,
      );
      const lastRows = await db.getAllAsync<{ exercise_id: string; last: string }>(
        `SELECT v.exercise_id, MAX(s.started_at) AS last
         FROM workout_exercise_instances i
         JOIN workout_sessions s ON s.id = i.session_id AND s.status = 'completed'
         JOIN exercise_variants v ON v.id = i.exercise_variant_id
         GROUP BY v.exercise_id`,
      );
      const last = new Map(lastRows.map((r) => [r.exercise_id, r.last]));
      const variants = varRows.map(mapVariant);
      return exRows.map((r) => {
        const e = mapExercise(r);
        return {
          ...e,
          variants: variants.filter((va) => va.exerciseId === e.id),
          lastPerformedAt: last.get(e.id),
        };
      });
    },

    async getExercise(id: string): Promise<Exercise | null> {
      const r = await db.getFirstAsync<ExerciseRow>('SELECT * FROM exercises WHERE id = ?', id);
      return r ? mapExercise(r) : null;
    },

    async createExercise(input: ExerciseInput): Promise<Exercise> {
      const id = newId();
      const now = nowIso();
      await db.runAsync(
        `INSERT INTO exercises (id, name, muscle_group, secondary_muscles, category,
           default_rep_range_min, default_rep_range_max, archived, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        id,
        input.name.trim(),
        input.muscleGroup,
        input.secondaryMuscles?.length ? JSON.stringify(input.secondaryMuscles) : null,
        input.category,
        v(input.defaultRepRangeMin),
        v(input.defaultRepRangeMax),
        now,
        now,
      );
      return (await repo.getExercise(id))!;
    },

    async updateExercise(id: string, input: ExerciseInput): Promise<void> {
      await db.runAsync(
        `UPDATE exercises SET name = ?, muscle_group = ?, secondary_muscles = ?, category = ?,
           default_rep_range_min = ?, default_rep_range_max = ?, updated_at = ?
         WHERE id = ?`,
        input.name.trim(),
        input.muscleGroup,
        input.secondaryMuscles?.length ? JSON.stringify(input.secondaryMuscles) : null,
        input.category,
        v(input.defaultRepRangeMin),
        v(input.defaultRepRangeMax),
        nowIso(),
        id,
      );
    },

    /** Archiving hides an exercise from pickers; its history stays intact and visible. */
    async setExerciseArchived(id: string, archived: boolean): Promise<void> {
      await db.runAsync(
        'UPDATE exercises SET archived = ?, updated_at = ? WHERE id = ?',
        v(archived),
        nowIso(),
        id,
      );
    },

    async listVariants(exerciseId: string, opts: { includeArchived?: boolean } = {}) {
      const rows = await db.getAllAsync<VariantRow>(
        `SELECT * FROM exercise_variants WHERE exercise_id = ? ${opts.includeArchived ? '' : 'AND archived = 0'}
         ORDER BY label COLLATE NOCASE`,
        exerciseId,
      );
      return rows.map(mapVariant);
    },

    async listAllVariants(): Promise<VariantWithExercise[]> {
      const rows = await db.getAllAsync<VariantWithExerciseRow>(
        `SELECT ${VARIANT_WITH_EXERCISE_COLUMNS}
         FROM exercise_variants v JOIN exercises e ON e.id = v.exercise_id
         WHERE v.archived = 0 AND e.archived = 0
         ORDER BY e.name COLLATE NOCASE, v.label COLLATE NOCASE`,
      );
      return rows.map(mapVariantWithExercise);
    },

    async getVariant(id: string): Promise<VariantWithExercise | null> {
      const r = await db.getFirstAsync<VariantWithExerciseRow>(
        `SELECT ${VARIANT_WITH_EXERCISE_COLUMNS}
         FROM exercise_variants v JOIN exercises e ON e.id = v.exercise_id WHERE v.id = ?`,
        id,
      );
      return r ? mapVariantWithExercise(r) : null;
    },

    async createVariant(exerciseId: string, input: VariantInput): Promise<ExerciseVariant> {
      const id = newId();
      const now = nowIso();
      await db.runAsync(
        `INSERT INTO exercise_variants (id, exercise_id, label, equipment_type, manufacturer,
           machine_model, attachment, seat_setting, notes, weight_increment_kg,
           reference_weight_kg, reference_reps, archived, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        id,
        exerciseId,
        input.label.trim(),
        input.equipmentType,
        v(input.manufacturer),
        v(input.machineModel),
        v(input.attachment),
        v(input.seatSetting),
        v(input.notes),
        input.weightIncrementKg,
        v(input.referenceWeightKg),
        v(input.referenceReps),
        now,
        now,
      );
      return (await repo.getVariant(id))!;
    },

    async updateVariant(id: string, input: VariantInput): Promise<void> {
      await db.runAsync(
        `UPDATE exercise_variants SET label = ?, equipment_type = ?, manufacturer = ?,
           machine_model = ?, attachment = ?, seat_setting = ?, notes = ?, weight_increment_kg = ?,
           reference_weight_kg = ?, reference_reps = ?, updated_at = ?
         WHERE id = ?`,
        input.label.trim(),
        input.equipmentType,
        v(input.manufacturer),
        v(input.machineModel),
        v(input.attachment),
        v(input.seatSetting),
        v(input.notes),
        input.weightIncrementKg,
        v(input.referenceWeightKg),
        v(input.referenceReps),
        nowIso(),
        id,
      );
    },

    async setVariantArchived(id: string, archived: boolean): Promise<void> {
      await db.runAsync(
        'UPDATE exercise_variants SET archived = ?, updated_at = ? WHERE id = ?',
        v(archived),
        nowIso(),
        id,
      );
    },

    async getTechniqueProfile(id: string): Promise<TechniqueProfile | null> {
      const r = await db.getFirstAsync<TechniqueRow>(
        'SELECT * FROM technique_profiles WHERE id = ?',
        id,
      );
      return r ? mapTechnique(r) : null;
    },

    /** Creates or updates the technique profile attached to a variant. */
    async saveTechniqueProfile(
      variantId: string,
      input: TechniqueInput,
    ): Promise<TechniqueProfile> {
      const variant = await db.getFirstAsync<VariantRow>(
        'SELECT * FROM exercise_variants WHERE id = ?',
        variantId,
      );
      if (!variant) throw new Error('Variant not found');
      const now = nowIso();
      const fields = [
        input.name.trim() || 'Technique',
        v(input.cues?.trim()),
        v(input.setupNotes),
        v(input.concentricNotes),
        v(input.eccentricNotes),
        v(input.rangeOfMotionNotes),
        v(input.tempoConcentric),
        v(input.tempoEccentric),
        v(input.stabilityNotes),
        v(input.painWarnings),
      ];
      let id = variant.technique_profile_id;
      if (id) {
        await db.runAsync(
          `UPDATE technique_profiles SET name = ?, cues = ?, setup_notes = ?, concentric_notes = ?,
             eccentric_notes = ?, range_of_motion_notes = ?, tempo_concentric = ?,
             tempo_eccentric = ?, stability_notes = ?, pain_warnings = ?, updated_at = ?
           WHERE id = ?`,
          ...fields,
          now,
          id,
        );
      } else {
        id = newId();
        const newProfileId = id;
        await db.withTransactionAsync(async () => {
          await db.runAsync(
            `INSERT INTO technique_profiles (name, cues, setup_notes, concentric_notes,
               eccentric_notes, range_of_motion_notes, tempo_concentric, tempo_eccentric,
               stability_notes, pain_warnings, created_at, updated_at, id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ...fields,
            now,
            now,
            newProfileId,
          );
          await db.runAsync(
            'UPDATE exercise_variants SET technique_profile_id = ?, updated_at = ? WHERE id = ?',
            newProfileId,
            now,
            variantId,
          );
        });
      }
      return (await repo.getTechniqueProfile(id))!;
    },

    /** Completed-session history for exactly one variant, newest first. */
    getExerciseHistory: getHistory,

    async getLastPerformance(
      variantId: string,
      excludeSessionId?: string,
    ): Promise<ExercisePerformance | null> {
      const h = await getHistory(variantId, { limit: 5, excludeSessionId });
      return h.find((e) => e.sets.length > 0) ?? null;
    },
  };
  return repo;
}

export type ExerciseRepository = ReturnType<typeof createExerciseRepository>;
