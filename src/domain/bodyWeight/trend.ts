import type { BodyWeightEntry } from '@/types/domain';
import { DAY_MS, localDateKey } from '@/utils/date';

export interface DailyWeight {
  /** Local date key YYYY-MM-DD */
  date: string;
  /** Local midnight timestamp for that date */
  t: number;
  weightKg: number;
}

function dayStart(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

/** One value per calendar day (mean of that day's weigh-ins), oldest first. */
export function dailyWeights(entries: BodyWeightEntry[]): DailyWeight[] {
  const byDay = new Map<string, number[]>();
  for (const e of entries) {
    const k = localDateKey(e.recordedAt);
    const arr = byDay.get(k) ?? [];
    arr.push(e.weightKg);
    byDay.set(k, arr);
  }
  return [...byDay.entries()]
    .map(([date, ws]) => ({
      date,
      t: dayStart(date),
      weightKg: ws.reduce((a, b) => a + b, 0) / ws.length,
    }))
    .sort((a, b) => a.t - b.t);
}

/** Mean of daily values in the `days`-day window ending at `at` (inclusive). */
export function rollingAverage(daily: DailyWeight[], at: Date, days = 7): number | undefined {
  const end = dayStart(localDateKey(at));
  const start = end - (days - 1) * DAY_MS;
  const inWindow = daily.filter((d) => d.t >= start && d.t <= end);
  if (inWindow.length === 0) return undefined;
  return inWindow.reduce((a, d) => a + d.weightKg, 0) / inWindow.length;
}

/** 7-day rolling average for every day that has a weigh-in — the smoothed trend line. */
export function smoothedSeries(daily: DailyWeight[], days = 7): { t: number; value: number }[] {
  return daily.map((d) => ({ t: d.t, value: rollingAverage(daily, new Date(d.t), days)! }));
}

/**
 * Least-squares slope over the last `windowDays`, in kg per week.
 * Needs at least 3 weigh-ins spanning 5+ days so single readings don't drive it.
 */
export function weeklyTrend(daily: DailyWeight[], at: Date, windowDays = 28): number | undefined {
  const end = dayStart(localDateKey(at));
  const pts = daily.filter((d) => d.t > end - windowDays * DAY_MS && d.t <= end);
  if (pts.length < 3) return undefined;
  if ((pts[pts.length - 1].t - pts[0].t) / DAY_MS < 5) return undefined;
  const xs = pts.map((p) => (p.t - pts[0].t) / DAY_MS);
  const ys = pts.map((p) => p.weightKg);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  if (den === 0) return undefined;
  return (num / den) * 7;
}

/** Change of the 7-day average over `days` days. */
export function averageChange(daily: DailyWeight[], at: Date, days: number): number | undefined {
  const now = rollingAverage(daily, at);
  const then = rollingAverage(daily, new Date(at.getTime() - days * DAY_MS));
  if (now === undefined || then === undefined) return undefined;
  return now - then;
}

export interface BodyWeightStats {
  current?: number;
  average7?: number;
  trendPerWeek?: number;
  change7?: number;
  change30?: number;
}

export function bodyWeightStats(entries: BodyWeightEntry[], at = new Date()): BodyWeightStats {
  const daily = dailyWeights(entries);
  const latest = [...entries].sort((a, b) => (a.recordedAt < b.recordedAt ? 1 : -1))[0];
  return {
    current: latest?.weightKg,
    average7: rollingAverage(daily, at),
    trendPerWeek: weeklyTrend(daily, at),
    change7: averageChange(daily, at, 7),
    change30: averageChange(daily, at, 30),
  };
}
