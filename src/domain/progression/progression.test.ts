import { describe, expect, it } from 'vitest';
import type { ExercisePerformance, PerformedSet } from '@/types/domain';
import { prefillSets, suggestProgression } from './progression';

const V = 'lat-cable';
const target = { targetSets: 2, repMin: 10, repMax: 12 };
const options = { weightIncrementKg: 5 };

function perf(
  sets: Partial<PerformedSet>[],
  opts: { variantId?: string; date?: string } = {},
): ExercisePerformance {
  return {
    sessionId: `s-${opts.date ?? '2026-09-26'}`,
    instanceId: 'i',
    variantId: opts.variantId ?? V,
    date: opts.date ?? '2026-09-26T10:00:00.000Z',
    sets: sets.map((s) => ({ weightKg: 45, reps: 10, techniqueValid: true, ...s })),
  };
}

const run = (
  history: ExercisePerformance[],
  extra: Partial<typeof options & { allowIncreaseAtFailure: boolean }> = {},
) => suggestProgression({ variantId: V, history, target, options: { ...options, ...extra } });

describe('suggestProgression (double progression)', () => {
  it('returns null without history for the variant', () => {
    expect(run([])).toBeNull();
  });

  it('10/10 → maintain', () => {
    const s = run([perf([{ reps: 10 }, { reps: 10 }])]);
    expect(s?.type).toBe('maintain');
    expect(s?.suggestedWeightKg).toBe(45);
    expect(s?.targetReps).toBe(11);
  });

  it('11/10 → increase reps', () => {
    const s = run([perf([{ reps: 11 }, { reps: 10 }])]);
    expect(s?.type).toBe('increase_reps');
    expect(s?.suggestedWeightKg).toBe(45);
    expect(s?.targetReps).toBe(11);
  });

  it('10/10 with RIR ≥ 2 on every set → increase reps', () => {
    const s = run([
      perf([
        { reps: 10, rir: 2 },
        { reps: 10, rir: 3 },
      ]),
    ]);
    expect(s?.type).toBe('increase_reps');
  });

  it('12/12 → suggest load increase and restart at the bottom of the range', () => {
    const s = run([
      perf([
        { reps: 12, rir: 1 },
        { reps: 12, rir: 1 },
      ]),
    ]);
    expect(s).toMatchObject({ type: 'increase_weight', suggestedWeightKg: 50, targetReps: 10 });
  });

  it('12/12 but technique invalid → do not increase', () => {
    const s = run([perf([{ reps: 12 }, { reps: 12, techniqueValid: false }])]);
    expect(s?.type).toBe('maintain');
    expect(s?.suggestedWeightKg).toBe(45);
    expect(s?.reason).toMatch(/technique/i);
  });

  it('all sets technique invalid → maintain', () => {
    const s = run([
      perf([
        { reps: 12, techniqueValid: false },
        { reps: 12, techniqueValid: false },
      ]),
    ]);
    expect(s?.type).toBe('maintain');
  });

  it('12/12 at RIR 0 → no increase by default', () => {
    const s = run([
      perf([
        { reps: 12, rir: 1 },
        { reps: 12, rir: 0 },
      ]),
    ]);
    expect(s?.type).toBe('maintain');
    expect(s?.reason).toMatch(/failure/i);
  });

  it('12/12 at RIR 0 → increase when configured', () => {
    const s = run(
      [
        perf([
          { reps: 12, rir: 1 },
          { reps: 12, rir: 0 },
        ]),
      ],
      { allowIncreaseAtFailure: true },
    );
    expect(s?.type).toBe('increase_weight');
  });

  it('never compares against a different equipment variant', () => {
    const other = perf(
      [
        { reps: 12, weightKg: 70 },
        { reps: 12, weightKg: 70 },
      ],
      {
        variantId: 'lat-technogym',
        date: '2026-09-27T10:00:00.000Z',
      },
    );
    expect(run([other])).toBeNull();
    const s = run([other, perf([{ reps: 10 }, { reps: 10 }])]);
    expect(s?.suggestedWeightKg).toBe(45);
    expect(s?.type).toBe('maintain');
  });

  it('uses the most recent session of the variant', () => {
    const s = run([
      perf([{ reps: 12 }, { reps: 12 }], { date: '2026-09-20T10:00:00.000Z' }),
      perf([{ reps: 11 }, { reps: 10 }], { date: '2026-09-26T10:00:00.000Z' }),
    ]);
    expect(s?.type).toBe('increase_reps');
  });

  it('follows the Gamma example sequence', () => {
    const seq: [number, number][] = [
      [10, 10],
      [11, 10],
      [11, 11],
      [12, 11],
      [12, 12],
    ];
    const types = seq.map(([a, b]) => run([perf([{ reps: a }, { reps: b }])])?.type);
    expect(types).toEqual([
      'maintain',
      'increase_reps',
      'maintain',
      'increase_reps',
      'increase_weight',
    ]);
  });

  it('incomplete set count → maintain', () => {
    const s = run([perf([{ reps: 12 }])]);
    expect(s?.type).toBe('maintain');
    expect(s?.reason).toMatch(/1 of 2/);
  });

  it('far below range → reduce weight', () => {
    const s = run([perf([{ reps: 7 }, { reps: 6 }])]);
    expect(s).toMatchObject({ type: 'reduce_weight', suggestedWeightKg: 40 });
  });

  it('slightly below range → maintain and build up', () => {
    const s = run([perf([{ reps: 9 }, { reps: 8 }])]);
    expect(s?.type).toBe('maintain');
  });
});

describe('prefillSets', () => {
  const last: PerformedSet[] = [
    { weightKg: 45, reps: 11, techniqueValid: true },
    { weightKg: 45, reps: 10, techniqueValid: true },
  ];

  it('repeats previous values per set', () => {
    expect(prefillSets(2, last, null)).toEqual([
      { weightKg: 45, reps: 11 },
      { weightKg: 45, reps: 10 },
    ]);
  });

  it('applies a load increase to every set', () => {
    const p = prefillSets(2, last, {
      type: 'increase_weight',
      suggestedWeightKg: 50,
      targetReps: 10,
      reason: '',
    });
    expect(p).toEqual([
      { weightKg: 50, reps: 10 },
      { weightKg: 50, reps: 10 },
    ]);
  });

  it('falls back to the reference, and extends extra sets from the last one', () => {
    expect(prefillSets(1, null, null, { weightKg: 45, reps: 10 })).toEqual([
      { weightKg: 45, reps: 10 },
    ]);
    expect(prefillSets(3, last, null)[2]).toEqual({ weightKg: 45, reps: 10 });
  });
});
