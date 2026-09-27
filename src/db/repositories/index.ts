import type { Db } from '../database';
import { createBackupRepository } from './backupRepository';
import { createBodyWeightRepository } from './bodyWeightRepository';
import { createExerciseRepository } from './exerciseRepository';
import { createMacroRepository } from './macroRepository';
import { createSettingsRepository } from './settingsRepository';
import { createTemplateRepository } from './templateRepository';
import { createWorkoutRepository } from './workoutRepository';

export function createRepositories(db: Db) {
  return {
    exercises: createExerciseRepository(db),
    templates: createTemplateRepository(db),
    workouts: createWorkoutRepository(db),
    bodyWeight: createBodyWeightRepository(db),
    macros: createMacroRepository(db),
    settings: createSettingsRepository(db),
    backup: createBackupRepository(db),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
