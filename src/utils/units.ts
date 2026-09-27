import type { WeightUnit } from '@/types/settings';

export const KG_PER_LB = 0.45359237;

export function kgToUnit(kg: number, unit: WeightUnit): number {
  return unit === 'kg' ? kg : kg / KG_PER_LB;
}

export function unitToKg(value: number, unit: WeightUnit): number {
  return unit === 'kg' ? value : value * KG_PER_LB;
}

/** Rounds to the precision people actually load: 0.25 kg / 0.5 lb. */
export function roundForUnit(value: number, unit: WeightUnit): number {
  const step = unit === 'kg' ? 0.25 : 0.5;
  return Math.round(value / step) * step;
}

export function formatNumber(value: number, maxDecimals = 2): string {
  return Number(value.toFixed(maxDecimals)).toString();
}

export function formatWeight(kg: number | undefined, unit: WeightUnit, withUnit = false): string {
  if (kg === undefined || kg === null || Number.isNaN(kg)) return '—';
  const v = formatNumber(roundForUnit(kgToUnit(kg, unit), unit));
  return withUnit ? `${v} ${unit}` : v;
}

/** Parses user text input ("42,5" or "42.5"). Returns undefined when empty or invalid. */
export function parseDecimal(text: string): number | undefined {
  const t = text.trim().replace(',', '.');
  if (t === '') return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}
