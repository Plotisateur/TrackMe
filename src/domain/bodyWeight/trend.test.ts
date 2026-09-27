import { describe, expect, it } from 'vitest';
import type { BodyWeightEntry } from '@/types/domain';
import { bodyWeightStats, dailyWeights, rollingAverage, weeklyTrend } from './trend';

const at = (day: number, hour = 7) => new Date(2026, 8, day, hour).toISOString();
const entry = (day: number, kg: number, hour = 7): BodyWeightEntry => ({
  id: `${day}-${hour}`,
  recordedAt: at(day, hour),
  weightKg: kg,
});

describe('body weight trend', () => {
  it('averages multiple weigh-ins on the same day', () => {
    const d = dailyWeights([entry(1, 94), entry(1, 93, 20)]);
    expect(d).toHaveLength(1);
    expect(d[0].weightKg).toBe(93.5);
  });

  it('computes a 7-day rolling average', () => {
    const entries = [1, 2, 3, 4, 5, 6, 7, 8].map((d) => entry(d, 100 - d));
    const avg = rollingAverage(dailyWeights(entries), new Date(2026, 8, 8, 12));
    // days 2..8 → 98..92
    expect(avg).toBeCloseTo(95);
  });

  it('estimates a weekly trend and ignores sparse data', () => {
    const entries = Array.from({ length: 21 }, (_, i) => entry(i + 1, 95 - (i * 0.5) / 7));
    const trend = weeklyTrend(dailyWeights(entries), new Date(2026, 8, 21, 12));
    expect(trend).toBeCloseTo(-0.5, 5);
    expect(
      weeklyTrend(dailyWeights([entry(1, 95), entry(2, 94)]), new Date(2026, 8, 2)),
    ).toBeUndefined();
  });

  it('builds stats', () => {
    const s = bodyWeightStats([entry(20, 93.2), entry(19, 94)], new Date(2026, 8, 20, 12));
    expect(s.current).toBe(93.2);
    expect(s.average7).toBeCloseTo(93.6);
  });
});
