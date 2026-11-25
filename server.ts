import crypto from 'crypto';
import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import http from 'http';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { WebSocket, WebSocketServer } from 'ws';
import { z } from 'zod';
import type { EventRecord, UserProfile } from './src/types/stadium';
import { getStadiumLayout } from './src/utils/stadiumLayout';
import { arenaStore, hashPassword, verifyPassword } from './server/store';

dotenv.config();

const PORT = 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

interface SessionTokenPayload {
  sub: string;
  email: string;
  fullName: string;
  role: 'user' | 'admin';
  exp: number;
}

function signToken(user: UserProfile): string {
  const payload: SessionTokenPayload = {
    sub: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyToken(token: string): SessionTokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionTokenPayload;
    if (!parsed.exp || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

interface AuthedRequest extends Request {
  authUser?: SessionTokenPayload;
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  const payload = verifyToken(header.slice(7));
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired session.' });
    return;
  }
  req.authUser = payload;
  next();
}

function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (req.authUser?.role !== 'admin') {
      res.status(403).json({ error: 'Administrator privileges required.' });
      return;
    }
    next();
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '6mb' }));

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  // Track room subscriptions by eventId
  const clientRooms = new Map<WebSocket, string>();

  function broadcastEvent(eventId: string, message: Record<string, unknown>) {
    const raw = JSON.stringify({ eventId, ...message });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        const subscribed = clientRooms.get(client);
        if (!subscribed || subscribed === eventId) {
          client.send(raw);
        }
      }
    });
  }

  wss.on('connection', (ws) => {
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString()) as { type?: string; eventId?: string };
        if (msg.type === 'subscribe' && typeof msg.eventId === 'string') {
          clientRooms.set(ws, msg.eventId);
        }
      } catch {
        // Ignore malformed socket frames
      }
    });
    ws.on('close', () => {
      clientRooms.delete(ws);
    });
  });

  // Periodic cleanup of expired 5-minute seat holds
  setInterval(() => {
    const released = arenaStore.cleanupExpiredHolds();
    for (const item of released) {
      broadcastEvent(item.eventId, { type: 'seat:released', seatIds: item.seatIds });
    }
  }, 5000);

  // --- HEALTH ---
  app.get('/api/health', (_req, res) => {
    const layout = getStadiumLayout();
    res.json({
      ok: true,
      totalSeats: layout.seats.length,
      totalSections: layout.sections.length,
      razorpayConfigured: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
      supabaseConfigured: Boolean(process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY),
    });
  });

  // --- AUTH ---
  const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6).max(128),
    fullName: z.string().min(2).max(80),
  });

  app.post('/api/auth/register', (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Please provide a valid name, email, and 6+ character password.' });
      return;
    }
    const email = parsed.data.email.trim().toLowerCase();
    const state = arenaStore.getState();
    if (state.users.some((u) => u.email === email)) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const user = {
      id: crypto.randomUUID(),
      email,
      fullName: parsed.data.fullName.trim(),
      role: 'user' as const,
      passwordHash: hashPassword(parsed.data.password),
      createdAt: new Date().toISOString(),
    };
    state.users.push(user);
    arenaStore.save();

    const profile: UserProfile = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    };
    res.status(201).json({ user: profile, token: signToken(profile) });
  });

  const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
  });

  app.post('/api/auth/login', (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }
    const email = parsed.data.email.trim().toLowerCase();
    const user = arenaStore.getState().users.find((u) => u.email === email);
    if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const profile: UserProfile = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    };
    res.json({ user: profile, token: signToken(profile) });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res) => {
    res.json({
      user: {
        id: req.authUser!.sub,
        email: req.authUser!.email,
        fullName: req.authUser!.fullName,
        role: req.authUser!.role,
      },
    });
  });

  // --- ADMIN AUTH / BOOTSTRAP ---
  app.get('/api/admin/status', (_req, res) => {
    const envPasscodeSet = Boolean(process.env.ADMIN_PASSCODE && process.env.ADMIN_PASSCODE.length > 0);
    const claimed = Boolean(arenaStore.getState().adminCredentialHash);
    res.json({
      requiresClaim: !envPasscodeSet && !claimed,
      envPasscodeConfigured: envPasscodeSet,
    });
  });

  app.post('/api/admin/bootstrap', (req, res) => {
    if (process.env.ADMIN_PASSCODE) {
      res.status(403).json({ error: 'Admin passcode is managed via environment configuration.' });
      return;
    }
    const state = arenaStore.getState();
    if (state.adminCredentialHash) {
      res.status(409).json({ error: 'Admin access has already been claimed.' });
      return;
    }
    const schema = z.object({
      email: z.string().email(),
      fullName: z.string().min(2).max(80),
      passcode: z.string().min(6).max(128),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Valid email, name, and 6+ character passcode required.' });
      return;
    }

    const hash = hashPassword(parsed.data.passcode);
    state.adminCredentialHash = hash;

    const email = parsed.data.email.trim().toLowerCase();
    let adminUser = state.users.find((u) => u.email === email);
    if (!adminUser) {
      adminUser = {
        id: crypto.randomUUID(),
        email,
        fullName: parsed.data.fullName.trim(),
        role: 'admin',
        passwordHash: hash,
        createdAt: new Date().toISOString(),
      };
      state.users.push(adminUser);
    } else {
      adminUser.role = 'admin';
    }
    arenaStore.save();

    const profile: UserProfile = {
      id: adminUser.id,
      email: adminUser.email,
      fullName: adminUser.fullName,
      role: 'admin',
    };
    res.status(201).json({ user: profile, token: signToken(profile) });
  });

  app.post('/api/admin/login', (req, res) => {
    const schema = z.object({ passcode: z.string().min(1) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Passcode is required.' });
      return;
    }

    const envPasscode = process.env.ADMIN_PASSCODE;
    let valid = false;
    if (envPasscode && envPasscode.length > 0) {
      const a = Buffer.from(parsed.data.passcode);
      const b = Buffer.from(envPasscode);
      valid = a.length === b.length && crypto.timingSafeEqual(a, b);
    } else if (arenaStore.getState().adminCredentialHash) {
      valid = verifyPassword(parsed.data.passcode, arenaStore.getState().adminCredentialHash!);
    }

    if (!valid) {
      res.status(401).json({ error: 'Invalid administrator passcode.' });
      return;
    }

    const profile: UserProfile = {
      id: 'admin-console',
      email: 'admin@arenax3d.io',
      fullName: 'ArenaX Administrator',
      role: 'admin',
    };
    res.json({ user: profile, token: signToken(profile) });
  });

  // --- EVENTS & STADIUM CATALOG ---
  app.get('/api/events', (_req, res) => {
    const events = arenaStore.getState().events.filter((e) => e.status !== 'draft');
    res.json({ events, sectionMultipliers: arenaStore.getState().sectionMultipliers });
  });

  app.get('/api/events/:eventId/seats', (req, res) => {
    const eventId = req.params.eventId;
    const sessionId = String(req.query.sessionId || '');
    const event = arenaStore.getState().events.find((e) => e.id === eventId);
    if (!event) {
      res.status(404).json({ error: 'Event not found.' });
      return;
    }
    const delta = arenaStore.getSeatDelta(eventId, sessionId);
    res.json({
      eventId,
      delta,
      sectionMultipliers: arenaStore.getState().sectionMultipliers,
      eventPriceMultiplier: event.priceMultiplier,
    });
  });

  // --- SEAT LOCKING ---
  app.post('/api/seats/hold', (req, res) => {
    const schema = z.object({
      eventId: z.string().min(1),
      seatIds: z.array(z.string().min(1)).min(1).max(8),
      sessionId: z.string().min(4),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Select between 1 and 8 seats.' });
      return;
    }

    const { eventId, seatIds, sessionId } = parsed.data;
    const authHeader = req.headers.authorization;
    const userPayload = authHeader?.startsWith('Bearer ') ? verifyToken(authHeader.slice(7)) : null;

    const result = arenaStore.holdSeats(eventId, seatIds, sessionId, userPayload?.sub);
    if (!result.ok) {
      res.status(409).json({ error: result.reason, conflicts: result.conflicts });
      return;
    }

    broadcastEvent(eventId, { type: 'seat:held', seatIds, sessionId, expiresAt: result.expiresAt });
    res.json({ ok: true, expiresAt: result.expiresAt, seatIds });
  });

  app.post('/api/seats/release', (req, res) => {
    const schema = z.object({
      eventId: z.string().min(1),
      sessionId: z.string().min(4),
      seatIds: z.array(z.string()).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid release request.' });
      return;
    }
    const released = arenaStore.releaseSessionHolds(
      parsed.data.eventId,
      parsed.data.sessionId,
      parsed.data.seatIds,
    );
    if (released.length > 0) {
      broadcastEvent(parsed.data.eventId, { type: 'seat:released', seatIds: released });
    }
    res.json({ ok: true, released });
  });

  // --- PAYMENTS & TRANSACTIONAL BOOKING ---
  app.post('/api/payments/create-order', requireAuth, async (req: AuthedRequest, res) => {
    const schema = z.object({
      eventId: z.string().min(1),
      seatIds: z.array(z.string().min(1)).min(1).max(8),
      sessionId: z.string().min(4),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid booking payload.' });
      return;
    }

    const { eventId, seatIds, sessionId } = parsed.data;
    // Lock/refresh holds atomically on the server
    const holdRes = arenaStore.holdSeats(eventId, seatIds, sessionId, req.authUser!.sub);
    if (!holdRes.ok) {
      res.status(409).json({ error: holdRes.reason, conflicts: holdRes.conflicts });
      return;
    }

    // Compute authoritative total server-side
    let totalAmount = 0;
    try {
      for (const seatId of seatIds) {
        totalAmount += arenaStore.computeSeatPrice(eventId, seatId);
      }
    } catch (err) {
      res.status(400).json({ error: String(err) });
      return;
    }

    const bookingId = crypto.randomUUID();
    const rzpKeyId = process.env.RAZORPAY_KEY_ID;
    const rzpSecret = process.env.RAZORPAY_KEY_SECRET;

    if (rzpKeyId && rzpSecret) {
      try {
        const auth = Buffer.from(`${rzpKeyId}:${rzpSecret}`).toString('base64');
        const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: totalAmount * 100,
            currency: 'INR',
            receipt: bookingId.slice(0, 32),
          }),
        });
        if (!rzpRes.ok) {
          const text = await rzpRes.text();
          res.status(502).json({ error: `Payment gateway error: ${text}` });
          return;
        }
        const rzpOrder = (await rzpRes.json()) as { id: string };
        arenaStore.getState().orders[rzpOrder.id] = {
          orderId: rzpOrder.id,
          bookingId,
          userId: req.authUser!.sub,
          eventId,
          seatIds,
          amount: totalAmount,
          currency: 'INR',
          provider: 'razorpay',
          status: 'created',
          createdAt: new Date().toISOString(),
        };
        arenaStore.save();
        res.json({
          mode: 'razorpay',
          keyId: rzpKeyId,
          orderId: rzpOrder.id,
          amount: totalAmount,
          currency: 'INR',
          expiresAt: holdRes.expiresAt,
        });
        return;
      } catch (err) {
        res.status(502).json({ error: `Could not reach Razorpay: ${String(err)}` });
        return;
      }
    }

    // Sandbox Demo Order when Razorpay credentials are not configured
    const sandboxOrderId = `order_sandbox_${crypto.randomBytes(6).toString('hex')}`;
    arenaStore.getState().orders[sandboxOrderId] = {
      orderId: sandboxOrderId,
      bookingId,
      userId: req.authUser!.sub,
      eventId,
      seatIds,
      amount: totalAmount,
      currency: 'INR',
      provider: 'sandbox',
      status: 'created',
      createdAt: new Date().toISOString(),
    };
    arenaStore.save();

    res.json({
      mode: 'sandbox',
      orderId: sandboxOrderId,
      amount: totalAmount,
      currency: 'INR',
      expiresAt: holdRes.expiresAt,
    });
  });

  app.post('/api/payments/verify', requireAuth, (req: AuthedRequest, res) => {
    const schema = z.object({
      orderId: z.string().min(1),
      paymentId: z.string().min(1).optional(),
      signature: z.string().optional(),
      simulateFailure: z.boolean().optional(),
      seatSnapshots: z.record(z.string(), z.string()).optional(),
      holderName: z.string().max(100).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid verification request.' });
      return;
    }

    const { orderId, paymentId, signature, simulateFailure, seatSnapshots, holderName } = parsed.data;
    const order = arenaStore.getState().orders[orderId];
    if (!order || order.userId !== req.authUser!.sub) {
      res.status(404).json({ error: 'Order not found for your account.' });
      return;
    }

    if (order.provider === 'razorpay') {
      const secret = process.env.RAZORPAY_KEY_SECRET;
      if (!secret || !paymentId || !signature) {
        res.status(400).json({ error: 'Missing Razorpay signature fields.' });
        return;
      }
      const expected = crypto
        .createHmac('sha256', secret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');
      const a = Buffer.from(expected);
      const b = Buffer.from(signature);
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        order.status = 'failed';
        arenaStore.save();
        res.status(400).json({ error: 'Payment signature verification failed.' });
        return;
      }
    } else if (simulateFailure) {
      order.status = 'failed';
      arenaStore.save();
      res.status(402).json({ error: 'Sandbox payment declined as requested. Your seats remain held until expiry.' });
      return;
    }

    const finalPaymentId = paymentId || `pay_sandbox_${crypto.randomBytes(6).toString('hex')}`;
    const result = arenaStore.confirmBookingFromOrder(
      orderId,
      finalPaymentId,
      seatSnapshots || {},
      holderName || req.authUser!.fullName,
    );

    if (!result.ok) {
      res.status(409).json({ error: result.error });
      return;
    }

    broadcastEvent(order.eventId, { type: 'seat:booked', seatIds: order.seatIds });
    res.json({ ok: true, booking: result.booking });
  });

  // --- USER TICKETS & BOOKINGS ---
  app.get('/api/my/bookings', requireAuth, (req: AuthedRequest, res) => {
    const bookings = arenaStore
      .getState()
      .bookings.filter((b) => b.userId === req.authUser!.sub);
    res.json({ bookings });
  });

  // --- ADMIN ROUTES (PROTECTED BY SERVER-SIDE ROLE CHECK) ---
  app.get('/api/admin/overview', requireAdmin, (_req, res) => {
    const state = arenaStore.getState();
    const layout = getStadiumLayout();
    const totalRevenue = state.bookings.reduce(
      (sum, b) => (b.status === 'confirmed' ? sum + b.totalAmount : sum),
      0,
    );
    const totalTickets = state.bookings.reduce(
      (sum, b) => (b.status === 'confirmed' ? sum + b.tickets.length : sum),
      0,
    );

    const eventOccupancy = state.events.map((evt) => {
      const bookedCount = (state.bookedSeatsByEvent[evt.id] || []).length;
      const heldCount = Object.keys(state.seatHoldsByEvent[evt.id] || {}).length;
      return {
        eventId: evt.id,
        title: evt.title,
        bookedCount,
        heldCount,
        totalSeats: layout.seats.length,
        occupancyPct: Number(((bookedCount / layout.seats.length) * 100).toFixed(1)),
      };
    });

    res.json({
      totalRevenue,
      totalTickets,
      totalBookings: state.bookings.length,
      totalSeats: layout.seats.length,
      events: state.events,
      sectionMultipliers: state.sectionMultipliers,
      bookings: state.bookings,
      eventOccupancy,
    });
  });

  app.post('/api/admin/events', requireAdmin, (req, res) => {
    const schema = z.object({
      title: z.string().min(3).max(120),
      homeTeam: z.string().min(2).max(60),
      awayTeam: z.string().min(2).max(60),
      date: z.string().min(4),
      time: z.string().min(3),
      category: z.string().min(2).max(60),
      description: z.string().min(5).max(500),
      priceMultiplier: z.number().min(0.2).max(5),
      status: z.enum(['on_sale', 'selling_fast', 'sold_out', 'draft']),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid event payload.' });
      return;
    }

    const newEvent: EventRecord = {
      id: `evt-${crypto.randomBytes(4).toString('hex')}`,
      title: parsed.data.title,
      homeTeam: parsed.data.homeTeam,
      awayTeam: parsed.data.awayTeam,
      homeColor: '#3B82F6',
      awayColor: '#8B5CF6',
      date: parsed.data.date,
      time: parsed.data.time,
      stadiumName: 'ArenaX Cricket Stadium · Mumbai',
      category: parsed.data.category,
      description: parsed.data.description,
      imageUrl: '/src/assets/images/event_cricket_t20_derby_1795594096802.jpg',
      status: parsed.data.status,
      isDemoData: false,
      priceMultiplier: parsed.data.priceMultiplier,
    };

    const state = arenaStore.getState();
    state.events.unshift(newEvent);
    state.bookedSeatsByEvent[newEvent.id] = [];
    arenaStore.save();

    res.status(201).json({ event: newEvent });
  });

  app.patch('/api/admin/events/:eventId', requireAdmin, (req, res) => {
    const event = arenaStore.getState().events.find((e) => e.id === req.params.eventId);
    if (!event) {
      res.status(404).json({ error: 'Event not found.' });
      return;
    }
    const schema = z.object({
      title: z.string().min(3).max(120).optional(),
      date: z.string().optional(),
      time: z.string().optional(),
      priceMultiplier: z.number().min(0.2).max(5).optional(),
      status: z.enum(['on_sale', 'selling_fast', 'sold_out', 'draft']).optional(),
      description: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid update payload.' });
      return;
    }
    Object.assign(event, parsed.data);
    arenaStore.save();
    res.json({ event });
  });

  app.patch('/api/admin/sections/:sectionId/pricing', requireAdmin, (req, res) => {
    const schema = z.object({ multiplier: z.number().min(0.2).max(5) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Multiplier must be between 0.2 and 5.0.' });
      return;
    }
    const layout = getStadiumLayout();
    if (!layout.sectionById.has(req.params.sectionId)) {
      res.status(404).json({ error: 'Section not found.' });
      return;
    }
    arenaStore.getState().sectionMultipliers[req.params.sectionId] = parsed.data.multiplier;
    arenaStore.save();
    res.json({
      sectionId: req.params.sectionId,
      multiplier: parsed.data.multiplier,
    });
  });

  // --- VITE MIDDLEWARE OR STATIC SERVING ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`ArenaX 3D server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
