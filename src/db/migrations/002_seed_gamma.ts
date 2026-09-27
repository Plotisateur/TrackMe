import type { Migration } from './runner';

interface SeedVariant {
  id: string;
  label: string;
  equipment: string;
  manufacturer?: string;
  attachment?: string;
  increment: number;
  refWeight?: number;
  refReps?: number;
  technique?: {
    id: string;
    name: string;
    cues: string[];
    tempoEccentric?: string;
  };
}

interface SeedExercise {
  id: string;
  name: string;
  muscle: string;
  secondary?: string[];
  category: 'compound' | 'isolation';
  repMin: number;
  repMax: number;
  variants: SeedVariant[];
}

const EXERCISES: SeedExercise[] = [
  {
    id: 'seed-ex-lat-pulldown',
    name: 'Lat Pulldown',
    muscle: 'back',
    secondary: ['biceps'],
    category: 'compound',
    repMin: 10,
    repMax: 12,
    variants: [
      {
        id: 'seed-var-lat-pulldown-cable-bar',
        label: 'Cable / Straight Bar',
        equipment: 'cable',
        attachment: 'Straight bar',
        increment: 5,
        refWeight: 45,
        refReps: 10,
        technique: {
          id: 'seed-tech-lat-pulldown',
          name: 'Lat Pulldown — Gamma',
          cues: [
            'Elbows toward pockets',
            'Slight fixed torso lean',
            'No momentum',
            'Controlled eccentric',
          ],
        },
      },
      {
        id: 'seed-var-lat-pulldown-technogym',
        label: 'Technogym Machine',
        equipment: 'machine',
        manufacturer: 'Technogym',
        increment: 5,
      },
    ],
  },
  {
    id: 'seed-ex-horizontal-cable-row',
    name: 'Horizontal Cable Row',
    muscle: 'back',
    secondary: ['biceps'],
    category: 'compound',
    repMin: 10,
    repMax: 12,
    variants: [
      {
        id: 'seed-var-horizontal-cable-row',
        label: 'Cable',
        equipment: 'cable',
        increment: 5,
        refWeight: 50,
        refReps: 10,
      },
    ],
  },
  {
    id: 'seed-ex-incline-press',
    name: 'Incline Chest Press',
    muscle: 'chest',
    secondary: ['shoulders', 'triceps'],
    category: 'compound',
    repMin: 8,
    repMax: 12,
    variants: [
      {
        id: 'seed-var-incline-press-ilip',
        label: 'ILIP',
        equipment: 'machine',
        increment: 5,
        refWeight: 60,
        refReps: 10,
        technique: {
          id: 'seed-tech-incline-press',
          name: 'Incline Press — Gamma',
          cues: [
            'Chest elevated before movement',
            'Controlled 2–3 s eccentric',
            'Strong concentric intent',
            'Return close to starting depth without resting the stack',
          ],
          tempoEccentric: '2–3 s',
        },
      },
    ],
  },
  {
    id: 'seed-ex-pec-deck',
    name: 'Pec Deck',
    muscle: 'chest',
    category: 'isolation',
    repMin: 10,
    repMax: 15,
    variants: [
      {
        id: 'seed-var-pec-deck',
        label: 'Machine',
        equipment: 'machine',
        increment: 5,
        refWeight: 15,
        refReps: 10,
      },
    ],
  },
  {
    id: 'seed-ex-shoulder-press',
    name: 'Shoulder Press',
    muscle: 'shoulders',
    secondary: ['triceps'],
    category: 'compound',
    repMin: 8,
    repMax: 12,
    variants: [
      {
        id: 'seed-var-shoulder-press-technogym',
        label: 'Technogym',
        equipment: 'machine',
        manufacturer: 'Technogym',
        increment: 5,
        refWeight: 25,
        refReps: 10,
      },
      {
        id: 'seed-var-shoulder-press-dumbbells',
        label: 'Dumbbells',
        equipment: 'dumbbell',
        increment: 2,
      },
    ],
  },
  {
    id: 'seed-ex-overhead-triceps',
    name: 'Overhead Triceps Extension',
    muscle: 'triceps',
    category: 'isolation',
    repMin: 10,
    repMax: 12,
    variants: [
      {
        id: 'seed-var-overhead-triceps-rope',
        label: 'Cable Rope',
        equipment: 'cable',
        attachment: 'Rope',
        increment: 2.5,
        refWeight: 15,
        refReps: 10,
        technique: {
          id: 'seed-tech-overhead-triceps',
          name: 'Overhead Triceps Extension — Gamma',
          cues: [
            'Two steps forward',
            'Torso inclined forward',
            'Elbows stable near ears',
            'Natural minimal elbow movement allowed',
            'Full controlled extension',
          ],
        },
      },
    ],
  },
  {
    id: 'seed-ex-preacher-curl',
    name: 'Preacher Curl',
    muscle: 'biceps',
    category: 'isolation',
    repMin: 10,
    repMax: 15,
    variants: [
      {
        id: 'seed-var-preacher-curl-machine',
        label: 'Machine',
        equipment: 'machine',
        increment: 2.5,
        refWeight: 10,
        refReps: 10,
      },
    ],
  },
  {
    id: 'seed-ex-cable-crunch',
    name: 'Cable Crunch',
    muscle: 'abs',
    category: 'isolation',
    repMin: 10,
    repMax: 15,
    variants: [
      {
        id: 'seed-var-cable-crunch-rope',
        label: 'Cable Rope',
        equipment: 'cable',
        attachment: 'Rope',
        increment: 5,
        refWeight: 40,
        refReps: 10,
      },
    ],
  },
];

export const GAMMA_TEMPLATE_ID = 'seed-tpl-gamma-upper';

/** Order in the Gamma Upper template: [variant id, sets, repMin, repMax, rest seconds]. */
const TEMPLATE: [string, number, number, number, number][] = [
  ['seed-var-lat-pulldown-cable-bar', 2, 10, 12, 120],
  ['seed-var-horizontal-cable-row', 2, 10, 12, 120],
  ['seed-var-incline-press-ilip', 2, 8, 12, 120],
  ['seed-var-pec-deck', 2, 10, 15, 90],
  ['seed-var-shoulder-press-technogym', 2, 8, 12, 120],
  ['seed-var-overhead-triceps-rope', 2, 10, 12, 90],
  ['seed-var-preacher-curl-machine', 2, 10, 15, 90],
  ['seed-var-cable-crunch-rope', 2, 10, 15, 90],
];

export const m002SeedGamma: Migration = {
  version: 2,
  name: 'seed Gamma Upper template',
  async up(db) {
    const now = new Date().toISOString();
    for (const ex of EXERCISES) {
      await db.runAsync(
        `INSERT INTO exercises (id, name, muscle_group, secondary_muscles, category,
           default_rep_range_min, default_rep_range_max, archived, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        ex.id,
        ex.name,
        ex.muscle,
        ex.secondary ? JSON.stringify(ex.secondary) : null,
        ex.category,
        ex.repMin,
        ex.repMax,
        now,
        now,
      );
      for (const va of ex.variants) {
        if (va.technique) {
          await db.runAsync(
            `INSERT INTO technique_profiles (id, name, cues, tempo_eccentric, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            va.technique.id,
            va.technique.name,
            va.technique.cues.join('\n'),
            va.technique.tempoEccentric ?? null,
            now,
            now,
          );
        }
        await db.runAsync(
          `INSERT INTO exercise_variants (id, exercise_id, label, equipment_type, manufacturer,
             attachment, technique_profile_id, weight_increment_kg, reference_weight_kg,
             reference_reps, archived, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
          va.id,
          ex.id,
          va.label,
          va.equipment,
          va.manufacturer ?? null,
          va.attachment ?? null,
          va.technique?.id ?? null,
          va.increment,
          va.refWeight ?? null,
          va.refReps ?? null,
          now,
          now,
        );
      }
    }
    await db.runAsync(
      `INSERT INTO workout_templates (id, name, description, is_primary, created_at, updated_at)
       VALUES (?, ?, ?, 1, ?, ?)`,
      GAMMA_TEMPLATE_ID,
      'Gamma Upper',
      'Technique-focused upper session. Reorder freely to alternate muscle groups.',
      now,
      now,
    );
    for (let i = 0; i < TEMPLATE.length; i++) {
      const [variantId, sets, repMin, repMax, rest] = TEMPLATE[i];
      await db.runAsync(
        `INSERT INTO workout_template_exercises (id, template_id, exercise_variant_id, order_index,
           target_sets, target_rep_min, target_rep_max, target_rir_min, target_rir_max, rest_seconds)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, 2, ?)`,
        `seed-tpl-ex-${i + 1}`,
        GAMMA_TEMPLATE_ID,
        variantId,
        i,
        sets,
        repMin,
        repMax,
        rest,
      );
    }
  },
};
