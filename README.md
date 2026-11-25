# ArenaX 3D — Interactive 3D Cricket Stadium & Ticketing

> Explore a procedurally generated cricket stadium, inspect the view from an individual seat, reserve seats, and receive a downloadable digital ticket with a QR code and captured 3D pitch view.

ArenaX 3D is a full-stack cricket stadium experience built with React, TypeScript, Three.js, Node.js, Express, and WebSockets. The stadium contains **14,064 individually indexed seats across 40 stands**, arranged in Lower, Club, and Upper tiers.

<p align="center">
  <a href="https://github.com/prathameshsutar140/Arenax3D">
    <img src="https://img.shields.io/badge/Project-ArenaX%203D-2563eb?style=for-the-badge" alt="ArenaX 3D" />
  </a>
  <img src="https://img.shields.io/badge/Frontend-React%2019-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/3D-Three.js-black?style=for-the-badge&logo=threedotjs" alt="Three.js" />
  <img src="https://img.shields.io/badge/Language-TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Build-Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
</p>

---

## Contents

- [Overview](#overview)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [How It Works](#how-it-works)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Configuration](#environment-configuration)
- [Supabase Setup (Optional)](#supabase-setup-optional)
- [Available Commands](#available-commands)
- [Backend API Overview](#backend-api-overview)
- [Payment and Demo Mode](#payment-and-demo-mode)
- [Security Notes](#security-notes)
- [Current Scope and Production Checklist](#current-scope-and-production-checklist)
- [Contributing](#contributing)

## Overview

ArenaX 3D reimagines online cricket ticket booking as an interactive 3D experience. Instead of choosing a seat from a flat seating chart, visitors can explore the stadium in WebGL, zoom into a stand, select a specific seat, and preview its pitch sightline from spectator eye level.

The application brings together a 3D stadium viewer, event catalogue, seat availability, temporary seat reservations, account authentication, booking and payment APIs, an administrator dashboard, and digital ticket generation.

**Important:** The included match catalogue contains demonstration fixtures and sample availability. Treat the project as a development/demo platform until real event data, production payment checkout, operational policies, and deployment security have been configured.

## Features

### 3D Cricket Stadium

- Procedurally generated oval cricket stadium rendered with Three.js and WebGL.
- **14,064 indexed seats** distributed across **40 stands**.
- Three seating tiers: Lower, Club, and Upper.
- Instanced seat rendering to reduce draw calls.
- Cricket outfield, central pitch, boundary rope, wickets, sightscreens, scoreboards, stand architecture, canopy roof, and floodlight structures.
- Orbit-style camera navigation, smooth camera transitions, and tier/section camera presets.
- Section and seat hover interactions, selection highlighting, and availability colours.
- Adaptive rendering settings for mobile devices and software-rendered WebGL environments.
- WebGL support detection and context-loss handling.

### Seat Selection and Sightline Preview

- Explore the full stadium and focus on individual stands.
- Inspect seat sections and their availability.
- Select up to **6 seats per booking** through the current interface.
- View seat states: available, selected, held, and booked.
- Enter a first-person, eye-level view from a selected seat.
- Capture a 3D pitch-view snapshot for the selected seat.
- Find an available seat using the built-in seat suggestion control.
- View seat pricing using event and section price multipliers.

### Events Catalogue

- Browse the available cricket events.
- Search by match title, team, or event category.
- Filter events by availability status.
- View event details and open the 3D seat explorer for a selected match.
- Create and update events from the administrator dashboard.

### Temporary Seat Holds and Live Updates

- Server-side temporary seat holds with a **5-minute expiry**.
- Reject conflicting holds and already-booked seats.
- Release temporary holds when a user clears a selection.
- WebSocket updates for seat-held, seat-released, and seat-booked events.
- Automatic client reconnection when the WebSocket connection closes.
- Seat availability is refreshed from the server when an event is selected.

### Accounts and Administrator Access

- User registration and sign-in.
- Signed session tokens with user/admin roles.
- Administrator sign-in using an environment passcode.
- Optional first-run administrator claim flow when no admin passcode is configured.
- Role-protected administrator API routes.
- The current client keeps its authentication token in React memory rather than browser local/session storage.

### Booking and Digital Tickets

- Server-side order creation and price calculation.
- Booking confirmation after payment verification.
- Unique booking references and ticket codes.
- QR-code generation for ticket verification.
- Holographic-style digital ticket UI.
- Includes event, holder, stand, row, seat, booking reference, ticket code, and price details.
- Includes the captured seat-view snapshot when available.
- Download tickets as PNG or print them.
- View confirmed bookings in the **My Tickets** section.

### Administrator Dashboard

- Overview of confirmed revenue, issued tickets, active events, and seat count.
- Event occupancy information, including booked and temporarily held seats.
- Create events and update event status.
- Adjust section-level pricing multipliers.
- Review booking records and ticket details.

### Payment Options

- Server-side Razorpay order creation when Razorpay credentials are configured.
- Server-side HMAC-SHA256 signature verification endpoint.
- Sandbox/demo payment mode when Razorpay credentials are not configured.
- Simulated payment failure for testing the demo flow.

The current checkout screen includes a sandbox authorization flow. Before accepting real payments, connect and test the official Razorpay Checkout client flow so that the real payment ID and signature are supplied to the verification endpoint.

## Technology Stack

| Area | Technologies |
| --- | --- |
| Frontend | React 19, TypeScript |
| 3D rendering | Three.js, WebGL |
| Styling | Tailwind CSS 4, custom CSS |
| UI icons | Lucide React |
| Animation | GSAP, Motion |
| Build tooling | Vite, TypeScript, TSX |
| Backend | Node.js, Express |
| Real-time communication | WebSocket (`ws`) |
| Validation | Zod |
| Authentication helpers | Node.js Crypto, HMAC-SHA256, scrypt password hashing |
| Digital tickets | QRCode, html-to-image |
| Optional database layer | Supabase, PostgreSQL, Supabase Edge Functions |
| Payment provider support | Razorpay server-side API |

## How It Works

1. **Browse events:** The visitor opens the event catalogue and selects a match.
2. **Explore the stadium:** The Three.js scene displays the 3D stadium and its indexed seats.
3. **Choose seats:** The visitor selects available seats and checks their stand, row, and seat number.
4. **Preview the view:** The camera moves to the selected seat's eye-level position and can capture a pitch-view snapshot.
5. **Hold seats:** The server creates a temporary five-minute hold and broadcasts availability changes to connected clients.
6. **Review the booking:** The visitor signs in, reviews the seats and calculated price, and requests a payment order.
7. **Verify and confirm:** The server verifies the payment flow and confirms the booking.
8. **Get the ticket:** The application generates a digital ticket with a QR code and optional seat snapshot. The visitor can download or print it.

## Project Structure

The following tree reflects the repository files and folders:

```text
Arenax3D/
├── .env.example
├── .gitignore
├── README.md
├── bun.lock
├── index.html
├── metadata.json
├── package.json
├── server.ts
├── server/
│   └── store.ts
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── index.css
│   ├── assets/
│   │   └── images/
│   │       ├── event_allstar_showcase_1795494527949.jpg
│   │       ├── event_championship_clash_1795494527034.jpg
│   │       ├── event_cricket_championship_1795594097085.jpg
│   │       ├── event_cricket_odi_cup_1795594096835.jpg
│   │       ├── event_cricket_t20_derby_1795594096802.jpg
│   │       ├── event_playoff_finals_1795494526937.jpg
│   │       ├── hero_arena_night_1795494526100.jpg
│   │       └── hero_cricket_stadium_night_1795594095865.jpg
│   ├── components/
│   │   ├── AuthModal.tsx
│   │   ├── CheckoutModal.tsx
│   │   ├── HolographicTicket.tsx
│   │   └── Navbar.tsx
│   ├── contexts/
│   │   └── AuthContext.tsx
│   ├── pages/
│   │   ├── AdminDashboardPage.tsx
│   │   ├── EventsPage.tsx
│   │   ├── HomePage.tsx
│   │   ├── MyTicketsPage.tsx
│   │   └── StadiumExplorerPage.tsx
│   ├── services/
│   │   ├── apiClient.ts
│   │   ├── bookingService.ts
│   │   ├── paymentService.ts
│   │   ├── supabase.ts
│   │   └── ticketService.ts
│   ├── three/
│   │   ├── CameraController.ts
│   │   ├── CourtBuilder.ts
│   │   ├── SeatGenerator.ts
│   │   ├── SeatInteraction.ts
│   │   ├── SeatViewController.ts
│   │   ├── StadiumBuilder.ts
│   │   └── StadiumScene.ts
│   ├── types/
│   │   └── stadium.ts
│   └── utils/
│       └── stadiumLayout.ts
├── supabase/
│   ├── functions/
│   │   ├── create-booking/
│   │   │   └── index.ts
│   │   └── verify-payment/
│   │       └── index.ts
│   └── migrations/
│       └── 001_arenax_schema.sql
├── tsconfig.json
└── vite.config.ts
```

### Key File Responsibilities

| File / Folder | Responsibility |
| --- | --- |
| `src/App.tsx` | Main application shell and page navigation |
| `src/pages/` | Home, events, 3D explorer, tickets, and admin pages |
| `src/components/` | Navigation, authentication, checkout, and ticket UI |
| `src/three/` | Stadium scene, architecture, seat meshes, camera, and interactions |
| `src/utils/stadiumLayout.ts` | Deterministic stadium sections and seat coordinate generation |
| `src/services/` | API calls, booking, payment, Supabase configuration, and ticket utilities |
| `src/contexts/AuthContext.tsx` | Client authentication state |
| `src/types/stadium.ts` | Shared event, seat, booking, ticket, and user types |
| `server.ts` | Express API, WebSocket server, authentication, booking, and admin routes |
| `server/store.ts` | Local persistent store, demo events, seat holds, and booking operations |
| `supabase/migrations/` | Optional PostgreSQL schema and row-level security policies |
| `supabase/functions/` | Optional Supabase booking and payment-verification Edge Functions |
| `vite.config.ts` | Vite, React, Tailwind, and asset-copy build configuration |

## Getting Started

### Prerequisites

Install the following before running the project:

- Node.js (a current LTS release recommended)
- npm
- Git

Bun can also be used if you prefer the included `bun.lock` workflow.

### 1. Clone the Repository

```bash
git clone https://github.com/prathameshsutar140/Arenax3D.git
cd Arenax3D
```

### 2. Install Dependencies

Using npm:

```bash
npm install
```

Or using Bun:

```bash
bun install
```

### 3. Configure Environment Variables

Create your local environment file:

```bash
cp .env.example .env
```

On Windows Command Prompt:

```bat
copy .env.example .env
```

Open `.env` and fill in only the credentials for services you intend to configure. Never commit your real `.env` file or private keys.

### 4. Start the Development Server

```bash
npm run dev
```

Open **http://localhost:3000** in your browser.

The development command starts the Express server and Vite middleware together. The server listens on port `3000`.

## Environment Configuration

The repository includes an `.env.example` template:

| Variable | Required? | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | No | Placeholder for Gemini API configuration; no active Gemini-powered user feature is currently wired into the application flow. |
| `APP_URL` | No | Application URL placeholder for deployment configuration. |
| `VITE_SUPABASE_URL` | No | Supabase project URL for optional Supabase configuration. |
| `VITE_SUPABASE_ANON_KEY` | No | Supabase public/anonymous key for optional client configuration. |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Server/Edge Function secret; never expose it in frontend code or commit it. |
| `RAZORPAY_KEY_ID` | No | Razorpay key ID used by the server to create payment orders. |
| `RAZORPAY_KEY_SECRET` | No | Private Razorpay secret used for server-side signature verification. |
| `ADMIN_PASSCODE` | No | Optional administrator passcode. If unset, the first-run admin claim flow can be used. |
| `SESSION_SECRET` | Recommended for deployment | Stable secret used to sign application session tokens. If omitted, the server generates a temporary random secret at startup. |

**Configuration notes**

- Without Razorpay credentials, the server uses its sandbox/demo order mode.
- Without Supabase credentials, the application uses its built-in Express-backed local store.
- Keep service-role keys, payment secrets, and administrator credentials private.
- Use a long, unique `SESSION_SECRET` in any persistent deployment so existing sessions are not invalidated by a server restart.

## Supabase Setup (Optional)

The default application backend is the Express server with the local store in `server/store.ts`. The repository also contains a Supabase schema and Edge Function implementation for an optional PostgreSQL-backed setup.

### 1. Create a Supabase Project

Create a project in Supabase and copy its project URL and API keys into your private environment configuration.

### 2. Apply the Database Migration

Open the Supabase SQL Editor and run:

```text
supabase/migrations/001_arenax_schema.sql
```

The migration defines tables for:

- Profiles and roles
- Stadiums and events
- Sections and seats
- Temporary seat holds
- Bookings and booking-seat relationships
- Payments and tickets

It also defines indexes, an expired-hold cleanup function, row-level security, and policies for public catalogue reads, user-owned records, and administrator operations.

### 3. Deploy the Edge Functions

Install and configure the Supabase CLI, then run:

```bash
supabase functions deploy create-booking
supabase functions deploy verify-payment
```

Configure the required Supabase and Razorpay secrets for the Edge Functions in the Supabase project settings before testing them.

**Integration note:** The Supabase schema and Edge Functions are included as an optional backend path. The current React application uses the Express API routes by default; switching the full application to Supabase requires wiring the client services and deployment configuration to that backend.

## Available Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Express + Vite development server |
| `npm run build` | Build the frontend with Vite into `dist/` |
| `npm start` | Start the Express server in production mode |
| `npm run preview` | Preview the Vite production build |
| `npm run lint` | Run the TypeScript no-emit check |
| `npm run clean` | Remove generated build output |

## Backend API Overview

The Express server exposes the following main routes:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Register a user |
| `POST` | `/api/auth/login` | Sign in a user |
| `GET` | `/api/admin/status` | Check whether initial admin setup is required |
| `POST` | `/api/admin/bootstrap` | Claim initial administrator access |
| `POST` | `/api/admin/login` | Authenticate an administrator |
| `GET` | `/api/events` | Retrieve published events and section pricing |
| `GET` | `/api/events/:eventId/seats` | Retrieve seat availability for an event |
| `POST` | `/api/seats/hold` | Temporarily hold selected seats |
| `POST` | `/api/seats/release` | Release the current session's seat holds |
| `POST` | `/api/payments/create-order` | Create a payment order |
| `POST` | `/api/payments/verify` | Verify payment and confirm a booking |
| `GET` | `/api/my/bookings` | Retrieve the signed-in user's bookings |
| `GET` | `/api/admin/overview` | Retrieve administrator analytics and bookings |
| `POST` | `/api/admin/events` | Create an event |
| `PATCH` | `/api/admin/events/:eventId` | Update event details or status |
| `PATCH` | `/api/admin/sections/:sectionId/pricing` | Update a section's price multiplier |

The WebSocket endpoint is **`/ws`**. Clients subscribe to an event and receive `seat:held`, `seat:released`, and `seat:booked` updates.

## Payment and Demo Mode

ArenaX 3D supports two server-side order modes:

- **Sandbox/demo:** Used when Razorpay credentials are absent. It is intended for local development and demonstration; it does not charge a real payment method.
- **Razorpay order mode:** The backend can create an INR order and verify a Razorpay HMAC-SHA256 payment signature when valid server credentials and real payment details are supplied.

Do not interpret a successful sandbox booking as a real payment. Before production use, complete the official client-side checkout integration, test success/failure and webhook handling, configure payment secrets securely, and review the payment provider's current integration requirements.

## Security Notes

- Password hashing and verification use Node.js crypto helpers in the server store.
- Session tokens are signed by the backend.
- Administrator routes use server-side role checks.
- Payment signature verification is performed on the server.
- Seat prices are recalculated by the server rather than trusting the browser's displayed total.
- The Supabase migration enables row-level security policies for supported tables.
- Never put private API keys or service-role credentials in frontend source code.
- Use HTTPS, secure deployment secrets, persistent storage, backups, rate limiting, and production monitoring before exposing the service publicly.

## Current Scope and Production Checklist

This repository is a working development project with demo data and optional integration components. Before using it as a real ticketing service, review and complete at least the following:

- [ ] Replace demonstration fixtures with authorized, accurate event and stadium data.
- [ ] Connect the official Razorpay Checkout client flow and test verified payments end to end.
- [ ] Add and test payment webhooks and reconciliation.
- [ ] Choose and configure a production database; the default local store is not a substitute for a managed multi-instance database.
- [ ] Wire the frontend fully to Supabase if choosing the optional Supabase backend.
- [ ] Configure stable secrets, HTTPS, CORS/origin rules, rate limiting, logging, and backups.
- [ ] Add automated tests for authentication, concurrent seat holds, expiry, booking confirmation, and payment failures.
- [ ] Review ticket QR verification and gate-scanning workflows before real-world entry use.

## Contributing

Contributions, bug reports, and improvement ideas are welcome.

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/your-feature`.
3. Make your changes and test them locally.
4. Commit your work: `git commit -m "Add: your feature"`.
5. Push the branch and open a Pull Request.

Please keep changes focused and avoid committing environment files, credentials, generated build output, or personal data.

---

<p align="center">
  Built with passion for 3D web experiences and cricket.
  <br />
  <strong>ArenaX 3D</strong> · Created by <a href="https://github.com/prathameshsutar140">Prathamesh Sutar</a>
</p>
