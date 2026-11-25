-- ArenaX 3D - Complete PostgreSQL / Supabase Schema
-- Run via Supabase SQL Editor or `supabase db push`

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. STADIUMS
CREATE TABLE IF NOT EXISTS public.stadiums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  total_capacity INTEGER NOT NULL DEFAULT 14064,
  court_dimensions JSONB NOT NULL DEFAULT '{"rx": 46, "rz": 40, "pitchLength": 20.12}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. EVENTS
CREATE TABLE IF NOT EXISTS public.events (
  id TEXT PRIMARY KEY,
  stadium_id UUID REFERENCES public.stadiums(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  event_date DATE NOT NULL,
  start_time TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Cricket',
  description TEXT NOT NULL,
  price_multiplier NUMERIC(5,2) NOT NULL DEFAULT 1.00,
  status TEXT NOT NULL DEFAULT 'on_sale' CHECK (status IN ('on_sale', 'selling_fast', 'sold_out', 'draft')),
  is_demo_data BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. SECTIONS
CREATE TABLE IF NOT EXISTS public.sections (
  id TEXT PRIMARY KEY,
  stadium_id UUID REFERENCES public.stadiums(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('Lower', 'Club', 'Upper')),
  rows_count INTEGER NOT NULL,
  seats_per_row INTEGER NOT NULL,
  price_multiplier NUMERIC(5,2) NOT NULL DEFAULT 1.00,
  min_base_price NUMERIC(10,2) NOT NULL,
  max_base_price NUMERIC(10,2) NOT NULL
);

-- 5. SEATS (14,064 seats indexed by deterministic seat_id)
CREATE TABLE IF NOT EXISTS public.seats (
  id TEXT PRIMARY KEY,
  section_id TEXT NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL,
  seat_number INTEGER NOT NULL,
  world_x NUMERIC(10,3) NOT NULL,
  world_y NUMERIC(10,3) NOT NULL,
  world_z NUMERIC(10,3) NOT NULL,
  facing_angle NUMERIC(10,5) NOT NULL,
  base_price NUMERIC(10,2) NOT NULL,
  UNIQUE (section_id, row_number, seat_number)
);

-- 6. SEAT RESERVATIONS / HOLDS (Per-event temporary locks with automatic expiry)
CREATE TABLE IF NOT EXISTS public.seat_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  seat_id TEXT NOT NULL REFERENCES public.seats(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, seat_id)
);

-- 7. BOOKINGS
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_reference TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  event_id TEXT NOT NULL REFERENCES public.events(id) ON DELETE RESTRICT,
  total_amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. BOOKING_SEATS (Unique constraint on (event_id, seat_id) prevents double booking at DB level)
CREATE TABLE IF NOT EXISTS public.booking_seats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  seat_id TEXT NOT NULL REFERENCES public.seats(id) ON DELETE RESTRICT,
  unit_price NUMERIC(10,2) NOT NULL,
  UNIQUE (event_id, seat_id)
);

-- 9. PAYMENTS
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('razorpay', 'sandbox')),
  provider_order_id TEXT UNIQUE NOT NULL,
  provider_payment_id TEXT UNIQUE,
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'verified', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. TICKETS
CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_code TEXT UNIQUE NOT NULL,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES public.events(id) ON DELETE RESTRICT,
  seat_id TEXT NOT NULL REFERENCES public.seats(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  qr_payload TEXT NOT NULL,
  snapshot_storage_path TEXT,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, seat_id)
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_seat_holds_expiry ON public.seat_holds(event_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_booking_seats_event ON public.booking_seats(event_id);
CREATE INDEX IF NOT EXISTS idx_tickets_user ON public.tickets(user_id);

-- AUTOMATIC EXPIRED HOLD CLEANUP FUNCTION
CREATE OR REPLACE FUNCTION public.release_expired_seat_holds(p_event_id TEXT DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.seat_holds
  WHERE expires_at <= NOW()
    AND (p_event_id IS NULL OR event_id = p_event_id);
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stadiums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seat_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- Public read access for stadium catalog & live seat availability
CREATE POLICY "Public read stadiums" ON public.stadiums FOR SELECT USING (true);
CREATE POLICY "Public read events" ON public.events FOR SELECT USING (status <> 'draft');
CREATE POLICY "Public read sections" ON public.sections FOR SELECT USING (true);
CREATE POLICY "Public read seats" ON public.seats FOR SELECT USING (true);
CREATE POLICY "Public read active seat_holds" ON public.seat_holds FOR SELECT USING (expires_at > NOW());
CREATE POLICY "Public read booked seats" ON public.booking_seats FOR SELECT USING (true);

-- Profiles: users read/update own profile; admins read all
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Bookings, Payments, Tickets: strict owner isolation
CREATE POLICY "Users read own bookings" ON public.bookings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users read own tickets" ON public.tickets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users read own payments" ON public.payments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.user_id = auth.uid())
);

-- Admin write policies via profiles.role check
CREATE POLICY "Admins manage events" ON public.events FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);
CREATE POLICY "Admins manage sections" ON public.sections FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);
