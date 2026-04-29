// Reference data — kept in sync with seed.ts.
// Used by mobile app for chip pickers when working offline / before fetch resolves.

export const TRADE_LIST = [
  { slug: 'electrician', name: 'Electrician' },
  { slug: 'plumber', name: 'Plumber' },
  { slug: 'hvac', name: 'HVAC/Refrigeration' },
  { slug: 'carpenter', name: 'Carpenter' },
  { slug: 'welder', name: 'Welder' },
  { slug: 'pipefitter', name: 'Pipefitter' },
  { slug: 'ironworker', name: 'Ironworker' },
  { slug: 'concrete', name: 'Concrete' },
  { slug: 'roofer', name: 'Roofer' },
  { slug: 'trucker-cdl', name: 'Trucker/CDL' },
  { slug: 'heavy-equipment', name: 'Heavy Equipment' },
  { slug: 'general-labor', name: 'General Labor' },
] as const;

export const BENEFIT_LIST = [
  'Health insurance',
  'Paid OT after 40hr',
  'Paid holidays',
  'Dental & vision',
  '401(k)/pension',
  'Per diem',
  'Union eligible',
  'Tool allowance',
  'Relocation assist',
] as const;

// Years-of-experience picker labels (mockup 2B). Map to ExperienceLevel enum.
export const EXPERIENCE_LEVEL_OPTIONS = [
  { value: 'years_0_2', label: '0–2 years' },
  { value: 'years_3_5', label: '3–5 years' },
  { value: 'years_6_10', label: '6–10 years' },
  { value: 'years_11_15', label: '11–15 years' },
  { value: 'years_16_20', label: '16–20 years' },
  { value: 'years_20_plus', label: '20+ years' },
] as const;

// Travel radius dropdown (mockup 2C)
export const TRAVEL_RADIUS_OPTIONS = [10, 25, 50, 100, 250] as const;

// Availability dropdown (mockup 2C)
export const JOB_AVAILABILITY_OPTIONS = [
  { value: 'open', label: 'Open to opportunities' },
  { value: 'actively_looking', label: 'Actively looking' },
  { value: 'not_looking', label: 'Not looking right now' },
] as const;
