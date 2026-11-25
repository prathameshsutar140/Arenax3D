import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { BookingRecord, EventRecord, SeatStateDelta, TicketRecord, UserProfile } from '../src/types/stadium';
import { getStadiumLayout } from '../src/utils/stadiumLayout';

export interface StoredUser extends UserProfile {
  passwordHash: string;
  createdAt: string;
}

export interface SeatHoldEntry {
  seatId: string;
  sessionId: string;
  userId?: string;
  expiresAt: number;
}

export interface PaymentOrderEntry {
  orderId: string;
  bookingId: string;
  userId: string;
  eventId: string;
  seatIds: string[];
  amount: number;
  currency: string;
  provider: 'razorpay' | 'sandbox';
  status: 'created' | 'verified' | 'failed';
  createdAt: string;
  paymentId?: string;
}

export interface StoreState {
  sportVersion?: string;
  users: StoredUser[];
  adminCredentialHash: string | null;
  events: EventRecord[];
  sectionMultipliers: Record<string, number>;
  /** eventId -> array of booked seatIds */
  bookedSeatsByEvent: Record<string, string[]>;
  /** eventId -> seatId -> SeatHoldEntry */
  seatHoldsByEvent: Record<string, Record<string, SeatHoldEntry>>;
  bookings: BookingRecord[];
  orders: Record<string, PaymentOrderEntry>;
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const STORE_FILE = path.join(DATA_DIR, 'arenax-store.json');

export const HOLD_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, originalHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const original = Buffer.from(originalHex, 'hex');
  if (derived.length !== original.length) return false;
  return crypto.timingSafeEqual(derived, original);
}

function createInitialEvents(): EventRecord[] {
  return [
    {
      id: 'evt-t20-elclasico-2026',
      title: 'Premier T20 Clash: Mumbai Mavericks vs Chennai Kings',
      homeTeam: 'Mumbai Mavericks',
      awayTeam: 'Chennai Kings',
      homeColor: '#3B82F6',
      awayColor: '#F59E0B',
      date: '2026-12-14',
      time: '19:30 IST',
      stadiumName: 'ArenaX Cricket Stadium · Mumbai',
      category: 'Premier T20 League',
      description:
        'Demonstration Event — Under-the-lights T20 rivalry with 360° sightlines to the 22-yard pitch, straight sightscreens, and live boundary LED ribbons.',
      imageUrl: '/src/assets/images/event_cricket_t20_derby_1795594096802.jpg',
      status: 'selling_fast',
      isDemoData: true,
      priceMultiplier: 1.0,
    },
    {
      id: 'evt-ind-odi-2026',
      title: 'International ODI Series: India Blue vs Southern Stars',
      homeTeam: 'India Blue',
      awayTeam: 'Southern Stars',
      homeColor: '#06B6D4',
      awayColor: '#10B981',
      date: '2026-12-21',
      time: '14:30 IST',
      stadiumName: 'ArenaX Cricket Stadium · Ahmedabad',
      category: 'International ODI',
      description:
        'Demonstration Event — Full 50-over day-night bilateral clash featuring North Pavilion boxes, East & West square stands, and dynamic seat pricing.',
      imageUrl: '/src/assets/images/event_cricket_odi_cup_1795594096835.jpg',
      status: 'on_sale',
      isDemoData: true,
      priceMultiplier: 1.15,
    },
    {
      id: 'evt-t20-finale-2027',
      title: 'Champions T20 Night Finale: Bengaluru Royals vs Kolkata Knights',
      homeTeam: 'Bengaluru Royals',
      awayTeam: 'Kolkata Knights',
      homeColor: '#EF4444',
      awayColor: '#8B5CF6',
      date: '2027-01-10',
      time: '19:30 IST',
      stadiumName: 'ArenaX Cricket Stadium · Bengaluru',
      category: 'Champions T20 Finale',
      description:
        'Demonstration Event — High-voltage championship night under towering floodlight pylons with boundary cushion and upper-tier value seating.',
      imageUrl: '/src/assets/images/event_cricket_championship_1795594097085.jpg',
      status: 'on_sale',
      isDemoData: true,
      priceMultiplier: 0.9,
    },
  ];
}

function seedDemoBookedSeats(eventId: string, ratio: number): string[] {
  const layout = getStadiumLayout();
  const booked: string[] = [];
  // Deterministic pseudo-random pattern so every launch looks crisp & realistic
  let seed = 0;
  for (let i = 0; i < eventId.length; i++) {
    seed = (seed * 31 + eventId.charCodeAt(i)) >>> 0;
  }
  for (let i = 0; i < layout.seats.length; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const val = (seed % 1000) / 1000;
    // Slightly higher occupancy in Lower & Club sideline rows
    const seat = layout.seats[i];
    const rowBonus = seat.row <= 4 ? 0.08 : 0;
    if (val < ratio + rowBonus) {
      booked.push(seat.id);
    }
  }
  return booked;
}

function createInitialStore(): StoreState {
  const layout = getStadiumLayout();
  const sectionMultipliers: Record<string, number> = {};
  for (const sec of layout.sections) {
    sectionMultipliers[sec.id] = 1.0;
  }

  const events = createInitialEvents();
  const bookedSeatsByEvent: Record<string, string[]> = {
    'evt-t20-elclasico-2026': seedDemoBookedSeats('evt-t20-elclasico-2026', 0.16),
    'evt-ind-odi-2026': seedDemoBookedSeats('evt-ind-odi-2026', 0.10),
    'evt-t20-finale-2027': seedDemoBookedSeats('evt-t20-finale-2027', 0.07),
  };

  return {
    sportVersion: 'cricket-v1',
    users: [],
    adminCredentialHash: null,
    events,
    sectionMultipliers,
    bookedSeatsByEvent,
    seatHoldsByEvent: {},
    bookings: [],
    orders: {},
  };
}

class ArenaStore {
  private state: StoreState;

  constructor() {
    this.state = this.load();
  }

  private load(): StoreState {
    try {
      if (fs.existsSync(STORE_FILE)) {
        const raw = fs.readFileSync(STORE_FILE, 'utf8');
        const parsed = JSON.parse(raw) as StoreState;
        if (
          parsed &&
          parsed.sportVersion === 'cricket-v1' &&
          Array.isArray(parsed.events) &&
          parsed.bookedSeatsByEvent
        ) {
          return parsed;
        }
      }
    } catch (err) {
      console.warn('Could not read existing ArenaX store, initializing fresh store:', err);
    }
    const fresh = createInitialStore();
    this.saveState(fresh);
    return fresh;
  }

  private saveState(stateToWrite: StoreState = this.state): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const tmp = `${STORE_FILE}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(stateToWrite), 'utf8');
      fs.renameSync(tmp, STORE_FILE);
    } catch (err) {
      console.error('Failed to persist store:', err);
    }
  }

  public save(): void {
    this.saveState(this.state);
  }

  public getState(): StoreState {
    return this.state;
  }

  public cleanupExpiredHolds(eventId?: string): Array<{ eventId: string; seatIds: string[] }> {
    const now = Date.now();
    const released: Array<{ eventId: string; seatIds: string[] }> = [];
    const targetEvents = eventId ? [eventId] : Object.keys(this.state.seatHoldsByEvent);

    let changed = false;
    for (const evtId of targetEvents) {
      const holds = this.state.seatHoldsByEvent[evtId];
      if (!holds) continue;
      const expiredIds: string[] = [];
      for (const [seatId, entry] of Object.entries(holds)) {
        if (entry.expiresAt <= now) {
          expiredIds.push(seatId);
          delete holds[seatId];
          changed = true;
        }
      }
      if (expiredIds.length > 0) {
        released.push({ eventId: evtId, seatIds: expiredIds });
      }
    }

    if (changed) {
      this.save();
    }
    return released;
  }

  public getSeatDelta(eventId: string, sessionId: string): SeatStateDelta {
    this.cleanupExpiredHolds(eventId);
    const booked = this.state.bookedSeatsByEvent[eventId] ?? [];
    const holds = this.state.seatHoldsByEvent[eventId] ?? {};
    const heldByMe: string[] = [];
    const heldByOthers: string[] = [];
    const holdExpiresAt: Record<string, number> = {};

    for (const [seatId, entry] of Object.entries(holds)) {
      holdExpiresAt[seatId] = entry.expiresAt;
      if (entry.sessionId === sessionId) {
        heldByMe.push(seatId);
      } else {
        heldByOthers.push(seatId);
      }
    }

    return { heldByMe, heldByOthers, booked, holdExpiresAt };
  }

  public computeSeatPrice(eventId: string, seatId: string): number {
    const layout = getStadiumLayout();
    const seat = layout.seatById.get(seatId);
    if (!seat) throw new Error(`Unknown seat: ${seatId}`);
    const event = this.state.events.find((e) => e.id === eventId);
    const eventMult = event?.priceMultiplier ?? 1.0;
    const secMult = this.state.sectionMultipliers[seat.sectionId] ?? 1.0;
    return Math.round(seat.basePrice * eventMult * secMult);
  }

  public holdSeats(
    eventId: string,
    seatIds: string[],
    sessionId: string,
    userId?: string,
  ): { ok: true; expiresAt: number } | { ok: false; conflicts: string[]; reason: string } {
    this.cleanupExpiredHolds(eventId);
    const layout = getStadiumLayout();
    const bookedSet = new Set(this.state.bookedSeatsByEvent[eventId] ?? []);
    const holds = (this.state.seatHoldsByEvent[eventId] ??= {});

    const conflicts: string[] = [];
    for (const id of seatIds) {
      if (!layout.seatById.has(id)) {
        return { ok: false, conflicts: [id], reason: `Seat ${id} does not exist.` };
      }
      if (bookedSet.has(id)) {
        conflicts.push(id);
      } else if (holds[id] && holds[id].sessionId !== sessionId) {
        conflicts.push(id);
      }
    }

    if (conflicts.length > 0) {
      return {
        ok: false,
        conflicts,
        reason: 'One or more selected seats are already reserved or booked.',
      };
    }

    // Release any previous holds held by this session for this event that are NOT in the new list
    const nextSet = new Set(seatIds);
    for (const [existingId, entry] of Object.entries(holds)) {
      if (entry.sessionId === sessionId && !nextSet.has(existingId)) {
        delete holds[existingId];
      }
    }

    const expiresAt = Date.now() + HOLD_TTL_MS;
    for (const id of seatIds) {
      holds[id] = { seatId: id, sessionId, userId, expiresAt };
    }

    this.save();
    return { ok: true, expiresAt };
  }

  public releaseSessionHolds(eventId: string, sessionId: string, seatIds?: string[]): string[] {
    const holds = this.state.seatHoldsByEvent[eventId];
    if (!holds) return [];
    const released: string[] = [];
    for (const [seatId, entry] of Object.entries(holds)) {
      if (entry.sessionId === sessionId && (!seatIds || seatIds.includes(seatId))) {
        delete holds[seatId];
        released.push(seatId);
      }
    }
    if (released.length > 0) this.save();
    return released;
  }

  public confirmBookingFromOrder(
    orderId: string,
    paymentId: string,
    seatSnapshots: Record<string, string>,
    holderName: string,
  ): { ok: true; booking: BookingRecord } | { ok: false; error: string } {
    const order = this.state.orders[orderId];
    if (!order) return { ok: false, error: 'Payment order not found.' };
    if (order.status === 'verified') {
      const existing = this.state.bookings.find((b) => b.id === order.bookingId);
      if (existing) return { ok: true, booking: existing };
    }

    this.cleanupExpiredHolds(order.eventId);
    const booked = (this.state.bookedSeatsByEvent[order.eventId] ??= []);
    const bookedSet = new Set(booked);
    for (const seatId of order.seatIds) {
      if (bookedSet.has(seatId)) {
        order.status = 'failed';
        this.save();
        return { ok: false, error: `Seat ${seatId} was already booked.` };
      }
    }

    const event = this.state.events.find((e) => e.id === order.eventId);
    const user = this.state.users.find((u) => u.id === order.userId);
    if (!event || !user) {
      return { ok: false, error: 'Event or user profile not found.' };
    }

    const layout = getStadiumLayout();
    const bookingReference = `ARX-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const issuedAt = new Date().toISOString();

    const tickets: TicketRecord[] = order.seatIds.map((seatId) => {
      const seat = layout.seatById.get(seatId)!;
      const ticketCode = `TKT-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
      // QR contains only cryptographic verification code & event/seat ref (zero PII)
      const qrSignature = crypto
        .createHmac('sha256', process.env.SESSION_SECRET || 'arenax-ticket-verify')
        .update(`${ticketCode}:${order.eventId}:${seatId}`)
        .digest('hex')
        .slice(0, 16);

      return {
        id: crypto.randomUUID(),
        ticketCode,
        bookingId: order.bookingId,
        bookingReference,
        eventId: event.id,
        eventTitle: event.title,
        homeTeam: event.homeTeam,
        awayTeam: event.awayTeam,
        eventDate: event.date,
        eventTime: event.time,
        stadiumName: event.stadiumName,
        seatId,
        sectionId: seat.sectionId,
        sectionName: seat.sectionName,
        tier: seat.tier,
        row: seat.row,
        seatNumber: seat.seatNumber,
        pricePaid: this.computeSeatPrice(event.id, seatId),
        seatSnapshotDataUrl: seatSnapshots[seatId] || null,
        qrPayload: JSON.stringify({
          v: 1,
          code: ticketCode,
          evt: event.id,
          seat: seatId,
          sig: qrSignature,
        }),
        issuedAt,
        holderName: holderName || user.fullName,
      };
    });

    const booking: BookingRecord = {
      id: order.bookingId,
      bookingReference,
      userId: user.id,
      userEmail: user.email,
      userName: user.fullName,
      eventId: event.id,
      eventTitle: event.title,
      seatIds: order.seatIds,
      totalAmount: order.amount,
      currency: order.currency,
      status: 'confirmed',
      paymentProvider: order.provider,
      paymentId,
      createdAt: issuedAt,
      tickets,
    };

    // Atomically mark seats booked & clear holds
    for (const seatId of order.seatIds) {
      booked.push(seatId);
      if (this.state.seatHoldsByEvent[order.eventId]) {
        delete this.state.seatHoldsByEvent[order.eventId][seatId];
      }
    }

    order.status = 'verified';
    order.paymentId = paymentId;
    this.state.bookings.unshift(booking);
    this.save();

    return { ok: true, booking };
  }
}

export const arenaStore = new ArenaStore();
