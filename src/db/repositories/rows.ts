import type {
  BodyWeightContext,
  BodyWeightEntry,
  DailyMacroEntry,
  EquipmentType,
  Exercise,
  ExerciseCategory,
  ExerciseVariant,
  MuscleGroup,
  PainSeverity,
  TechniqueProfile,
  WorkoutExerciseInstance,
  WorkoutSession,
  WorkoutSessionStatus,
  WorkoutSet,
  WorkoutTemplate,
  WorkoutTemplateExercise,
} from '@/types/domain';
import { bool, opt } from '../database';

export interface ExerciseRow {
  id: string;
  name: string;
  muscle_group: string;
  secondary_muscles: string | null;
  category: string;
  default_rep_range_min: number | null;
  default_rep_range_max: number | null;
  archived: number;
  created_at: string;
  updated_at: string;
}

export const mapExercise = (r: ExerciseRow): Exercise => ({
  id: r.id,
  name: r.name,
  muscleGroup: r.muscle_group as MuscleGroup,
  secondaryMuscles: r.secondary_muscles
    ? (JSON.parse(r.secondary_muscles) as MuscleGroup[])
    : undefined,
  category: r.category as ExerciseCategory,
  defaultRepRangeMin: opt(r.default_rep_range_min),
  defaultRepRangeMax: opt(r.default_rep_range_max),
  archived: bool(r.archived),
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export interface VariantRow {
  id: string;
  exercise_id: string;
  label: string;
  equipment_type: string;
  manufacturer: string | null;
  machine_model: string | null;
  attachment: string | null;
  seat_setting: string | null;
  technique_profile_id: string | null;
  notes: string | null;
  weight_increment_kg: number;
  reference_weight_kg: number | null;
  reference_reps: number | null;
  archived: number;
  created_at: string;
  updated_at: string;
}

export const mapVariant = (r: VariantRow): ExerciseVariant => ({
  id: r.id,
  exerciseId: r.exercise_id,
  label: r.label,
  equipmentType: r.equipment_type as EquipmentType,
  manufacturer: opt(r.manufacturer),
  machineModel: opt(r.machine_model),
  attachment: opt(r.attachment),
  seatSetting: opt(r.seat_setting),
  techniqueProfileId: opt(r.technique_profile_id),
  notes: opt(r.notes),
  weightIncrementKg: r.weight_increment_kg,
  referenceWeightKg: opt(r.reference_weight_kg),
  referenceReps: opt(r.reference_reps),
  archived: bool(r.archived),
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

/** Columns of a variant joined with its exercise, exercise columns prefixed `ex_`. */
export const VARIANT_WITH_EXERCISE_COLUMNS = `
  v.*, e.id AS ex_id, e.name AS ex_name, e.muscle_group AS ex_muscle_group,
  e.secondary_muscles AS ex_secondary_muscles, e.category AS ex_category,
  e.default_rep_range_min AS ex_default_rep_range_min, e.default_rep_range_max AS ex_default_rep_range_max,
  e.archived AS ex_archived, e.created_at AS ex_created_at, e.updated_at AS ex_updated_at`;

export type VariantWithExerciseRow = VariantRow & {
  [K in keyof ExerciseRow as `ex_${K & string}`]: ExerciseRow[K];
};

export function mapVariantWithExercise(r: VariantWithExerciseRow) {
  return {
    ...mapVariant(r),
    exercise: mapExercise({
      id: r.ex_id,
      name: r.ex_name,
      muscle_group: r.ex_muscle_group,
      secondary_muscles: r.ex_secondary_muscles,
      category: r.ex_category,
      default_rep_range_min: r.ex_default_rep_range_min,
      default_rep_range_max: r.ex_default_rep_range_max,
      archived: r.ex_archived,
      created_at: r.ex_created_at,
      updated_at: r.ex_updated_at,
    }),
  };
}

export interface TechniqueRow {
  id: string;
  name: string;
  cues: string | null;
  setup_notes: string | null;
  concentric_notes: string | null;
  eccentric_notes: string | null;
  range_of_motion_notes: string | null;
  tempo_concentric: string | null;
  tempo_eccentric: string | null;
  stability_notes: string | null;
  pain_warnings: string | null;
  created_at: string;
  updated_at: string;
}

export const mapTechnique = (r: TechniqueRow): TechniqueProfile => ({
  id: r.id,
  name: r.name,
  cues: opt(r.cues),
  setupNotes: opt(r.setup_notes),
  concentricNotes: opt(r.concentric_notes),
  eccentricNotes: opt(r.eccentric_notes),
  rangeOfMotionNotes: opt(r.range_of_motion_notes),
  tempoConcentric: opt(r.tempo_concentric),
  tempoEccentric: opt(r.tempo_eccentric),
  stabilityNotes: opt(r.stability_notes),
  painWarnings: opt(r.pain_warnings),
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export interface TemplateRow {
  id: string;
  name: string;
  description: string | null;
  is_primary: number;
  created_at: string;
  updated_at: string;
}

export const mapTemplate = (r: TemplateRow): WorkoutTemplate => ({
  id: r.id,
  name: r.name,
  description: opt(r.description),
  isPrimary: bool(r.is_primary),
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

interface PrescriptionRow {
  target_sets: number;
  target_rep_min: number;
  target_rep_max: number;
  target_rir_min: number | null;
  target_rir_max: number | null;
  rest_seconds: number | null;
}

const mapPrescription = (r: PrescriptionRow) => ({
  targetSets: r.target_sets,
  targetRepMin: r.target_rep_min,
  targetRepMax: r.target_rep_max,
  targetRirMin: opt(r.target_rir_min),
  targetRirMax: opt(r.target_rir_max),
  restSeconds: opt(r.rest_seconds),
});

export interface TemplateExerciseRow extends PrescriptionRow {
  id: string;
  template_id: string;
  exercise_variant_id: string;
  order_index: number;
  notes: string | null;
}

export const mapTemplateExercise = (r: TemplateExerciseRow): WorkoutTemplateExercise => ({
  id: r.id,
  templateId: r.template_id,
  exerciseVariantId: r.exercise_variant_id,
  orderIndex: r.order_index,
  notes: opt(r.notes),
  ...mapPrescription(r),
});

export interface SessionRow {
  id: string;
  template_id: string | null;
  name: string;
  started_at: string;
  completed_at: string | null;
  body_weight_kg: number | null;
  notes: string | null;
  status: string;
}

export const mapSession = (r: SessionRow): WorkoutSession => ({
  id: r.id,
  templateId: opt(r.template_id),
  name: r.name,
  startedAt: r.started_at,
  completedAt: opt(r.completed_at),
  bodyWeightKg: opt(r.body_weight_kg),
  notes: opt(r.notes),
  status: r.status as WorkoutSessionStatus,
});

export interface InstanceRow extends PrescriptionRow {
  id: string;
  session_id: string;
  exercise_variant_id: string;
  order_index: number;
  notes: string | null;
  technique_profile_snapshot: string | null;
}

export const mapInstance = (r: InstanceRow): WorkoutExerciseInstance => ({
  id: r.id,
  sessionId: r.session_id,
  exerciseVariantId: r.exercise_variant_id,
  orderIndex: r.order_index,
  notes: opt(r.notes),
  techniqueProfileSnapshot: opt(r.technique_profile_snapshot),
  ...mapPrescription(r),
});

export interface SetRow {
  id: string;
  workout_exercise_instance_id: string;
  set_index: number;
  weight_kg: number | null;
  reps: number | null;
  rir: number | null;
  completed: number;
  technique_valid: number;
  pain_flag: number;
  pain_area: string | null;
  pain_severity: number | null;
  notes: string | null;
  completed_at: string | null;
}

export const mapSet = (r: SetRow): WorkoutSet => ({
  id: r.id,
  workoutExerciseInstanceId: r.workout_exercise_instance_id,
  setIndex: r.set_index,
  weightKg: opt(r.weight_kg),
  reps: opt(r.reps),
  rir: opt(r.rir),
  completed: bool(r.completed),
  techniqueValid: bool(r.technique_valid),
  painFlag: bool(r.pain_flag),
  painArea: opt(r.pain_area),
  painSeverity: opt(r.pain_severity) as PainSeverity | undefined,
  notes: opt(r.notes),
  completedAt: opt(r.completed_at),
});

export interface BodyWeightRow {
  id: string;
  recorded_at: string;
  weight_kg: number;
  context: string | null;
  notes: string | null;
}

export const mapBodyWeight = (r: BodyWeightRow): BodyWeightEntry => ({
  id: r.id,
  recordedAt: r.recorded_at,
  weightKg: r.weight_kg,
  context: opt(r.context) as BodyWeightContext | undefined,
  notes: opt(r.notes),
});

export interface MacroRow {
  date: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  training_day: number;
}

export const mapMacro = (r: MacroRow): DailyMacroEntry => ({
  date: r.date,
  calories: opt(r.calories),
  proteinG: opt(r.protein_g),
  carbsG: opt(r.carbs_g),
  fatG: opt(r.fat_g),
  trainingDay: bool(r.training_day),
});
