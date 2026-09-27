export interface Palette {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  textFaint: string;
  primary: string;
  primaryText: string;
  success: string;
  successBg: string;
  warning: string;
  warningBg: string;
  danger: string;
  dangerBg: string;
  info: string;
}

export const darkPalette: Palette = {
  bg: '#0E1116',
  surface: '#171B22',
  surfaceAlt: '#212733',
  border: '#2C3442',
  text: '#F1F4F8',
  textMuted: '#A8B3C4',
  textFaint: '#6B778A',
  primary: '#4ADE80',
  primaryText: '#062812',
  success: '#4ADE80',
  successBg: '#12301F',
  warning: '#FBBF24',
  warningBg: '#3A2C0A',
  danger: '#F87171',
  dangerBg: '#3B1515',
  info: '#60A5FA',
};

export const lightPalette: Palette = {
  bg: '#F4F6F9',
  surface: '#FFFFFF',
  surfaceAlt: '#EAEEF3',
  border: '#D5DBE3',
  text: '#10151C',
  textMuted: '#4A5566',
  textFaint: '#7C889A',
  primary: '#15803D',
  primaryText: '#FFFFFF',
  success: '#15803D',
  successBg: '#DCF5E4',
  warning: '#A16207',
  warningBg: '#FDF1D3',
  danger: '#B91C1C',
  dangerBg: '#FBE1E1',
  info: '#1D4ED8',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const radius = { sm: 8, md: 12, lg: 16 } as const;
/** Minimum touch target for gym use (sweaty hands). */
export const TOUCH = 48;
