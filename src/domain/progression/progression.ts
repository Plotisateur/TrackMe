import type { ExercisePerformance, PerformedSet } from '@/types/domain';

export interface ProgressionSuggestion {
  type: 'increase_weight' | 'increase_reps' | 'maintain' | 'reduce_weight';
  suggestedWeightKg?: number;
  targetReps?: number;
  reason: string;
}

export interface ProgressionTarget {
  targetSets: number;
  repMin: number;
  repMax: number;
}

export interface ProgressionOptions {
  weightIncrementKg: number;
  /**
   * When false (default), reaching the top of the range with a final set at RIR 0
   * (uncontrolled failure) does not unlock a load increase.
   */
  allowIncreaseAtFailure?: boolean;
}

export interface ProgressionInput {
  variantId: string;
  /** Performances for any variants; anything not matching `variantId` is ignored. */
  history: ExercisePerformance[];
  target: ProgressionTarget;
  options: ProgressionOptions;
}

const fmt = (n: number) => Number(n.toFixed(2)).toString();

/**
 * Double progression (Gamma):
 *  1. technique must stay stable — invalid sets never count toward progression
 *  2. progress reps first
 *  3. add load only once every target set reaches the top of the rep range
 *  4. after a load increase, restart at the bottom of the range
 *
 * Only history of the same exercise variant is ever considered.
 */
export function suggestProgression(input: ProgressionInput): ProgressionSuggestion | null {
  const { variantId, target, options } = input;
  const last = latestPerformance(input.history, variantId);
  if (!last) return null;

  const valid = last.sets.filter((s) => s.techniqueValid && s.reps > 0);
  if (valid.length === 0) {
    const top = Math.max(...last.sets.map((s) => s.weightKg));
    return {
      type: 'maintain',
      suggestedWeightKg: top,
      targetReps: target.repMin,
      reason: `No technically valid sets last time — repeat ${fmt(top)} kg with clean technique.`,
    };
  }

  const workingWeight = Math.max(...valid.map((s) => s.weightKg));
  const working = valid.filter((s) => s.weightKg === workingWeight).slice(0, target.targetSets);
  const invalidAtTop = last.sets.filter(
    (s) => !s.techniqueValid && s.weightKg >= workingWeight,
  ).length;

  if (working.length < target.targetSets) {
    if (invalidAtTop > 0) {
      return {
        type: 'maintain',
        suggestedWeightKg: workingWeight,
        targetReps: Math.min(Math.min(...working.map((s) => s.reps)), target.repMax),
        reason: `${invalidAtTop} set${invalidAtTop > 1 ? 's' : ''} at ${fmt(workingWeight)} kg had degraded technique — repeat the load and own every rep before progressing.`,
      };
    }
    return {
      type: 'maintain',
      suggestedWeightKg: workingWeight,
      targetReps: target.repMin,
      reason: `Only ${working.length} of ${target.targetSets} target sets at ${fmt(workingWeight)} kg — complete all sets before progressing.`,
    };
  }

  const reps = working.map((s) => s.reps);
  const minReps = Math.min(...reps);
  const maxReps = Math.max(...reps);

  if (minReps >= target.repMax) {
    const atFailure = working.some((s) => s.rir === 0);
    if (atFailure && !options.allowIncreaseAtFailure) {
      return {
        type: 'maintain',
        suggestedWeightKg: workingWeight,
        targetReps: target.repMax,
        reason: `Top of range reached at ${fmt(workingWeight)} kg but at failure (RIR 0) — repeat with ≥ 1 rep in reserve before adding load.`,
      };
    }
    const next = workingWeight + options.weightIncrementKg;
    return {
      type: 'increase_weight',
      suggestedWeightKg: next,
      targetReps: target.repMin,
      reason: `All ${target.targetSets} sets reached ${target.repMax}+ reps at ${fmt(workingWeight)} kg with valid technique → ${fmt(next)} kg, restart at ${target.repMin} reps.`,
    };
  }

  if (maxReps < target.repMin) {
    if (maxReps <= target.repMin - 2 && workingWeight - options.weightIncrementKg > 0) {
      const next = workingWeight - options.weightIncrementKg;
      return {
        type: 'reduce_weight',
        suggestedWeightKg: next,
        targetReps: target.repMin,
        reason: `Best set was ${maxReps} reps, well below the ${target.repMin}–${target.repMax} range → drop to ${fmt(next)} kg.`,
      };
    }
    return {
      type: 'maintain',
      suggestedWeightKg: workingWeight,
      targetReps: target.repMin,
      reason: `Below the ${target.repMin}–${target.repMax} range — keep ${fmt(workingWeight)} kg and build to ${target.repMin} reps.`,
    };
  }

  if (maxReps > minReps) {
    const aim = Math.min(minReps + 1, target.repMax);
    return {
      type: 'increase_reps',
      suggestedWeightKg: workingWeight,
      targetReps: aim,
      reason: `Rep progress underway — bring every set to ${aim} at ${fmt(workingWeight)} kg.`,
    };
  }

  const aim = Math.min(minReps + 1, target.repMax);
  const rirs = working.map((s) => s.rir).filter((r): r is number => r !== undefined);
  const plentyInReserve = rirs.length === working.length && rirs.every((r) => r >= 2);
  if (plentyInReserve) {
    return {
      type: 'increase_reps',
      suggestedWeightKg: workingWeight,
      targetReps: aim,
      reason: `${minReps} reps with ≥ 2 in reserve — push for ${aim} at ${fmt(workingWeight)} kg.`,
    };
  }
  return {
    type: 'maintain',
    suggestedWeightKg: workingWeight,
    targetReps: aim,
    reason: `Consolidate ${fmt(workingWeight)} kg × ${minReps} — aim for ${aim} on the first set.`,
  };
}

export function latestPerformance(
  history: ExercisePerformance[],
  variantId: string,
): ExercisePerformance | null {
  let best: ExercisePerformance | null = null;
  for (const h of history) {
    if (h.variantId !== variantId || h.sets.length === 0) continue;
    if (!best || h.date > best.date) best = h;
  }
  return best;
}

export interface SetPrefill {
  weightKg?: number;
  reps?: number;
}

/**
 * Values to prefill the sets of the next session.
 * Previous values per set index, unless the suggestion changes the load.
 */
export function prefillSets(
  setCount: number,
  last: PerformedSet[] | null,
  suggestion: ProgressionSuggestion | null,
  reference?: { weightKg?: number; reps?: number },
): SetPrefill[] {
  const out: SetPrefill[] = [];
  const changesLoad =
    suggestion?.type === 'increase_weight' || suggestion?.type === 'reduce_weight';
  for (let i = 0; i < setCount; i++) {
    if (changesLoad) {
      out.push({ weightKg: suggestion!.suggestedWeightKg, reps: suggestion!.targetReps });
      continue;
    }
    const prev = last && last.length > 0 ? (last[i] ?? last[last.length - 1]) : undefined;
    if (prev) out.push({ weightKg: prev.weightKg, reps: prev.reps });
    else out.push({ weightKg: reference?.weightKg, reps: reference?.reps });
  }
  return out;
}
