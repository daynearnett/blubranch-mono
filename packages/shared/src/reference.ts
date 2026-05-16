// Reference data — kept in sync with seed.ts.
// Used by mobile app for chip pickers when working offline / before fetch resolves.

export const TRADE_LIST = [
  { slug: 'electrician', name: 'Electrician', isPopular: true },
  { slug: 'plumber', name: 'Plumber', isPopular: true },
  { slug: 'hvac', name: 'HVAC/Refrigeration', isPopular: true },
  { slug: 'carpenter', name: 'Carpenter', isPopular: true },
  { slug: 'welder', name: 'Welder', isPopular: true },
  { slug: 'pipefitter', name: 'Pipefitter', isPopular: true },
  { slug: 'ironworker', name: 'Ironworker', isPopular: true },
  { slug: 'concrete', name: 'Concrete', isPopular: true },
  { slug: 'roofer', name: 'Roofer', isPopular: true },
  { slug: 'trucker-cdl', name: 'Trucker/CDL', isPopular: true },
  { slug: 'heavy-equipment', name: 'Heavy Equipment', isPopular: true },
  { slug: 'general-labor', name: 'General Labor', isPopular: true },
  { slug: 'electrical-lineman', name: 'Electrical Lineman', isPopular: false },
  { slug: 'electronics-tech', name: 'Electronics Technician', isPopular: false },
  { slug: 'elevator-mechanic', name: 'Elevator Mechanic', isPopular: false },
  { slug: 'sprinkler-fitter', name: 'Fire Sprinkler Fitter', isPopular: false },
  { slug: 'glazier', name: 'Glazier', isPopular: false },
  { slug: 'insulation', name: 'Insulation Worker', isPopular: false },
  { slug: 'machinist', name: 'Machinist', isPopular: false },
  { slug: 'mason', name: 'Mason/Bricklayer', isPopular: false },
  { slug: 'millwright', name: 'Millwright', isPopular: false },
  { slug: 'painter', name: 'Painter', isPopular: false },
  { slug: 'plasterer', name: 'Plasterer/Stucco', isPopular: false },
  { slug: 'sheet-metal', name: 'Sheet Metal Worker', isPopular: false },
  { slug: 'steamfitter', name: 'Steamfitter', isPopular: false },
  { slug: 'telecom-tech', name: 'Telecommunications Tech', isPopular: false },
  { slug: 'tile-setter', name: 'Tile/Marble Setter', isPopular: false },
  { slug: 'boilermaker', name: 'Boilermaker', isPopular: false },
  { slug: 'drywall', name: 'Drywall Installer', isPopular: false },
  { slug: 'floor-layer', name: 'Floor Layer', isPopular: false },
  { slug: 'fence-erector', name: 'Fence Erector', isPopular: false },
  { slug: 'hazmat', name: 'Hazmat Removal', isPopular: false },
  { slug: 'highway-maint', name: 'Highway Maintenance', isPopular: false },
  { slug: 'landscaper', name: 'Landscaper/Groundskeeper', isPopular: false },
  { slug: 'paving', name: 'Paving Equipment Operator', isPopular: false },
  { slug: 'pile-driver', name: 'Pile Driver', isPopular: false },
  { slug: 'scaffold', name: 'Scaffold Erector', isPopular: false },
  { slug: 'solar-installer', name: 'Solar Installer', isPopular: false },
  { slug: 'surveyor', name: 'Surveyor', isPopular: false },
  { slug: 'well-driller', name: 'Well Driller', isPopular: false },
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
