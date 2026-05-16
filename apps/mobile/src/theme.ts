// BluBranch v2 design tokens — Balint's exact palette from the build guide.
// System font stack on every platform. No webfont.

export const colors = {
  // Brand
  navy: '#0F2D52',
  navyDark: '#0A2240',
  navyMid: '#1A4A7A',
  orange: '#E85D20',
  orangeWarm: '#993C1D',
  green: '#1B5E20', // verified badge ONLY — not for generic success
  amber: '#FAC775',
  amberText: '#412402',
  red: '#C0392B', // destructive actions only

  // Neutral
  surface: '#F5F7FA',
  cardBg: '#FFFFFF',
  divider: '#F1EFE8',
  text: '#0F2D52',
  textBody: '#2A3F58',
  textMuted: '#5C7A9B',
  textLight: '#8FB3D4',
  border: 'rgba(15,45,82,0.18)',
  borderSoft: 'rgba(15,45,82,0.08)',

  // Functional aliases (used by existing components)
  primary: '#E85D20',
  primaryDark: '#0F2D52',
  ctaDark: '#0A2240',
  background: '#FFFFFF',
  textPrimary: '#0F2D52',
  textSecondary: '#5C7A9B',
  textInverse: '#FFFFFF',
  success: '#1B5E20',
  danger: '#C0392B',
  inputBorder: 'rgba(15,45,82,0.18)',
  chipBg: '#F5F7FA',
  chipBgActive: '#FDEEE6',
  chipBorderActive: '#E85D20',
} as const;

export const spacing = {
  xxs: 4,
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  // Balint's extra stops
  10: 10,
  14: 14,
  18: 18,
  22: 22,
  26: 26,
} as const;

export const radius = {
  xs: 4,   // tags/badges
  sm: 6,
  md: 8,   // cards, input fields
  lg: 10,  // cards
  xl: 12,
  pill: 18,     // inline buttons
  pillCta: 24,  // primary CTAs
  avatar: 999,  // circle
} as const;

export const typography = {
  h1: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.44, lineHeight: 26 },
  h2: { fontSize: 17, fontWeight: '700' as const },
  h3: { fontSize: 15, fontWeight: '700' as const },
  body: { fontSize: 13, fontWeight: '400' as const, lineHeight: 20 },
  bodyBold: { fontSize: 13, fontWeight: '600' as const, lineHeight: 20 },
  small: { fontSize: 12, fontWeight: '400' as const },
  micro: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.44, textTransform: 'uppercase' as const },
  caption: { fontSize: 10, fontWeight: '600' as const, letterSpacing: 0.4, textTransform: 'uppercase' as const },
} as const;

export const layout = {
  screenPaddingH: 16,
  sectionPaddingV: 16,
  cardPadding: 14,
  cardRadius: radius.md,
  inputHeight: 48,
  buttonHeight: 50,
  dividerHeight: 6,
  // Kept for backwards compat with existing screens
  screenPadding: 16,
} as const;
