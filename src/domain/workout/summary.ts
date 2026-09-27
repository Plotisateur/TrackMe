import type {
  ExercisePerformance,
  PerformedSet,
  WorkoutExerciseDetail,
  WorkoutSessionDetail,
  WorkoutSet,
} from '@/types/domain';
import { setVolume } from '@/domain/records/records';

export function isPerformed(s: WorkoutSet): boolean {
  return s.completed && (s.reps ?? 0) > 0;
}

export function toPerformedSet(s: WorkoutSet): PerformedSet {
  return {
    weightKg: s.weightKg ?? 0,
    reps: s.reps ?? 0,
    rir: s.rir,
    techniqueValid: s.techniqueValid,
    painFlag: s.painFlag,
  };
}

export function exercisePerformance(
  sessionId: string,
  date: string,
  ex: WorkoutExerciseDetail,
): ExercisePerformance {
  return {
    sessionId,
    instanceId: ex.instance.id,
    variantId: ex.variant.id,
    date,
    sets: ex.sets.filter(isPerformed).map(toPerformedSet),
  };
}

export interface ExerciseFlag {
  instanceId: string;
  name: string;
  count: number;
  detail?: string;
}

export interface SessionSummary {
  durationMs: number;
  exercisesCompleted: number;
  exercisesTotal: number;
  totalSets: number;
  totalReps: number;
  volumeKg: number;
  techniqueInvalid: ExerciseFlag[];
  painFlags: ExerciseFlag[];
  bodyWeightKg?: number;
}

export function exerciseDisplayName(ex: WorkoutExerciseDetail): string {
  return `${ex.variant.exercise.name} — ${ex.variant.label}`;
}

export function summarizeSession(detail: WorkoutSessionDetail, now = new Date()): SessionSummary {
  const { session, exercises } = detail;
  const end = session.completedAt ? new Date(session.completedAt) : now;
  const summary: SessionSummary = {
    durationMs: Math.max(0, end.getTime() - new Date(session.startedAt).getTime()),
    exercisesCompleted: 0,
    exercisesTotal: exercises.length,
    totalSets: 0,
    totalReps: 0,
    volumeKg: 0,
    techniqueInvalid: [],
    painFlags: [],
    bodyWeightKg: session.bodyWeightKg,
  };
  for (const ex of exercises) {
    const done = ex.sets.filter(isPerformed);
    if (done.length > 0) summary.exercisesCompleted++;
    summary.totalSets += done.length;
    for (const s of done) {
      summary.totalReps += s.reps ?? 0;
      summary.volumeKg += setVolume(s);
    }
    const invalid = done.filter((s) => !s.techniqueValid).length;
    if (invalid > 0) {
      summary.techniqueInvalid.push({
        instanceId: ex.instance.id,
        name: exerciseDisplayName(ex),
        count: invalid,
      });
    }
    const pain = ex.sets.filter((s) => s.painFlag);
    if (pain.length > 0) {
      const areas = [...new Set(pain.map((s) => s.painArea).filter(Boolean))].join(', ');
      summary.painFlags.push({
        instanceId: ex.instance.id,
        name: exerciseDisplayName(ex),
        count: pain.length,
        detail: areas || undefined,
      });
    }
  }
  return summary;
}

export interface PainWarning {
  flaggedSessions: number;
  lookback: number;
}

/**
 * Surfaces a warning when the same variant was pain-flagged in several recent sessions.
 * Informational only — never a diagnosis.
 */
export function painWarning(
  history: ExercisePerformance[],
  variantId: string,
  lookback = 5,
  threshold = 2,
): PainWarning | null {
  const recent = history
    .filter((h) => h.variantId === variantId)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, lookback);
  const flagged = recent.filter((h) => h.sets.some((s) => s.painFlag)).length;
  return flagged >= threshold ? { flaggedSessions: flagged, lookback: recent.length } : null;
}

/** "45 × 10 @1" */
export function formatSetShort(
  s: { weightKg?: number; reps?: number; rir?: number },
  weight: string,
) {
  const rir = s.rir !== undefined && s.rir !== null ? ` @${s.rir}` : '';
  return `${weight} × ${s.reps ?? '—'}${rir}`;
}
