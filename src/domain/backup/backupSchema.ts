import { z } from 'zod';

export const BACKUP_FORMAT = 'gamma-tracker-backup';

/** Tables in foreign-key dependency order (parents first). */
export const BACKUP_TABLES = [
  'exercises',
  'technique_profiles',
  'exercise_variants',
  'workout_templates',
  'workout_template_exercises',
  'workout_sessions',
  'workout_exercise_instances',
  'workout_sets',
  'body_weight_entries',
  'daily_macro_entries',
  'app_settings',
] as const;
export type BackupTable = (typeof BACKUP_TABLES)[number];

export const PRIMARY_KEYS: Record<BackupTable, string> = {
  exercises: 'id',
  technique_profiles: 'id',
  exercise_variants: 'id',
  workout_templates: 'id',
  workout_template_exercises: 'id',
  workout_sessions: 'id',
  workout_exercise_instances: 'id',
  workout_sets: 'id',
  body_weight_entries: 'id',
  daily_macro_entries: 'date',
  app_settings: 'key',
};

const cell = z.union([z.string(), z.number(), z.null()]);
const row = z.record(z.string(), cell);

const tableShape = Object.fromEntries(
  BACKUP_TABLES.map((t) => [
    t,
    z.array(
      row.refine(
        (r) => typeof r[PRIMARY_KEYS[t]] === 'string',
        `each ${t} row needs a ${PRIMARY_KEYS[t]}`,
      ),
    ),
  ]),
) as unknown as Record<BackupTable, z.ZodArray<z.ZodType<Record<string, string | number | null>>>>;

export const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  schemaVersion: z.number().int().positive(),
  exportedAt: z.string(),
  data: z.object(tableShape),
});

export type Backup = z.infer<typeof backupSchema>;

export type BackupValidation =
  { ok: true; backup: Backup; counts: Record<BackupTable, number> } | { ok: false; error: string };

/** Validates structure and schema version of a parsed backup file. */
export function validateBackup(raw: unknown, currentSchemaVersion: number): BackupValidation {
  const parsed = backupSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: `Not a valid Gamma Tracker backup (${issue.path.join('.') || 'root'}: ${issue.message})`,
    };
  }
  if (parsed.data.schemaVersion > currentSchemaVersion) {
    return {
      ok: false,
      error: `Backup was made by a newer app version (schema ${parsed.data.schemaVersion}, this app supports ${currentSchemaVersion}). Update the app first.`,
    };
  }
  const counts = Object.fromEntries(
    BACKUP_TABLES.map((t) => [t, parsed.data.data[t].length]),
  ) as Record<BackupTable, number>;
  return { ok: true, backup: parsed.data, counts };
}
