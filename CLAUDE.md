@AGENTS.md

# WELLNESS&SEA — Platform Rules & Architecture

## What This Is
A two-sided marketplace connecting beachfront restaurant owners (Hosts) with yoga/pilates instructors (Guests/Instructors). Business model: instructors book restaurant spaces during dead morning hours; platform takes a commission on each confirmed booking. Hebrew RTL interface, Israeli market.

---

## Tech Stack
- **Framework**: Next.js 16 (uses `proxy.ts` NOT `middleware.ts` — critical)
- **Database & Auth**: Supabase (PostgreSQL + Auth + Storage + RLS)
- **UI**: Tailwind CSS 4 + Radix UI components (already installed)
- **Language**: TypeScript, strict mode
- **AI Assistant**: Vercel AI SDK + Claude claude-haiku-4-5 (`claude-haiku-4-5-20251001`)
- **Payment**: Tranzila Marketplace API (split payments)
- **RTL**: Hebrew throughout, `dir="rtl"` on `<html>`

---

## Next.js 16 Critical Rules

### ALWAYS use `proxy.ts` not `middleware.ts`
- The runtime reads `src/proxy.ts` with `export function proxy()` — the old `middleware.ts` export is ignored
- Route protection and auth redirects go in `src/proxy.ts`

### Server Components are the default
- Pages are Server Components unless they need interactivity
- Add `'use client'` only for islands that need state/effects/browser APIs
- Params in dynamic routes are `Promise<{ id: string }>` — always `await params`

### Server Actions for all mutations
- Auth: login, signup, signout → `src/lib/actions/auth.ts` with `'use server'`
- Venue CRUD → `src/lib/actions/venues.ts`
- Booking → `src/lib/actions/bookings.ts`
- Use `<form action={serverAction}>` pattern
- Use `useActionState` for error display in client wrappers

### Route Handlers for streaming/webhooks
- AI chat streaming → Route Handler (Server Actions cannot stream)
- Payment webhooks → Route Handler (needs raw body for HMAC)
- Venue time slots API → Route Handler (called dynamically by booking widget)

---

## Project Structure
```
src/
  app/
    (public)/           # Marketing pages, no auth required
    auth/               # login, signup, callback, forgot-password, update-password
    booking/            # Protected: booking flow pages
    host-dashboard/     # Protected: host role only
    instructor-dashboard/ # Protected: instructor role only
    host/               # Host landing + list-space wizard
    venues/             # Browse + detail
    api/
      ai/chat/          # Streaming AI assistant
      checkout/         # Tranzila payment initiation
      venues/[id]/slots/ # Available time slots
      webhooks/payment/ # Tranzila webhook
  components/
    ai/                 # ChatWidget, MessageBubble
    layout/             # Navbar (with auth state), Footer
    ui/                 # Radix UI kit (Button, Card, Input, etc.)
    venues/             # VenueCard, SearchFilters, ImageGallery, BookingWidget
    dashboard/          # DashboardShell, StatsCard, BookingTable
  lib/
    actions/            # auth.ts, venues.ts, bookings.ts, instructor.ts
    supabase/           # client.ts, server.ts, types.ts, queries.ts, schema.sql
    constants.ts        # amenityLabels, DAYS, CITIES, PLATFORM_FEE
    booking-engine.ts   # generateTimeSlots (pure, no DB)
    utils.ts            # cn(), formatPrice(), formatDate()
  proxy.ts              # Auth + role-based route protection
```

---

## Database & Security Rules

### Row Level Security — MANDATORY
- **profiles**: anyone can read; users can only update their own row
- **venues**: public reads active venues; hosts only see/edit their own (including inactive)
- **bookings**: instructors see their own; hosts see bookings for their venues; service role used only in webhook
- **messages**: users see only their own chat history
- NEVER expose `SUPABASE_SERVICE_ROLE_KEY` to client — only used in webhook route handler

### User Roles
- `host`: restaurant owner — can list spaces, view bookings for their venues
- `instructor`: fitness instructor — can search/book spaces
- Role stored in `profiles.role` AND in Supabase JWT `raw_user_meta_data.role`
- Proxy reads role from JWT without DB round-trip

### Venue Publishing Rules (MANDATORY — never bypass)
A venue CANNOT be published (`is_active = true`) without ALL of:
1. `hourly_price` > 0
2. `capacity` > 0
3. `space_size_sqm` > 0
4. At least 1 availability slot defined
5. At least 1 image uploaded
6. `location_address` + `location_city` filled
7. `amenities` object with at least one `true` value

---

## Payment Flow (Airbnb Model)
1. Instructor selects venue + time slot → creates `pending` booking
2. Server Action calls Tranzila Marketplace API → gets `checkout_url`
3. Instructor redirected to Tranzila hosted payment page
4. Tranzila charges full amount, splits: `host_payout` → host merchant, `platform_fee` → platform
5. Tranzila webhook (`POST /api/webhooks/payment`) fires → updates booking to `confirmed`
6. Booking is locked in venue calendar only after `status = 'confirmed'`

### Platform Fee Calculation
```typescript
function calculatePlatformFee(spaceSizeSqm: number): number {
  if (spaceSizeSqm <= 50) return 25
  if (spaceSizeSqm <= 80) return 35
  return 50
}
```
Fee is HIDDEN from both parties in the UI. Host sees `host_payout`. Instructor sees `total_price`.

---

## AI Assistant Rules
- Model: `claude-haiku-4-5-20251001` (fast, cheap, sufficient for search queries)
- SDK: Vercel AI SDK (`ai` package) — use `streamText` with tool calling
- System prompt: Hebrew, friendly, focused on finding venues
- Tool: `search_venues` — accepts city, min_capacity, date, time, amenities[]
- Results returned as structured JSON, rendered as VenueCard components in chat
- Chat history saved to `messages` table in Supabase (per session)
- Widget: floating bottom-left button → slide-up drawer (mobile-first)

---

## UI/UX Principles
- **Mobile-First**: design for 375px width, enhance for desktop
- **RTL Hebrew**: all user-facing text in Hebrew, `dir="rtl"` everywhere
- **Airbnb-style**: clean cards, photography-driven, trust signals
- **Color palette** (already in Tailwind config):
  - `ocean` = primary blue
  - `deep-ocean` = dark navy
  - `coral` = accent/CTA
  - `sand` = background
- **Loading states**: every async operation shows skeleton or spinner
- **Error states**: every form shows inline Hebrew error messages
- **Empty states**: meaningful CTA when no results/bookings

---

## Environment Variables Required
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server-only, webhook only
ANTHROPIC_API_KEY=                # AI assistant
TRANZILA_API_KEY=
TRANZILA_TERMINAL_NAME=
TRANZILA_WEBHOOK_SECRET=          # HMAC verification
NEXT_PUBLIC_APP_URL=              # for OAuth redirect
```

---

## What NOT to Do
- Do NOT use `middleware.ts` — use `proxy.ts`
- Do NOT expose `SUPABASE_SERVICE_ROLE_KEY` to client
- Do NOT trust client-side availability checks — always re-validate in Server Action before booking
- Do NOT show `platform_fee` in any user-facing UI
- Do NOT publish a venue without all mandatory fields validated server-side
- Do NOT use mock data in production — `src/lib/mock-data.ts` is being phased out
- Do NOT add `amenityLabels` or `AMENITY_OPTIONS` to new files — import from `src/lib/constants.ts`
