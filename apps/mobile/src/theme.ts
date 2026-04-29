// Design tokens — kept in one place so we can swap palettes when final colors land.
// Pulled from CLAUDE.md (NOT FINAL — stand-in until brand work is done).

export const colors = {
  primary: '#E8713A', // orange — CTAs, accents
  primaryDark: '#1B3A5C', // dark navy — headers, profile banner
  ctaDark: '#1E3D5C', // dark blue — secondary CTAs ("Take me to my feed")
  background: '#FFFFFF',
  surface: '#F7F8FA',
  border: '#E5E7EB',
  textPrimary: '#1A1A1A',
  textSecondary: '#6B7280',
  textInverse: '#FFFFFF',
  success: '#22C55E',
  danger: '#EF4444',
  inputBorder: '#D1D5DB',
  chipBg: '#F3F4F6',
  chipBgActive: '#FFE4D6',
  chipBorderActive: '#E8713A',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  pill: 999,
} as const;

export const typography = {
  h1: { fontSize: 28, fontWeight: '700' as const },
  h2: { fontSize: 22, fontWeight: '700' as const },
  h3: { fontSize: 18, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  bodyBold: { fontSize: 15, fontWeight: '600' as const },
  small: { fontSize: 13, fontWeight: '400' as const },
  caption: { fontSize: 12, fontWeight: '400' as const },
} as const;

export const layout = {
  // Screens 4–7 are mocked at mobile width.
  screenPadding: spacing.lg,
  cardRadius: radius.md,
  inputHeight: 48,
  buttonHeight: 50,
} as const;
