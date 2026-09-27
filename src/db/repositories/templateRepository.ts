import type { TargetPrescription, WorkoutTemplate, WorkoutTemplateDetail } from '@/types/domain';
import { newId } from '@/utils/id';
import { nowIso } from '@/utils/date';
import { type Db, v } from '../database';
import {
  type TemplateExerciseRow,
  type TemplateRow,
  type VariantWithExerciseRow,
  mapTemplate,
  mapTemplateExercise,
  mapVariantWithExercise,
  VARIANT_WITH_EXERCISE_COLUMNS,
} from './rows';

export interface TemplateExerciseInput extends TargetPrescription {
  notes?: string;
}

export function createTemplateRepository(db: Db) {
  const repo = {
    async listTemplates(): Promise<(WorkoutTemplate & { exerciseCount: number })[]> {
      const rows = await db.getAllAsync<TemplateRow & { exercise_count: number }>(
        `SELECT t.*, (SELECT COUNT(*) FROM workout_template_exercises te WHERE te.template_id = t.id) AS exercise_count
         FROM workout_templates t ORDER BY t.is_primary DESC, t.name COLLATE NOCASE`,
      );
      return rows.map((r) => ({ ...mapTemplate(r), exerciseCount: r.exercise_count }));
    },

    async getTemplate(id: string): Promise<WorkoutTemplateDetail | null> {
      const t = await db.getFirstAsync<TemplateRow>(
        'SELECT * FROM workout_templates WHERE id = ?',
        id,
      );
      if (!t) return null;
      const rows = await db.getAllAsync<
        TemplateExerciseRow & VariantWithExerciseRow & { te_id: string; te_notes: string | null }
      >(
        `SELECT te.*, te.id AS te_id, te.notes AS te_notes, ${VARIANT_WITH_EXERCISE_COLUMNS}
         FROM workout_template_exercises te
         JOIN exercise_variants v ON v.id = te.exercise_variant_id
         JOIN exercises e ON e.id = v.exercise_id
         WHERE te.template_id = ?
         ORDER BY te.order_index`,
        id,
      );
      return {
        ...mapTemplate(t),
        exercises: rows.map((r) => ({
          ...mapTemplateExercise({ ...r, id: r.te_id, notes: r.te_notes }),
          variant: mapVariantWithExercise(r),
        })),
      };
    },

    async createTemplate(name: string, description?: string): Promise<WorkoutTemplate> {
      const id = newId();
      const now = nowIso();
      await db.runAsync(
        `INSERT INTO workout_templates (id, name, description, is_primary, created_at, updated_at)
         VALUES (?, ?, ?, 0, ?, ?)`,
        id,
        name.trim(),
        v(description),
        now,
        now,
      );
      return (await repo.getTemplate(id))!;
    },

    async updateTemplate(
      id: string,
      patch: { name?: string; description?: string },
    ): Promise<void> {
      const cur = await db.getFirstAsync<TemplateRow>(
        'SELECT * FROM workout_templates WHERE id = ?',
        id,
      );
      if (!cur) throw new Error('Template not found');
      await db.runAsync(
        'UPDATE workout_templates SET name = ?, description = ?, updated_at = ? WHERE id = ?',
        (patch.name ?? cur.name).trim(),
        patch.description !== undefined ? v(patch.description) : cur.description,
        nowIso(),
        id,
      );
    },

    async setPrimary(id: string): Promise<void> {
      await db.withTransactionAsync(async () => {
        await db.runAsync('UPDATE workout_templates SET is_primary = 0');
        await db.runAsync('UPDATE workout_templates SET is_primary = 1 WHERE id = ?', id);
      });
    },

    async duplicateTemplate(id: string): Promise<WorkoutTemplate> {
      const src = await repo.getTemplate(id);
      if (!src) throw new Error('Template not found');
      const newTplId = newId();
      const now = nowIso();
      await db.withTransactionAsync(async () => {
        await db.runAsync(
          `INSERT INTO workout_templates (id, name, description, is_primary, created_at, updated_at)
           VALUES (?, ?, ?, 0, ?, ?)`,
          newTplId,
          `${src.name} (copy)`,
          v(src.description),
          now,
          now,
        );
        for (const te of src.exercises) {
          await db.runAsync(
            `INSERT INTO workout_template_exercises (id, template_id, exercise_variant_id, order_index,
               target_sets, target_rep_min, target_rep_max, target_rir_min, target_rir_max, rest_seconds, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            newId(),
            newTplId,
            te.exerciseVariantId,
            te.orderIndex,
            te.targetSets,
            te.targetRepMin,
            te.targetRepMax,
            v(te.targetRirMin),
            v(te.targetRirMax),
            v(te.restSeconds),
            v(te.notes),
          );
        }
      });
      return (await repo.getTemplate(newTplId))!;
    },

    /** Deletes a template. Past sessions keep their data; their template link is cleared. */
    async deleteTemplate(id: string): Promise<void> {
      await db.runAsync('DELETE FROM workout_templates WHERE id = ?', id);
    },

    async addExercise(
      templateId: string,
      variantId: string,
      input: TemplateExerciseInput,
    ): Promise<void> {
      const row = await db.getFirstAsync<{ n: number | null }>(
        'SELECT MAX(order_index) AS n FROM workout_template_exercises WHERE template_id = ?',
        templateId,
      );
      await db.runAsync(
        `INSERT INTO workout_template_exercises (id, template_id, exercise_variant_id, order_index,
           target_sets, target_rep_min, target_rep_max, target_rir_min, target_rir_max, rest_seconds, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        newId(),
        templateId,
        variantId,
        (row?.n ?? -1) + 1,
        input.targetSets,
        input.targetRepMin,
        input.targetRepMax,
        v(input.targetRirMin),
        v(input.targetRirMax),
        v(input.restSeconds),
        v(input.notes),
      );
      await touch(templateId);
    },

    async updateExercise(templateExerciseId: string, input: TemplateExerciseInput): Promise<void> {
      await db.runAsync(
        `UPDATE workout_template_exercises SET target_sets = ?, target_rep_min = ?, target_rep_max = ?,
           target_rir_min = ?, target_rir_max = ?, rest_seconds = ?, notes = ?
         WHERE id = ?`,
        input.targetSets,
        input.targetRepMin,
        input.targetRepMax,
        v(input.targetRirMin),
        v(input.targetRirMax),
        v(input.restSeconds),
        v(input.notes),
        templateExerciseId,
      );
    },

    async removeExercise(templateExerciseId: string): Promise<void> {
      await db.runAsync('DELETE FROM workout_template_exercises WHERE id = ?', templateExerciseId);
    },

    /** Rewrites order_index so it follows `orderedIds`. */
    async reorderExercises(templateId: string, orderedIds: string[]): Promise<void> {
      await db.withTransactionAsync(async () => {
        for (let i = 0; i < orderedIds.length; i++) {
          await db.runAsync(
            'UPDATE workout_template_exercises SET order_index = ? WHERE id = ? AND template_id = ?',
            i,
            orderedIds[i],
            templateId,
          );
        }
      });
      await touch(templateId);
    },

    /** Orders the template's exercises to follow a list of variant ids (used by "save order"). */
    async reorderByVariants(templateId: string, variantIds: string[]): Promise<void> {
      const tpl = await repo.getTemplate(templateId);
      if (!tpl) return;
      const rank = (variantId: string) => {
        const i = variantIds.indexOf(variantId);
        return i === -1 ? Number.MAX_SAFE_INTEGER : i;
      };
      const ordered = [...tpl.exercises]
        .sort(
          (a, b) =>
            rank(a.exerciseVariantId) - rank(b.exerciseVariantId) || a.orderIndex - b.orderIndex,
        )
        .map((e) => e.id);
      await repo.reorderExercises(templateId, ordered);
    },
  };

  async function touch(templateId: string) {
    await db.runAsync(
      'UPDATE workout_templates SET updated_at = ? WHERE id = ?',
      nowIso(),
      templateId,
    );
  }

  return repo;
}

export type TemplateRepository = ReturnType<typeof createTemplateRepository>;
