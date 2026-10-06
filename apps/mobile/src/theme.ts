// BluBranch design tokens — Workwear Denim + CAT Yellow palette.
// System font stack on every platform. No webfont.
//
// DARK MODE: the palette is chosen ONCE at app launch from the system
// appearance (Appearance.getColorScheme()). Every StyleSheet.create in the
// app captures tokens at module eval, so a mid-session OS theme change
// applies on the next launch — the standard tradeoff of static theming.
// A live in-app toggle needs the full dynamic-theme refactor (post-field-test).
import { Appearance } from 'react-native';

export const isDarkMode = Appearance.getColorScheme() === 'dark';

const lightColors = {
  // Brand
  navy: '#3D5A80',      // Workwear Denim — primary brand surface
  navyDark: '#2C4361',  // Darker denim — pressed/strokes
  navyMid: '#5D7AA0',   // Lighter denim — accents
  steel: '#4682B4',     // Blue Steel — logo-gradient blue; primary-action accent (FAB)
  // `orange` token kept as a name for backwards compat (consumed widely) but
  // now holds CAT Yellow. Use as a background/fill — for text on white,
  // prefer `navy`/`primaryDark` (yellow has insufficient contrast on white).
  orange: '#FFCD11',    // CAT Yellow — accent (bg/fill/icon)
  orangeWarm: '#D4A017',// Darker yellow/amber — limited use
  green: '#1B5E20',     // verified badge ONLY — not for generic success
  amber: '#FAC775',
  amberText: '#412402',
  red: '#C0392B',       // destructive actions only

  // Neutral
  surface: '#F5F7FA',
  cardBg: '#FFFFFF',
  divider: '#F1EFE8',
  text: '#1F3A55',      // Deep denim for body text (passes AA on white)
  textBody: '#2A3F58',
  textMuted: '#5C7A9B',
  textLight: '#8FB3D4',
  border: 'rgba(45,67,97,0.18)',
  borderSoft: 'rgba(45,67,97,0.08)',

  // Functional aliases (used by existing components)
  primary: '#FFCD11',       // CAT Yellow — for CTA backgrounds / active fills
  primaryDark: '#3D5A80',   // Workwear Denim — for text headers / brand
  ctaDark: '#2C4361',       // Darker denim — for inverted CTAs
  background: '#FFFFFF',
  textPrimary: '#1F3A55',
  textSecondary: '#5C7A9B',
  textInverse: '#FFFFFF',
  success: '#1B5E20',
  danger: '#C0392B',
  inputBorder: 'rgba(45,67,97,0.18)',
  chipBg: '#F5F7FA',
  chipBgActive: '#FFF6CC',     // Light yellow tint for active chip bg
  chipBorderActive: '#FFCD11', // CAT Yellow for active chip border

  // Tinted feedback surfaces (paired bg/text so both themes stay legible)
  successTintBg: '#DCFCE7',
  successTintText: '#15803D',
  dangerTintBg: '#FEE2E2',
  dangerTintText: '#B91C1C',

  // Advertised-job cards in the feed — pale denim so they read as "ad slot",
  // not just another post.
  jobCardBg: '#EEF4FA',
  jobCardBorder: 'rgba(70,130,180,0.45)',
} as const;

// Night-shift palette: denim-navy ground, brand accents kept. Same keys as
// lightColors — TypeScript enforces parity below. Known v1 tradeoff: `navy`
// is mostly TEXT (headers/labels) so its dark variant is lifted for
// legibility; the few navy-filled buttons drop to ~3:1 with white labels.
const darkColors: { [K in keyof typeof lightColors]: string } = {
  navy: '#6B91BD',
  navyDark: '#89A9CC',
  navyMid: '#7E9CC4',
  steel: '#6FA8DC',
  orange: '#FFCD11',
  orangeWarm: '#E0B23A',
  green: '#66BB6A',
  amber: '#FAC775',
  amberText: '#412402',
  red: '#E57373',

  surface: '#16243A',
  cardBg: '#1A2B44',
  divider: '#223850',
  text: '#E8EEF5',
  textBody: '#D5E0EC',
  textMuted: '#93A9C0',
  textLight: '#6E89A6',
  border: 'rgba(176,196,222,0.22)',
  borderSoft: 'rgba(176,196,222,0.10)',

  primary: '#FFCD11',
  primaryDark: '#A9C6E8',
  ctaDark: '#3D5A80',
  background: '#0F1B29',
  textPrimary: '#E8EEF5',
  textSecondary: '#93A9C0',
  textInverse: '#FFFFFF',
  success: '#66BB6A',
  danger: '#E57373',
  inputBorder: 'rgba(176,196,222,0.22)',
  chipBg: '#1E3048',
  chipBgActive: '#3A3214',
  chipBorderActive: '#FFCD11',

  successTintBg: '#143D23',
  successTintText: '#7BD99A',
  dangerTintBg: '#45201F',
  dangerTintText: '#F1948A',

  jobCardBg: '#1C3049',
  jobCardBorder: 'rgba(111,168,220,0.45)',
};

export const colors = isDarkMode ? darkColors : lightColors;

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
