import { PrismaClient } from '../src/generated/client/index.js';

const prisma = new PrismaClient();

const TRADES = [
  { name: 'Electrician', slug: 'electrician' },
  { name: 'Plumber', slug: 'plumber' },
  { name: 'HVAC/Refrigeration', slug: 'hvac' },
  { name: 'Carpenter', slug: 'carpenter' },
  { name: 'Welder', slug: 'welder' },
  { name: 'Pipefitter', slug: 'pipefitter' },
  { name: 'Ironworker', slug: 'ironworker' },
  { name: 'Concrete', slug: 'concrete' },
  { name: 'Roofer', slug: 'roofer' },
  { name: 'Trucker/CDL', slug: 'trucker-cdl' },
  { name: 'Heavy Equipment', slug: 'heavy-equipment' },
  { name: 'General Labor', slug: 'general-labor' },
];

// Per-trade skills (mockup screen 3B shows the electrician set; rest are
// reasonable starter skills derived from trade categories).
const SKILLS_BY_TRADE: Record<string, string[]> = {
  electrician: [
    'Panel upgrades',
    'Commercial wiring',
    'Service calls',
    'New construction',
    'Conduit bending',
    'Low voltage',
    'EV charger install',
    'Troubleshooting',
    'Motor controls',
    'Blueprint reading',
    'Solar/PV',
    'Generator systems',
  ],
  plumber: [
    'Service calls',
    'New construction',
    'Repipes',
    'Drain cleaning',
    'Water heater install',
    'Gas line install',
    'Backflow testing',
    'Hydronic heating',
    'Commercial plumbing',
    'Blueprint reading',
  ],
  hvac: [
    'Residential install',
    'Commercial install',
    'Service calls',
    'Refrigeration',
    'Heat pump install',
    'Ductwork fabrication',
    'EPA 608 work',
    'Boiler service',
    'Controls/BMS',
    'Blueprint reading',
  ],
  carpenter: [
    'Rough framing',
    'Finish carpentry',
    'Cabinetry',
    'Trim/molding',
    'Concrete forms',
    'Stair building',
    'Door/window install',
    'Drywall',
    'Blueprint reading',
  ],
  welder: [
    'Stick (SMAW)',
    'MIG (GMAW)',
    'TIG (GTAW)',
    'Flux core (FCAW)',
    'Pipe welding',
    'Structural welding',
    'Aluminum welding',
    'Stainless welding',
    'Blueprint reading',
  ],
  pipefitter: [
    'Industrial pipefitting',
    'Steam systems',
    'Hydronic systems',
    'Process piping',
    'Pipe welding',
    'Blueprint reading',
    'Rigging',
  ],
  ironworker: [
    'Structural steel erection',
    'Reinforcing (rebar)',
    'Ornamental ironwork',
    'Welding',
    'Rigging',
    'Bolt-up',
    'Blueprint reading',
  ],
  concrete: [
    'Form work',
    'Flatwork finishing',
    'Foundations',
    'Tilt-up panels',
    'Stamped concrete',
    'Rebar tying',
    'Blueprint reading',
  ],
  roofer: [
    'Asphalt shingle',
    'Metal roofing',
    'TPO/EPDM',
    'Built-up roofing',
    'Tile/slate',
    'Roof tear-off',
    'Flashing/detailing',
  ],
  'trucker-cdl': [
    'CDL Class A',
    'CDL Class B',
    'Hazmat endorsement',
    'Tanker endorsement',
    'Doubles/triples',
    'Flatbed/securement',
    'Heavy haul',
    'Long haul / OTR',
  ],
  'heavy-equipment': [
    'Excavator operation',
    'Bulldozer operation',
    'Skid steer operation',
    'Backhoe operation',
    'Crane operation',
    'Forklift operation',
    'Grader operation',
    'Site grading',
  ],
  'general-labor': [
    'Demolition',
    'Site cleanup',
    'Material handling',
    'Hand tools',
    'Power tools',
    'OSHA-10 / OSHA-30',
    'First aid / CPR',
    'Forklift',
  ],
};

const BENEFITS = [
  'Health insurance',
  'Paid OT after 40hr',
  'Paid holidays',
  'Dental & vision',
  '401(k)/pension',
  'Per diem',
  'Union eligible',
  'Tool allowance',
  'Relocation assist',
];

async function main() {
  // Trades
  const tradeBySlug = new Map<string, number>();
  for (const t of TRADES) {
    const trade = await prisma.trade.upsert({
      where: { slug: t.slug },
      update: { name: t.name },
      create: t,
    });
    tradeBySlug.set(t.slug, trade.id);
  }

  // Skills (deduplicated by name+tradeId via @@unique in schema)
  let skillCount = 0;
  for (const [slug, skillNames] of Object.entries(SKILLS_BY_TRADE)) {
    const tradeId = tradeBySlug.get(slug);
    if (!tradeId) continue;
    for (const name of skillNames) {
      await prisma.skill.upsert({
        where: { name_tradeId: { name, tradeId } },
        update: {},
        create: { name, tradeId },
      });
      skillCount++;
    }
  }

  // Benefits
  for (const name of BENEFITS) {
    await prisma.benefit.upsert({ where: { name }, update: {}, create: { name } });
  }

  console.log(
    `Seeded ${TRADES.length} trades, ${skillCount} skills, ${BENEFITS.length} benefits.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
