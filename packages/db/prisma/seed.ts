import { PrismaClient } from '../src/generated/client/index.js';

const prisma = new PrismaClient();

const TRADES: { name: string; slug: string; isPopular: boolean }[] = [
  // ── Popular trades (original 12) ──────────────────────────────────────
  { name: 'Electrician', slug: 'electrician', isPopular: true },
  { name: 'Plumber', slug: 'plumber', isPopular: true },
  { name: 'HVAC/Refrigeration', slug: 'hvac', isPopular: true },
  { name: 'Carpenter', slug: 'carpenter', isPopular: true },
  { name: 'Welder', slug: 'welder', isPopular: true },
  { name: 'Pipefitter', slug: 'pipefitter', isPopular: true },
  { name: 'Ironworker', slug: 'ironworker', isPopular: true },
  { name: 'Concrete', slug: 'concrete', isPopular: true },
  { name: 'Roofer', slug: 'roofer', isPopular: true },
  { name: 'Trucker/CDL', slug: 'trucker-cdl', isPopular: true },
  { name: 'Heavy Equipment', slug: 'heavy-equipment', isPopular: true },
  { name: 'General Labor', slug: 'general-labor', isPopular: true },

  // ── Additional BLS-based trades ───────────────────────────────────────
  { name: 'Electrical Lineman', slug: 'electrical-lineman', isPopular: false },
  { name: 'Electronics Technician', slug: 'electronics-tech', isPopular: false },
  { name: 'Elevator Mechanic', slug: 'elevator-mechanic', isPopular: false },
  { name: 'Fire Sprinkler Fitter', slug: 'sprinkler-fitter', isPopular: false },
  { name: 'Glazier', slug: 'glazier', isPopular: false },
  { name: 'Insulation Worker', slug: 'insulation', isPopular: false },
  { name: 'Machinist', slug: 'machinist', isPopular: false },
  { name: 'Mason/Bricklayer', slug: 'mason', isPopular: false },
  { name: 'Millwright', slug: 'millwright', isPopular: false },
  { name: 'Painter', slug: 'painter', isPopular: false },
  { name: 'Plasterer/Stucco', slug: 'plasterer', isPopular: false },
  { name: 'Sheet Metal Worker', slug: 'sheet-metal', isPopular: false },
  { name: 'Steamfitter', slug: 'steamfitter', isPopular: false },
  { name: 'Telecommunications Tech', slug: 'telecom-tech', isPopular: false },
  { name: 'Tile/Marble Setter', slug: 'tile-setter', isPopular: false },
  { name: 'Boilermaker', slug: 'boilermaker', isPopular: false },
  { name: 'Drywall Installer', slug: 'drywall', isPopular: false },
  { name: 'Floor Layer', slug: 'floor-layer', isPopular: false },
  { name: 'Fence Erector', slug: 'fence-erector', isPopular: false },
  { name: 'Hazmat Removal', slug: 'hazmat', isPopular: false },
  { name: 'Highway Maintenance', slug: 'highway-maint', isPopular: false },
  { name: 'Landscaper/Groundskeeper', slug: 'landscaper', isPopular: false },
  { name: 'Paving Equipment Operator', slug: 'paving', isPopular: false },
  { name: 'Pile Driver', slug: 'pile-driver', isPopular: false },
  { name: 'Scaffold Erector', slug: 'scaffold', isPopular: false },
  { name: 'Solar Installer', slug: 'solar-installer', isPopular: false },
  { name: 'Surveyor', slug: 'surveyor', isPopular: false },
  { name: 'Well Driller', slug: 'well-driller', isPopular: false },
  // "Other" — the post-job form reveals a free-text field when picked
  // (stored on jobs.trade_other).
  { name: 'Other', slug: 'other', isPopular: false },
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

  // ── Additional trades ────────────────────────────────────────────────
  'electrical-lineman': [
    'Overhead line construction',
    'Underground cable splicing',
    'Transformer installation',
    'Hot-stick live-line work',
    'Pole climbing / bucket truck',
  ],
  'electronics-tech': [
    'Circuit board repair',
    'PLC programming',
    'Instrumentation calibration',
    'Control panel wiring',
    'Schematic reading',
  ],
  'elevator-mechanic': [
    'Traction elevator maintenance',
    'Hydraulic elevator service',
    'Escalator repair',
    'Modernization / retrofit',
    'Code compliance inspection',
  ],
  'sprinkler-fitter': [
    'Wet-pipe system install',
    'Dry-pipe system install',
    'Standpipe systems',
    'Fire pump maintenance',
    'Hydraulic calculations',
  ],
  glazier: [
    'Curtain wall installation',
    'Storefront glazing',
    'Tempered/laminated glass cutting',
    'Mirror installation',
    'Skylight installation',
  ],
  insulation: [
    'Mechanical pipe insulation',
    'Fiberglass batt installation',
    'Spray foam application',
    'Fire-stop systems',
    'Asbestos abatement',
  ],
  machinist: [
    'CNC lathe operation',
    'CNC mill operation',
    'Manual machining',
    'Precision measurement / GD&T',
    'Tool and die making',
  ],
  mason: [
    'Block laying',
    'Brick laying',
    'Stone veneer',
    'Tuckpointing / repointing',
    'Blueprint reading',
  ],
  millwright: [
    'Machinery installation',
    'Precision shaft alignment',
    'Conveyor system maintenance',
    'Rigging and hoisting',
    'Preventive maintenance programs',
  ],
  painter: [
    'Interior painting',
    'Exterior painting',
    'Industrial coatings',
    'Spray application (HVLP/airless)',
    'Surface preparation / blasting',
  ],
  plasterer: [
    'Interior plaster application',
    'Exterior stucco (3-coat)',
    'EIFS installation',
    'Ornamental plaster molds',
    'Lath and scratch coat',
  ],
  'sheet-metal': [
    'HVAC duct fabrication',
    'Architectural sheet metal',
    'Plasma / laser cutting',
    'Soldering and brazing',
    'Blueprint reading',
  ],
  steamfitter: [
    'High-pressure steam systems',
    'Chilled water piping',
    'Process piping',
    'Pipe welding (SMAW/GTAW)',
    'Blueprint reading',
  ],
  'telecom-tech': [
    'Fiber optic splicing',
    'Structured cabling (Cat6/Cat6A)',
    'Tower climbing / antenna install',
    'OTDR testing',
    'Network rack build-out',
  ],
  'tile-setter': [
    'Ceramic / porcelain tile install',
    'Natural stone installation',
    'Waterproof membrane systems',
    'Large-format tile layout',
    'Grout and caulk finishing',
  ],
  boilermaker: [
    'Boiler tube replacement',
    'Pressure vessel fabrication',
    'Refractory installation',
    'Structural plate welding',
    'Hydrostatic testing',
  ],
  drywall: [
    'Hanging / boarding',
    'Taping and finishing',
    'Metal stud framing',
    'Fire-rated assemblies',
    'Texture application',
  ],
  'floor-layer': [
    'Hardwood floor installation',
    'Vinyl / LVP installation',
    'Carpet installation',
    'Subfloor preparation',
    'Floor sanding and finishing',
  ],
  'fence-erector': [
    'Chain-link fence installation',
    'Wood fence construction',
    'Ornamental iron fencing',
    'Post-hole augering',
    'Gate and hardware installation',
  ],
  hazmat: [
    'Asbestos abatement',
    'Lead paint removal',
    'Mold remediation',
    'Decontamination procedures',
    'Regulatory compliance (EPA/OSHA)',
  ],
  'highway-maint': [
    'Pavement patching',
    'Guardrail installation',
    'Signage and striping',
    'Snow/ice removal operations',
    'Traffic control setup',
  ],
  landscaper: [
    'Irrigation system install',
    'Hardscape / paver installation',
    'Grading and drainage',
    'Tree and shrub care',
    'Lawn maintenance equipment',
  ],
  paving: [
    'Asphalt paver operation',
    'Roller / compactor operation',
    'Milling machine operation',
    'Grade checking / laser control',
    'Hot-mix asphalt placement',
  ],
  'pile-driver': [
    'Impact hammer driving',
    'Vibratory hammer driving',
    'Caisson drilling',
    'Sheet pile installation',
    'Load testing',
  ],
  scaffold: [
    'Tube-and-clamp scaffold erection',
    'System scaffold assembly',
    'Suspended scaffold rigging',
    'Scaffold inspection',
    'Fall protection systems',
  ],
  'solar-installer': [
    'Rooftop PV panel mounting',
    'Ground-mount racking',
    'Inverter installation',
    'DC string wiring',
    'System commissioning',
  ],
  surveyor: [
    'Total station operation',
    'GPS/GNSS surveying',
    'Construction staking',
    'Boundary surveys',
    'Topographic mapping',
  ],
  'well-driller': [
    'Rotary drilling',
    'Cable-tool drilling',
    'Well casing installation',
    'Pump installation / service',
    'Water quality sampling',
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
      update: { name: t.name, isPopular: t.isPopular },
      create: { name: t.name, slug: t.slug, isPopular: t.isPopular },
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
