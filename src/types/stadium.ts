export type SeatTier = 'Lower' | 'Club' | 'Upper';

export type SeatStatus = 'available' | 'selected' | 'held' | 'booked';

export interface SectionDefinition {
  id: string;
  name: string;
  shortLabel: string;
  tier: SeatTier;
  index: number;
  totalSectionsInTier: number;
  startAngle: number;
  endAngle: number;
  centerAngle: number;
  rows: number;
  seatsPerRow: number;
  totalSeats: number;
  minPrice: number;
  maxPrice: number;
  basePriceMultiplier: number;
  /** Center point of the section for camera framing */
  centerPoint: { x: number; y: number; z: number };
  /** Ideal camera vantage point when inspecting this section */
  cameraPosition: { x: number; y: number; z: number };
  /** Look-at target when framing this section */
  cameraTarget: { x: number; y: number; z: number };
}

export interface SeatRecord {
  /** Index inside the InstancedMesh (0..14063) */
  instanceIndex: number;
  id: string;
  sectionId: string;
  sectionName: string;
  tier: SeatTier;
  row: number;
  seatNumber: number;
  worldPosition: { x: number; y: number; z: number };
  facingAngle: number;
  basePrice: number;
}

export interface EventRecord {
  id: string;
  title: string;
  homeTeam: string;
  awayTeam: string;
  homeColor: string;
  awayColor: string;
  date: string;
  time: string;
  stadiumName: string;
  category: string;
  description: string;
  imageUrl: string;
  status: 'on_sale' | 'selling_fast' | 'sold_out' | 'draft';
  isDemoData: boolean;
  priceMultiplier: number;
}

export interface SeatStateDelta {
  heldByMe: string[];
  heldByOthers: string[];
  booked: string[];
  holdExpiresAt: Record<string, number>;
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: 'user' | 'admin';
}

export interface TicketRecord {
  id: string;
  ticketCode: string;
  bookingId: string;
  bookingReference: string;
  eventId: string;
  eventTitle: string;
  homeTeam: string;
  awayTeam: string;
  eventDate: string;
  eventTime: string;
  stadiumName: string;
  seatId: string;
  sectionId: string;
  sectionName: string;
  tier: SeatTier;
  row: number;
  seatNumber: number;
  pricePaid: number;
  seatSnapshotDataUrl: string | null;
  qrPayload: string;
  issuedAt: string;
  holderName: string;
}

export interface BookingRecord {
  id: string;
  bookingReference: string;
  userId: string;
  userEmail: string;
  userName: string;
  eventId: string;
  eventTitle: string;
  seatIds: string[];
  totalAmount: number;
  currency: string;
  status: 'pending' | 'confirmed' | 'failed' | 'cancelled';
  paymentProvider: 'razorpay' | 'sandbox';
  paymentId: string | null;
  createdAt: string;
  tickets: TicketRecord[];
}
