import type { EquipmentType, ExerciseCategory, MuscleGroup } from '@/types/domain';

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  abs: 'Abs',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  fullBody: 'Full body',
  other: 'Other',
};

export const EQUIPMENT_LABELS: Record<EquipmentType, string> = {
  machine: 'Machine',
  cable: 'Cable',
  dumbbell: 'Dumbbell',
  barbell: 'Barbell',
  smithMachine: 'Smith machine',
  bodyweight: 'Bodyweight',
  kettlebell: 'Kettlebell',
  band: 'Band',
  other: 'Other',
};

export const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  compound: 'Compound',
  isolation: 'Isolation',
  other: 'Other',
};
