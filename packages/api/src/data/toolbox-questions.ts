// Toolbox Talk starter bank — general job-site safety/code questions (v1 is
// trade-agnostic; a per-trade rotation can come later). Auto-seeded on first
// GET /toolbox/today when the table is empty, so no deploy coordination needed.
// Keep answers to well-established OSHA/code basics only.

export interface ToolboxSeedQuestion {
  question: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
}

export const TOOLBOX_STARTER_BANK: ToolboxSeedQuestion[] = [
  {
    question: 'What angle should an extension ladder be set at?',
    choices: ['3:1 — 1 foot out for every 3 up', '4:1 — 1 foot out for every 4 up', '5:1 — 1 foot out for every 5 up', 'Whatever feels stable'],
    correctIndex: 1,
    explanation: 'The 4-to-1 rule: for every 4 feet of working height, the base sits 1 foot from the wall.',
  },
  {
    question: 'In construction, fall protection is generally required at what height?',
    choices: ['4 feet', '6 feet', '10 feet', '12 feet'],
    correctIndex: 1,
    explanation: 'OSHA requires fall protection at 6 feet in construction (4 feet in general industry).',
  },
  {
    question: 'A trench must have a protective system (sloping, shoring, or a box) at what depth?',
    choices: ['3 feet', '4 feet', '5 feet', '6 feet'],
    correctIndex: 2,
    explanation: 'At 5 feet deep, a protective system is required unless the trench is entirely in stable rock.',
  },
  {
    question: 'What does GFCI protection actually do?',
    choices: ['Prevents overloads', 'Trips when current leaks to ground', 'Boosts voltage on long runs', 'Stops arc faults inside walls'],
    correctIndex: 1,
    explanation: 'A GFCI compares outgoing and returning current and trips fast when some of it leaks — like through you.',
  },
  {
    question: 'A Class C fire extinguisher is for…',
    choices: ['Wood and paper', 'Flammable liquids', 'Energized electrical equipment', 'Combustible metals'],
    correctIndex: 2,
    explanation: 'C = energized electrical. Kill the power first when you can — then it becomes a Class A or B fire.',
  },
  {
    question: 'Lockout/tagout exists to protect you from…',
    choices: ['Theft of tools', 'Unexpected energization or startup', 'Weather exposure', 'Falling loads'],
    correctIndex: 1,
    explanation: 'LOTO isolates hazardous energy so equipment can’t start or release stored energy while you’re working on it.',
  },
  {
    question: 'How far must a portable ladder extend above the landing surface you’re climbing to?',
    choices: ['1 foot', '2 feet', '3 feet', '5 feet'],
    correctIndex: 2,
    explanation: '3 feet above the landing — so you have something to hold on to as you step off.',
  },
  {
    question: 'When rigging a load, who is the ONE person allowed to signal the crane operator?',
    choices: ['Anyone on the crew', 'The designated signal person', 'The site superintendent', 'Whoever sees a problem'],
    correctIndex: 1,
    explanation: 'One designated signal person — with one exception: ANYONE can give an emergency stop.',
  },
  {
    question: 'What’s the maximum safe working load rule for a sling you can’t find the tag on?',
    choices: ['Estimate from its size', 'Half of what it looks rated for', 'Do not use it', 'Use it for light loads only'],
    correctIndex: 2,
    explanation: 'No tag, no lift. A sling without a legible capacity tag comes out of service. Period.',
  },
  {
    question: 'Hard hats have a service life. When must one be replaced immediately, regardless of age?',
    choices: ['After any impact', 'When the paint fades', 'Every winter', 'When the brim warps in the sun'],
    correctIndex: 0,
    explanation: 'One impact can compromise the shell even if it looks fine. Sun damage and cracking also retire it.',
  },
  {
    question: 'Extension cords on site must be…',
    choices: ['Any household cord', 'Rated for hard or extra-hard usage', 'Under 25 feet', 'Taped at every joint'],
    correctIndex: 1,
    explanation: 'Job sites require hard/extra-hard usage cords (look for S, ST, SO, STO types) — household zip cord has no place there.',
  },
  {
    question: 'Before entering a permit-required confined space, the atmosphere must be tested for…',
    choices: ['Temperature only', 'Oxygen, flammables, then toxics — in that order', 'Noise levels', 'Dust only'],
    correctIndex: 1,
    explanation: 'Test oxygen first, then flammable gases, then toxic contaminants — the meter sequence matters.',
  },
  {
    question: 'A competent person on site is someone who…',
    choices: ['Has 10+ years in the trade', 'Can identify hazards AND has authority to fix them', 'Passed OSHA 30', 'Is the oldest on the crew'],
    correctIndex: 1,
    explanation: 'Two parts: able to identify existing and predictable hazards, and authorized to take prompt corrective action.',
  },
  {
    question: 'Scaffold planking must be able to support its own weight plus at least…',
    choices: ['2x the intended load', '3x the intended load', '4x the intended load', '6x the intended load'],
    correctIndex: 2,
    explanation: 'Scaffolds and their components must support at least 4 times the maximum intended load.',
  },
  {
    question: 'When should you inspect a fall-arrest harness?',
    choices: ['Monthly', 'Before each use', 'Annually with documentation only', 'After a fall only'],
    correctIndex: 1,
    explanation: 'Inspect before every use — plus formal periodic inspections. After ANY fall arrest, the whole system is retired.',
  },
  {
    question: 'The minimum safe distance for most equipment working near 50kV power lines is…',
    choices: ['5 feet', '10 feet', '15 feet', '25 feet'],
    correctIndex: 1,
    explanation: '10 feet minimum up to 50kV, and it grows with voltage. When in doubt, call the utility and get lines de-energized.',
  },
  {
    question: 'Silica dust exposure on site is controlled first by…',
    choices: ['Paper dust masks', 'Wet cutting / dust collection at the source', 'Working upwind', 'Shorter shifts'],
    correctIndex: 1,
    explanation: 'Engineering controls first — water or vacuum at the point of cutting/grinding. Respirators are the backup, not the plan.',
  },
  {
    question: 'What does a yellow tag on equipment or a barricade generally mean?',
    choices: ['Do not enter under any circumstances', 'Caution — hazard may exist, proceed with awareness', 'Equipment is new', 'Inspection passed'],
    correctIndex: 1,
    explanation: 'Yellow = caution. Red = danger/do-not-enter. Know your site’s tag and barricade color system.',
  },
  {
    question: 'Housekeeping is a safety item because most site injuries from it are…',
    choices: ['Cuts', 'Slips, trips, and falls', 'Burns', 'Hearing damage'],
    correctIndex: 1,
    explanation: 'Slips, trips, and falls are a top injury class — clear walkways, coiled cords, and stacked material prevent them.',
  },
  {
    question: 'When two workers carry a long load like pipe or lumber, who calls the moves?',
    choices: ['The one in front', 'The one in back', 'Both equally', 'Whoever is senior'],
    correctIndex: 0,
    explanation: 'The lead sets the pace and calls obstacles — the rear can’t see what’s coming.',
  },
  {
    question: 'Hearing protection is required when the 8-hour average noise exposure hits…',
    choices: ['80 dB', '85 dB', '90 dB', '100 dB'],
    correctIndex: 2,
    explanation: 'OSHA’s PEL is 90 dB over 8 hours (a hearing conservation program kicks in at 85). If you must shout at arm’s length, protect your ears.',
  },
  {
    question: 'A damaged power tool cord gets…',
    choices: ['Electrical tape', 'Tagged out of service until repaired', 'Used for short jobs only', 'Cut shorter past the damage'],
    correctIndex: 1,
    explanation: 'Tag it out. Field-taped cords hide conductor damage; repair means proper replacement, not tape.',
  },
  {
    question: 'The safest way to break a habit of working under a suspended load is…',
    choices: ['Move fast underneath', 'Never be under one — plan travel paths around lifts', 'Wear a hard hat', 'Watch the rigging closely'],
    correctIndex: 1,
    explanation: 'No PPE protects against a dropped load. Plan lifts so nobody is ever in the fall zone.',
  },
  {
    question: 'Heat illness on site escalates in what order?',
    choices: ['Stroke → exhaustion → cramps', 'Cramps → exhaustion → stroke', 'Exhaustion → cramps → stroke', 'They’re unrelated conditions'],
    correctIndex: 1,
    explanation: 'Cramps, then exhaustion, then stroke — and heat stroke kills. Water, shade, rest, and watch your crew.',
  },
];
