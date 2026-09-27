export const MUSCLE_GROUPS = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'fullBody',
  'other',
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const EXERCISE_CATEGORIES = ['compound', 'isolation', 'other'] as const;
export type ExerciseCategory = (typeof EXERCISE_CATEGORIES)[number];

export const EQUIPMENT_TYPES = [
  'machine',
  'cable',
  'dumbbell',
  'barbell',
  'smithMachine',
  'bodyweight',
  'kettlebell',
  'band',
  'other',
] as const;
export type EquipmentType = (typeof EQUIPMENT_TYPES)[number];

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  secondaryMuscles?: MuscleGroup[];
  category: ExerciseCategory;
  defaultRepRangeMin?: number;
  defaultRepRangeMax?: number;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExerciseVariant {
  id: string;
  exerciseId: string;
  label: string;
  equipmentType: EquipmentType;
  manufacturer?: string;
  machineModel?: string;
  attachment?: string;
  seatSetting?: string;
  techniqueProfileId?: string;
  notes?: string;
  /** Smallest sensible load jump for this variant (stack step, dumbbell pair, …). */
  weightIncrementKg: number;
  /** Starting reference used to prefill the very first session. */
  referenceWeightKg?: number;
  referenceReps?: number;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VariantWithExercise extends ExerciseVariant {
  exercise: Exercise;
}

export interface TechniqueProfile {
  id: string;
  name: string;
  /** Short bullet cues shown during the workout, one per line. */
  cues?: string;
  setupNotes?: string;
  concentricNotes?: string;
  eccentricNotes?: string;
  rangeOfMotionNotes?: string;
  tempoConcentric?: string;
  tempoEccentric?: string;
  stabilityNotes?: string;
  painWarnings?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  description?: string;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TargetPrescription {
  targetSets: number;
  targetRepMin: number;
  targetRepMax: number;
  targetRirMin?: number;
  targetRirMax?: number;
  restSeconds?: number;
}

export interface WorkoutTemplateExercise extends TargetPrescription {
  id: string;
  templateId: string;
  exerciseVariantId: string;
  orderIndex: number;
  notes?: string;
}

export interface WorkoutTemplateExerciseDetail extends WorkoutTemplateExercise {
  variant: VariantWithExercise;
}

export interface WorkoutTemplateDetail extends WorkoutTemplate {
  exercises: WorkoutTemplateExerciseDetail[];
}

export type WorkoutSessionStatus = 'active' | 'completed' | 'discarded';

export interface WorkoutSession {
  id: string;
  templateId?: string;
  name: string;
  startedAt: string;
  completedAt?: string;
  bodyWeightKg?: number;
  notes?: string;
  status: WorkoutSessionStatus;
}

export interface WorkoutSessionListItem extends WorkoutSession {
  exerciseCount: number;
  completedSetCount: number;
}

export interface WorkoutExerciseInstance extends TargetPrescription {
  id: string;
  sessionId: string;
  exerciseVariantId: string;
  orderIndex: number;
  notes?: string;
  /** JSON snapshot of the TechniqueProfile at the time the session was created. */
  techniqueProfileSnapshot?: string;
}

export type PainSeverity = 1 | 2 | 3 | 4 | 5;

export interface WorkoutSet {
  id: string;
  workoutExerciseInstanceId: string;
  setIndex: number;
  weightKg?: number;
  reps?: number;
  rir?: number;
  completed: boolean;
  techniqueValid: boolean;
  painFlag: boolean;
  painArea?: string;
  painSeverity?: PainSeverity;
  notes?: string;
  completedAt?: string;
}

export interface WorkoutExerciseDetail {
  instance: WorkoutExerciseInstance;
  variant: VariantWithExercise;
  sets: WorkoutSet[];
}

export interface WorkoutSessionDetail {
  session: WorkoutSession;
  exercises: WorkoutExerciseDetail[];
}

export const BODY_WEIGHT_CONTEXTS = ['morning', 'fasted', 'postToilet', 'other'] as const;
export type BodyWeightContext = (typeof BODY_WEIGHT_CONTEXTS)[number];

export interface BodyWeightEntry {
  id: string;
  recordedAt: string;
  weightKg: number;
  context?: BodyWeightContext;
  notes?: string;
}

export interface DailyMacroEntry {
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  calories?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  trainingDay: boolean;
}

/** A completed set as used by history, progression and PR logic. */
export interface PerformedSet {
  weightKg: number;
  reps: number;
  rir?: number;
  techniqueValid: boolean;
  painFlag?: boolean;
}

/** Everything performed for one exercise variant in one session. */
export interface ExercisePerformance {
  sessionId: string;
  instanceId: string;
  variantId: string;
  date: string;
  sets: PerformedSet[];
}

export interface ExerciseHistoryEntry extends ExercisePerformance {
  sessionName: string;
  instanceNotes?: string;
}
