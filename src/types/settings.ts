export type WeightUnit = 'kg' | 'lb';
export type ThemePreference = 'dark' | 'light' | 'system';

export interface MacroTargets {
  calories: number;
  proteinMinG: number;
  proteinMaxG: number;
  carbsRestDayG: number;
  carbsTrainingDayG: number;
  fatG: number;
}

export interface AppSettings {
  unit: WeightUnit;
  defaultRestSeconds: number;
  rirEnabled: boolean;
  haptics: boolean;
  sound: boolean;
  theme: ThemePreference;
  keepAwakeDuringWorkout: boolean;
  /** When true, a top-of-range session at RIR 0 may still trigger a load increase. */
  allowIncreaseAtFailure: boolean;
  bodyWeightTargetKg?: number;
  macrosEnabled: boolean;
  macroTargets: MacroTargets;
}

export const DEFAULT_SETTINGS: AppSettings = {
  unit: 'kg',
  defaultRestSeconds: 120,
  rirEnabled: true,
  haptics: true,
  sound: true,
  theme: 'dark',
  keepAwakeDuringWorkout: true,
  allowIncreaseAtFailure: false,
  bodyWeightTargetKg: undefined,
  macrosEnabled: false,
  macroTargets: {
    calories: 1820,
    proteinMinG: 150,
    proteinMaxG: 170,
    carbsRestDayG: 140,
    carbsTrainingDayG: 170,
    fatG: 60,
  },
};
