import type { SeatRecord, SeatTier, SectionDefinition } from '../types/stadium';

export interface TierConfig {
  tier: SeatTier;
  prefix: string;
  sectionCount: number;
  rows: number;
  seatsPerRow: number;
  rxStart: number;
  rzStart: number;
  rowDepth: number;
  rowRise: number;
  yStart: number;
  minBasePrice: number;
  maxBasePrice: number;
}

export const TIER_CONFIGS: TierConfig[] = [
  {
    tier: 'Lower',
    prefix: '1',
    sectionCount: 12,
    rows: 18,
    seatsPerRow: 24,
    rxStart: 49.0,
    rzStart: 43.0,
    rowDepth: 0.95,
    rowRise: 0.38,
    yStart: 1.2,
    minBasePrice: 4200,
    maxBasePrice: 11500,
  },
  {
    tier: 'Club',
    prefix: '2',
    sectionCount: 12,
    rows: 10,
    seatsPerRow: 26,
    rxStart: 67.5,
    rzStart: 61.5,
    rowDepth: 1.0,
    rowRise: 0.45,
    yStart: 9.4,
    minBasePrice: 2400,
    maxBasePrice: 4600,
  },
  {
    tier: 'Upper',
    prefix: '3',
    sectionCount: 16,
    rows: 15,
    seatsPerRow: 24,
    rxStart: 79.0,
    rzStart: 73.0,
    rowDepth: 0.98,
    rowRise: 0.56,
    yStart: 16.0,
    minBasePrice: 850,
    maxBasePrice: 1750,
  },
];

// Smooth oval geometry for an authentic cricket ground
const OVAL_EXP = 1.0;

export function stadiumCurvePoint(rx: number, rz: number, angle: number): { x: number; z: number } {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const x = Math.sign(cos) * Math.pow(Math.abs(cos), OVAL_EXP) * rx;
  const z = Math.sign(sin) * Math.pow(Math.abs(sin), OVAL_EXP) * rz;
  return { x, z };
}

function getCricketStandDescriptor(angleDeg: number): string {
  const a = ((angleDeg % 360) + 360) % 360;
  if (a >= 65 && a < 115) return 'South Sightscreen';
  if (a >= 245 && a < 295) return 'North Pavilion';
  if (a >= 335 || a < 25) return 'East Square';
  if (a >= 155 && a < 205) return 'West Square';
  return 'Mid-Wicket';
}

function isStraightPitchAngle(angle: number): boolean {
  // Straight down the pitch (North/South bowler's arm) carries a slight premium
  return Math.abs(Math.sin(angle)) > 0.78;
}

export interface GeneratedStadiumLayout {
  sections: SectionDefinition[];
  seats: SeatRecord[];
  seatById: Map<string, SeatRecord>;
  sectionById: Map<string, SectionDefinition>;
}

let cachedLayout: GeneratedStadiumLayout | null = null;

export function getStadiumLayout(): GeneratedStadiumLayout {
  if (cachedLayout) return cachedLayout;

  const sections: SectionDefinition[] = [];
  const seats: SeatRecord[] = [];
  const seatById = new Map<string, SeatRecord>();
  const sectionById = new Map<string, SectionDefinition>();

  let instanceIndex = 0;

  for (const cfg of TIER_CONFIGS) {
    const angleStep = (Math.PI * 2) / cfg.sectionCount;
    const aislePadding = cfg.tier === 'Upper' ? 0.02 : 0.026;

    for (let sIdx = 0; sIdx < cfg.sectionCount; sIdx++) {
      const sectionNum = `${cfg.prefix}${String(sIdx + 1).padStart(2, '0')}`;
      const startAngle = sIdx * angleStep;
      const endAngle = (sIdx + 1) * angleStep;
      const centerAngle = (startAngle + endAngle) * 0.5;
      const angleDeg = (centerAngle * 180) / Math.PI;
      const standZone = getCricketStandDescriptor(angleDeg);
      const tierLabel = cfg.tier === 'Lower' ? 'Lower' : cfg.tier === 'Club' ? 'Pavilion' : 'Upper';
      const sectionName = `${tierLabel} ${standZone} ${sectionNum}`;

      const straightPremium = isStraightPitchAngle(centerAngle) ? 1.12 : 1.0;

      const midRow = (cfg.rows - 1) * 0.5;
      const midRx = cfg.rxStart + midRow * cfg.rowDepth;
      const midRz = cfg.rzStart + midRow * cfg.rowDepth;
      const midPt = stadiumCurvePoint(midRx, midRz, centerAngle);
      const midY = cfg.yStart + midRow * cfg.rowRise;

      // Camera framing looks directly at this stand from inside the oval
      const camDistFactor = cfg.tier === 'Lower' ? 0.55 : cfg.tier === 'Club' ? 0.62 : 0.68;
      const camPt = stadiumCurvePoint(midRx * camDistFactor, midRz * camDistFactor, centerAngle);
      const camY = midY + (cfg.tier === 'Lower' ? 11.5 : cfg.tier === 'Club' ? 13.0 : 15.0);

      let secMinPrice = Infinity;
      let secMaxPrice = 0;

      for (let r = 0; r < cfg.rows; r++) {
        const rowNum = r + 1;
        const rx = cfg.rxStart + r * cfg.rowDepth;
        const rz = cfg.rzStart + r * cfg.rowDepth;
        const y = cfg.yStart + r * cfg.rowRise;

        const rowFactor = cfg.rows > 1 ? 1 - r / (cfg.rows - 1) : 1;
        const rawPrice =
          (cfg.minBasePrice + (cfg.maxBasePrice - cfg.minBasePrice) * Math.pow(rowFactor, 1.2)) *
          straightPremium;
        const rowPrice = Math.round(rawPrice / 50) * 50;
        if (rowPrice < secMinPrice) secMinPrice = rowPrice;
        if (rowPrice > secMaxPrice) secMaxPrice = rowPrice;

        const innerStart = startAngle + aislePadding;
        const innerEnd = endAngle - aislePadding;

        for (let k = 0; k < cfg.seatsPerRow; k++) {
          const seatNum = k + 1;
          const t = cfg.seatsPerRow > 1 ? (k + 0.5) / cfg.seatsPerRow : 0.5;
          const seatAngle = innerStart + (innerEnd - innerStart) * t;
          const pt = stadiumCurvePoint(rx, rz, seatAngle);
          // Facing inward toward center cricket pitch (0, 0)
          const facingAngle = Math.atan2(-pt.x, -pt.z);

          const seatId = `SEC${sectionNum}-R${String(rowNum).padStart(2, '0')}-S${String(seatNum).padStart(2, '0')}`;
          const seat: SeatRecord = {
            instanceIndex,
            id: seatId,
            sectionId: sectionNum,
            sectionName,
            tier: cfg.tier,
            row: rowNum,
            seatNumber: seatNum,
            worldPosition: { x: Number(pt.x.toFixed(3)), y: Number(y.toFixed(3)), z: Number(pt.z.toFixed(3)) },
            facingAngle,
            basePrice: rowPrice,
          };

          seats.push(seat);
          seatById.set(seatId, seat);
          instanceIndex++;
        }
      }

      const sectionDef: SectionDefinition = {
        id: sectionNum,
        name: sectionName,
        shortLabel: `Stand ${sectionNum}`,
        tier: cfg.tier,
        index: sIdx,
        totalSectionsInTier: cfg.sectionCount,
        startAngle,
        endAngle,
        centerAngle,
        rows: cfg.rows,
        seatsPerRow: cfg.seatsPerRow,
        totalSeats: cfg.rows * cfg.seatsPerRow,
        minPrice: secMinPrice,
        maxPrice: secMaxPrice,
        basePriceMultiplier: 1.0,
        centerPoint: { x: midPt.x, y: midY, z: midPt.z },
        cameraPosition: { x: camPt.x, y: camY, z: camPt.z },
        cameraTarget: { x: midPt.x * 0.92, y: midY + 0.5, z: midPt.z * 0.92 },
      };

      sections.push(sectionDef);
      sectionById.set(sectionNum, sectionDef);
    }
  }

  cachedLayout = { sections, seats, seatById, sectionById };
  return cachedLayout;
}
