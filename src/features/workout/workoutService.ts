import type { Repositories } from '@/db/repositories';
import type { NewInstanceInput } from '@/db/repositories/workoutRepository';
import {
  type ProgressionSuggestion,
  prefillSets,
  suggestProgression,
} from '@/domain/progression/progression';
import {
  type PersonalRecord,
  type RecordSet,
  computeRecords,
  detectSessionRecords,
} from '@/domain/records/records';
import {
  type PainWarning,
  type SessionSummary,
  exerciseDisplayName,
  exercisePerformance,
  painWarning,
  summarizeSession,
} from '@/domain/workout/summary';
import type {
  ExerciseHistoryEntry,
  ExercisePerformance,
  TargetPrescription,
  TechniqueProfile,
  VariantWithExercise,
  WorkoutExerciseDetail,
  WorkoutSession,
  WorkoutSessionDetail,
} from '@/types/domain';
import type { AppSettings } from '@/types/settings';
import { localDateKey } from '@/utils/date';

const HISTORY_DEPTH = 10;

export function defaultPrescription(
  variant: VariantWithExercise,
  settings: AppSettings,
): TargetPrescription {
  return {
    targetSets: 2,
    targetRepMin: variant.exercise.defaultRepRangeMin ?? 8,
    targetRepMax: variant.exercise.defaultRepRangeMax ?? 12,
    targetRirMin: 1,
    targetRirMax: 2,
    restSeconds: settings.defaultRestSeconds,
  };
}

export function suggestionFor(
  variant: VariantWithExercise,
  p: TargetPrescription,
  history: ExercisePerformance[],
  settings: AppSettings,
): ProgressionSuggestion | null {
  return suggestProgression({
    variantId: variant.id,
    history,
    target: { targetSets: p.targetSets, repMin: p.targetRepMin, repMax: p.targetRepMax },
    options: {
      weightIncrementKg: variant.weightIncrementKg,
      allowIncreaseAtFailure: settings.allowIncreaseAtFailure,
    },
  });
}

async function buildInstanceInput(
  repos: Repositories,
  variant: VariantWithExercise,
  prescription: TargetPrescription,
  settings: AppSettings,
  notes?: string,
): Promise<NewInstanceInput> {
  const history = await repos.exercises.getExerciseHistory(variant.id, { limit: HISTORY_DEPTH });
  const last = history.find((h) => h.sets.length > 0) ?? null;
  const suggestion = suggestionFor(variant, prescription, history, settings);
  const technique = variant.techniqueProfileId
    ? await repos.exercises.getTechniqueProfile(variant.techniqueProfileId)
    : null;
  return {
    variantId: variant.id,
    prescription,
    notes,
    techniqueSnapshot: technique ? JSON.stringify(technique) : undefined,
    sets: prefillSets(prescription.targetSets, last?.sets ?? null, suggestion, {
      weightKg: variant.referenceWeightKg,
      reps: variant.referenceReps,
    }),
  };
}

async function todaysBodyWeight(repos: Repositories): Promise<number | undefined> {
  const latest = await repos.bodyWeight.latest();
  if (!latest) return undefined;
  return localDateKey(latest.recordedAt) === localDateKey() ? latest.weightKg : undefined;
}

export async function startSessionFromTemplate(
  repos: Repositories,
  templateId: string,
  settings: AppSettings,
): Promise<WorkoutSession> {
  const tpl = await repos.templates.getTemplate(templateId);
  if (!tpl) throw new Error('Template not found');
  const exercises: NewInstanceInput[] = [];
  for (const te of tpl.exercises) {
    exercises.push(await buildInstanceInput(repos, te.variant, te, settings, undefined));
  }
  return repos.workouts.createSession({
    templateId: tpl.id,
    name: tpl.name,
    bodyWeightKg: await todaysBodyWeight(repos),
    exercises,
  });
}

export async function startEmptySession(repos: Repositories): Promise<WorkoutSession> {
  return repos.workouts.createSession({
    name: 'Workout',
    bodyWeightKg: await todaysBodyWeight(repos),
    exercises: [],
  });
}

export async function addExerciseToSession(
  repos: Repositories,
  sessionId: string,
  variantId: string,
  settings: AppSettings,
): Promise<void> {
  const variant = await repos.exercises.getVariant(variantId);
  if (!variant) throw new Error('Exercise variant not found');
  const input = await buildInstanceInput(
    repos,
    variant,
    defaultPrescription(variant, settings),
    settings,
  );
  await repos.workouts.addExercise(sessionId, input);
}

export interface ExerciseInsight {
  last: ExerciseHistoryEntry | null;
  bestTechnical?: RecordSet & { e1rm: number };
  suggestion: ProgressionSuggestion | null;
  painWarning: PainWarning | null;
  technique: TechniqueProfile | null;
}

/**
 * Per-exercise context shown on the workout card. History is scoped to the exact variant and
 * to sessions that started before this one, so it never shifts while you train.
 */
export async function loadInsights(
  repos: Repositories,
  detail: WorkoutSessionDetail,
  settings: AppSettings,
): Promise<Record<string, ExerciseInsight>> {
  const out: Record<string, ExerciseInsight> = {};
  const cache = new Map<string, ExerciseHistoryEntry[]>();
  for (const ex of detail.exercises) {
    let history = cache.get(ex.variant.id);
    if (!history) {
      history = await repos.exercises.getExerciseHistory(ex.variant.id, {
        limit: HISTORY_DEPTH,
        excludeSessionId: detail.session.id,
        before: detail.session.startedAt,
      });
      cache.set(ex.variant.id, history);
    }
    const range = { min: ex.instance.targetRepMin, max: ex.instance.targetRepMax };
    out[ex.instance.id] = {
      last: history.find((h) => h.sets.length > 0) ?? null,
      bestTechnical: computeRecords(history, ex.variant.id, range).technical,
      suggestion: suggestionFor(ex.variant, ex.instance, history, settings),
      painWarning: painWarning(history, ex.variant.id),
      technique: parseTechnique(ex),
    };
  }
  return out;
}

export function parseTechnique(ex: WorkoutExerciseDetail): TechniqueProfile | null {
  if (!ex.instance.techniqueProfileSnapshot) return null;
  try {
    return JSON.parse(ex.instance.techniqueProfileSnapshot) as TechniqueProfile;
  } catch {
    return null;
  }
}

export interface NamedRecord extends PersonalRecord {
  name: string;
}

export interface NextSessionTarget {
  instanceId: string;
  name: string;
  suggestion: ProgressionSuggestion;
}

export interface WorkoutSummaryReport {
  session: WorkoutSession;
  summary: SessionSummary;
  records: NamedRecord[];
  next: NextSessionTarget[];
}

export async function buildSummary(
  repos: Repositories,
  sessionId: string,
  settings: AppSettings,
): Promise<WorkoutSummaryReport | null> {
  const detail = await repos.workouts.getSession(sessionId);
  if (!detail) return null;
  const { session } = detail;
  const records: NamedRecord[] = [];
  const next: NextSessionTarget[] = [];
  for (const ex of detail.exercises) {
    const perf = exercisePerformance(session.id, session.startedAt, ex);
    if (perf.sets.length === 0) continue;
    const prior = await repos.exercises.getExerciseHistory(ex.variant.id, {
      limit: 200,
      excludeSessionId: session.id,
      before: session.startedAt,
    });
    const range = { min: ex.instance.targetRepMin, max: ex.instance.targetRepMax };
    for (const r of detectSessionRecords(perf, prior, range)) {
      records.push({ ...r, name: exerciseDisplayName(ex) });
    }
    const suggestion = suggestionFor(ex.variant, ex.instance, [perf], settings);
    if (suggestion)
      next.push({ instanceId: ex.instance.id, name: exerciseDisplayName(ex), suggestion });
  }
  return { session, summary: summarizeSession(detail), records, next };
}
