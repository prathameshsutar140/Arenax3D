# ArenaX 3D — Interactive 3D Cricket Stadium Ticketing Platform

ArenaX 3D is a full-stack interactive 3D cricket stadium ticketing platform for India featuring a procedurally generated 14,064-seat WebGL oval, eye-level first-person pitch sightlines, real-time WebSocket seat locking, INR Razorpay/Sandbox checkout, holographic digital tickets with QR codes, and a role-protected Admin Dashboard.

## Core Capabilities

- **Procedural 3D Cricket Stadium (Three.js + WebGL)**:
  - Emerald mowing-striped turf oval (`46m × 40m`), 30-yard dashed fielding circle, 22-yard rolled clay pitch, white creases, 3-stump + LED-bail wickets, padded boundary rope, and North/South white sightscreens.
  - **14,064 individually identifiable seats** across 40 curved stands (Lower `101–112`, Club `201–212`, Upper `301–316`) rendered via a single `THREE.InstancedMesh` draw call.
  - GPU UV-scrolling LED boundary cushions and Club fascia ribbon, dual North/South 1Hz match countdown scoreboards, 4 towering floodlight pylons, open-air cantilevered canopy roof, and starry night sky.
  - Hardware-adaptive rendering (`isSoftwareGl` detection for shadows, post-processing bloom, pixel ratio, and `afterDraw` frame pacing).
- **First-Person View From Your Seat**:
  - Smoothly transitions camera to exact selected seat coordinates at spectator eye height (`+0.95m`), looking toward the 22-yard pitch with clamped look-around rotation.
  - Captures an actual WebGL perspective snapshot from the seat for the issued digital ticket.
- **Holographic Digital Tickets**:
  - Glassmorphic pass with holographic sheen, booking reference, captured 3D seat-view snapshot, cryptographic verification QR code (`qrcode`), PNG download (`html-to-image`), and print layout.
- **Transactional Seat Locking & Real-Time Sync**:
  - 5-minute server-side temporary seat holds with automatic expiration cleanup and conflict rejection (`409 Conflict`).
  - WebSocket (`/ws`) broadcasts for `seat:held`, `seat:released`, and `seat:booked`.
- **Payment Integration & Admin Console**:
  - Server-side order creation and Razorpay HMAC-SHA256 signature verification, with a clearly labelled **Sandbox / Demo Checkout Mode** when Razorpay keys are not set.
  - Role-protected Admin Dashboard for event creation, status updates, per-section pricing multipliers, occupancy analytics, and booking records.

## Local Installation

```bash
npm install
cp .env.example .env
npm run dev
```

The Express + Vite + WebSocket server runs on `http://localhost:3000`.

## Environment Variables

See `.env.example`:

- `RAZORPAY_KEY_ID` & `RAZORPAY_KEY_SECRET`: Optional server-side Razorpay keys. Leave empty to use Sandbox Demo Payment Mode.
- `ADMIN_PASSCODE`: Optional administrator passcode. When unset, the Admin tab provides a secure first-run Admin Claim form that hashes your chosen passcode with `scrypt` and locks itself afterward.
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`: Optional Supabase project credentials.

## Supabase Setup (Optional External PostgreSQL Deployment)

1. Run `supabase/migrations/001_arenax_schema.sql` in your Supabase SQL Editor to provision `profiles`, `stadiums`, `events`, `sections`, `seats`, `seat_holds`, `bookings`, `booking_seats`, `payments`, and `tickets` with RLS policies and atomic double-booking constraints.
2. Deploy `supabase/functions/create-booking` and `supabase/functions/verify-payment` via the Supabase CLI:
   ```bash
   supabase functions deploy create-booking
   supabase functions deploy verify-payment
   ```

## Production Build & Deployment

```bash
npm run build
npm start
```

- **Full-Stack Node Hosting (Cloud Run / Railway / Render)**: Builds static assets into `dist/` and serves both the API/WebSocket server and SPA from `server.ts` on port `3000`.
- **Vercel Compatibility**: Static frontend builds cleanly with `npm run build` (`vite build`); API routes and WebSocket services can be paired with Supabase Edge Functions or a Node backend.
