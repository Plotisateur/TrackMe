import { describe, expect, it } from 'vitest';
import type { ExercisePerformance, PerformedSet } from '@/types/domain';
import { computeRecords, detectSessionRecords, estimateOneRepMax } from './records';

const perf = (
  date: string,
  sets: Partial<PerformedSet>[],
  variantId = 'v1',
): ExercisePerformance => ({
  sessionId: date,
  instanceId: date,
  variantId,
  date,
  sets: sets.map((s) => ({ weightKg: 45, reps: 10, techniqueValid: true, ...s })),
});

describe('estimateOneRepMax', () => {
  it('uses Epley and ignores high-rep sets', () => {
    expect(estimateOneRepMax(100, 1)).toBe(100);
    expect(estimateOneRepMax(60, 10)).toBeCloseTo(80);
    expect(estimateOneRepMax(20, 20)).toBeUndefined();
  });
});

describe('computeRecords', () => {
  it('ignores technique-invalid sets and other variants', () => {
    const r = computeRecords(
      [
        perf('2026-09-01', [
          { weightKg: 50, reps: 10, techniqueValid: false },
          { weightKg: 45, reps: 11 },
        ]),
        perf('2026-09-02', [{ weightKg: 90, reps: 10 }], 'machine'),
      ],
      'v1',
    );
    expect(r.weight?.weightKg).toBe(45);
    expect(r.repsByWeight.get(45)?.reps).toBe(11);
  });

  it('technical record respects the comparable rep range', () => {
    const r = computeRecords(
      [
        perf('d', [
          { weightKg: 60, reps: 5 },
          { weightKg: 45, reps: 11 },
        ]),
      ],
      'v1',
      {
        min: 10,
        max: 12,
      },
    );
    expect(r.technical?.weightKg).toBe(45);
    expect(r.e1rm?.weightKg).toBe(60);
  });
});

describe('detectSessionRecords', () => {
  const prior = [perf('2026-09-20', [{ reps: 10 }, { reps: 10 }])];

  it('first performance is a baseline, not a PR', () => {
    expect(detectSessionRecords(prior[0], [], { min: 10, max: 12 })).toEqual([]);
  });

  it('detects technical and rep PRs at the same load', () => {
    const cur = perf('2026-09-26', [{ reps: 11 }, { reps: 10 }]);
    const types = detectSessionRecords(cur, prior, { min: 10, max: 12 }).map((r) => r.type);
    expect(types).toContain('technical');
    expect(types).toContain('reps');
    expect(types).not.toContain('weight');
  });

  it('detects a weight PR', () => {
    const cur = perf('2026-09-26', [{ weightKg: 50, reps: 10 }]);
    expect(detectSessionRecords(cur, prior).map((r) => r.type)).toContain('weight');
  });

  it('a heavier but technique-invalid set is not a PR', () => {
    const cur = perf('2026-09-26', [{ weightKg: 50, reps: 10, techniqueValid: false }]);
    expect(detectSessionRecords(cur, prior)).toEqual([]);
  });
});
