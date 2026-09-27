import type { ExercisePerformance, PerformedSet } from '@/types/domain';

export interface RecordSet extends PerformedSet {
  date: string;
  sessionId: string;
}

export type PersonalRecordType = 'technical' | 'weight' | 'reps' | 'e1rm';

export interface PersonalRecord {
  type: PersonalRecordType;
  variantId: string;
  set: RecordSet;
  previous?: RecordSet;
  /** For e1rm/technical PRs, the estimated 1RM. */
  value?: number;
}

export interface RepRange {
  min: number;
  max: number;
}

/** Epley estimate. Only meaningful for moderate rep counts. */
export function estimateOneRepMax(weightKg: number, reps: number): number | undefined {
  if (reps <= 0 || weightKg <= 0 || reps > 15) return undefined;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

export function setVolume(s: { weightKg?: number; reps?: number }): number {
  return (s.weightKg ?? 0) * (s.reps ?? 0);
}

function flatten(perfs: ExercisePerformance[], variantId: string): RecordSet[] {
  const out: RecordSet[] = [];
  for (const p of perfs) {
    if (p.variantId !== variantId) continue;
    for (const s of p.sets) {
      if (s.reps > 0 && s.techniqueValid) out.push({ ...s, date: p.date, sessionId: p.sessionId });
    }
  }
  return out;
}

const inRange = (reps: number, range?: RepRange) =>
  !range || (reps >= range.min && reps <= range.max);

export interface VariantRecords {
  /** Best technically valid set inside the comparable rep range, by e1RM. */
  technical?: RecordSet & { e1rm: number };
  /** Heaviest technically valid set (ties broken by reps). */
  weight?: RecordSet;
  /** Best e1RM across all valid sets. */
  e1rm?: RecordSet & { e1rm: number };
  /** Most reps per load (kg as key). */
  repsByWeight: Map<number, RecordSet>;
}

/**
 * Records for a single variant. Only technically valid sets count, and
 * performances of other variants are ignored — machine kg never competes with cable kg.
 */
export function computeRecords(
  perfs: ExercisePerformance[],
  variantId: string,
  range?: RepRange,
): VariantRecords {
  const sets = flatten(perfs, variantId);
  const res: VariantRecords = { repsByWeight: new Map() };
  for (const s of sets) {
    if (
      !res.weight ||
      s.weightKg > res.weight.weightKg ||
      (s.weightKg === res.weight.weightKg && s.reps > res.weight.reps)
    ) {
      res.weight = s;
    }
    const prevReps = res.repsByWeight.get(s.weightKg);
    if (!prevReps || s.reps > prevReps.reps) res.repsByWeight.set(s.weightKg, s);
    const e = estimateOneRepMax(s.weightKg, s.reps);
    if (e !== undefined) {
      if (!res.e1rm || e > res.e1rm.e1rm) res.e1rm = { ...s, e1rm: e };
      if (inRange(s.reps, range) && (!res.technical || e > res.technical.e1rm)) {
        res.technical = { ...s, e1rm: e };
      }
    }
  }
  return res;
}

const EPS = 1e-9;

/**
 * PRs set in `session` compared with everything strictly before it.
 * A first-ever performance is a baseline, not a PR.
 */
export function detectSessionRecords(
  session: ExercisePerformance,
  prior: ExercisePerformance[],
  range?: RepRange,
): PersonalRecord[] {
  const variantId = session.variantId;
  const before = prior.filter(
    (p) => p.variantId === variantId && p.sessionId !== session.sessionId && p.date < session.date,
  );
  const prev = computeRecords(before, variantId);
  const prevTech = computeRecords(before, variantId, range);
  if (!prev.weight) return [];
  const cur = computeRecords([session], variantId, range);
  const out: PersonalRecord[] = [];

  if (
    cur.technical &&
    (!prevTech.technical || cur.technical.e1rm > prevTech.technical.e1rm + EPS)
  ) {
    out.push({
      type: 'technical',
      variantId,
      set: cur.technical,
      previous: prevTech.technical,
      value: cur.technical.e1rm,
    });
  }
  if (cur.weight && cur.weight.weightKg > prev.weight.weightKg + EPS) {
    out.push({ type: 'weight', variantId, set: cur.weight, previous: prev.weight });
  }
  let bestRep: PersonalRecord | undefined;
  for (const [w, s] of cur.repsByWeight) {
    const p = prev.repsByWeight.get(w);
    if (p && s.reps > p.reps && (!bestRep || w > bestRep.set.weightKg)) {
      bestRep = { type: 'reps', variantId, set: s, previous: p };
    }
  }
  if (bestRep) out.push(bestRep);
  if (cur.e1rm && prev.e1rm && cur.e1rm.e1rm > prev.e1rm.e1rm + EPS) {
    out.push({ type: 'e1rm', variantId, set: cur.e1rm, previous: prev.e1rm, value: cur.e1rm.e1rm });
  }
  return out;
}
