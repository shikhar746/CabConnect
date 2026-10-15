# CabConnect 🚖

A full-stack ride-hailing app (an "Uber clone") for **riders**, **drivers** and an **operations/admin team**. Riders book rides with upfront fares, track their driver live, pay by card/UPI/wallet/cash, download receipts, rate drivers and raise SOS alerts. Drivers go online, get ride requests in real time, verify riders with a PIN and track their earnings. Admins watch the whole marketplace.

| Layer | Tech |
|---|---|
| Frontend | React 18 · Vite · Chakra UI · React Router · Axios · Socket.IO client · Recharts · Leaflet (OpenStreetMap) |
| Backend | Node.js · Express · Socket.IO · Mongoose · JWT · bcrypt(js) · Zod validation · PDFKit |
| Database | MongoDB |
| Tests | Jest + Supertest (+ mongodb-memory-server) |

> **About the brief.** The project brief suggested Next.js, Tailwind, Clerk and Supabase/Firebase. This build uses the stack it was asked for (React + Chakra UI + Express + MongoDB). Clerk is replaced by JWT auth plus a pluggable Google sign-in, and Supabase/Firebase real-time is replaced by Socket.IO (the brief lists WebSockets as an option).

---

## 1. Quick start

**Prerequisites:** Node.js 18+ (tested on 22), npm, and MongoDB 6+ (local, Docker or Atlas). No API keys are needed.

```bash
# 1. Install everything (root, server, client)
npm run install:all

# 2. Create env files from the examples
npm run setup:env          # copies server/.env.example → server/.env and client/.env.example → client/.env
#    then edit server/.env and set JWT_SECRET to any long random string

# 3. Start MongoDB (pick one)
mongod --dbpath ./data                                   # local install
docker run -d --name cabconnect-mongo -p 27017:27017 mongo:7   # Docker

# 4. Load demo data (drops & recreates the demo collections)
npm run seed

# 5. Run API (http://localhost:5000) + web app (http://localhost:5173)
npm run dev
```

Open **http://localhost:5173** and use the one-click demo logins on the login page.

| Role | Email | Password |
|---|---|---|
| Rider | `rider@cabconnect.dev` | `Password@123` |
| Driver | `driver@cabconnect.dev` | `Password@123` |
| Admin | `admin@cabconnect.dev` | `Password@123` |

More seeded accounts (same password): riders `priya@`, `rohan@`, `ananya@`, `kabir@`, `meera@`; drivers `suresh@` (sedan), `imran@` (SUV), `venkatesh@` (auto), `arjun@` (bike), `lakshmi@` (mini) and more, all `@cabconnect.dev`.

### No MongoDB? Use the dev fallback

```bash
npm run dev:memory
```

This starts a throwaway in-memory MongoDB (via `mongodb-memory-server`) and seeds it automatically. Data is lost when the server stops. The first run downloads a `mongod` binary (~100 MB). Use real MongoDB for anything beyond a quick look.

### Run each part separately

```bash
cd server && npm run dev     # API on :5000 (nodemon)
cd client && npm run dev     # Vite on :5173, proxies /api, /uploads and /socket.io to :5000
```

---

## 2. Demo walkthrough (real-time, two browser windows)

1. **Window A (normal):** log in as **Rider** → *Book a ride*. Search "MG Road" for pickup and "Koramangala" for drop-off. Optionally add a stop and apply `RIDE20` or `WELCOME50`, pick *Mini*, then **Book**.
2. **Window B (incognito):** log in as **Driver** (Ramesh, a Mini driver who is online near MG Road). The request appears instantly. Click **Accept ride**.
3. Window A shows the driver card, the 4-digit **Ride PIN** and the car moving on the map. The built-in GPS simulator drives it to the pickup, then the status changes to "Driver has arrived".
4. In Window B, enter the PIN → **Start trip**. The car follows the route. Click **Complete trip**.
5. In Window A, **pay**. The card ending **0002** is a test card that gets declined, so you can see the failure path; then pay with **4242**. The PDF receipt is downloadable and gets "emailed" (see Admin → *Email & SMS log*). Then **rate** the driver.
6. Try **SOS** during a ride, **Cancel** (free at first, ₹50 after the 2-minute free window once a driver is on the way), **Help & support** tickets, and **Profile** (photo upload, cards/UPI, wallet top-up, emergency contacts).
7. Log in as **Admin** to see dashboards, rides, users (suspend/reactivate), payments, promo-code CRUD, support replies, SOS alerts (they appear live) and the outbox.

> Ride requests go only to **online, idle drivers of the same ride type within 8 km** of the pickup. Seeded online drivers are in central Bengaluru (one per type). A driver can move by clicking their dashboard map or using **Use GPS**. Requests nobody accepts are cancelled automatically after 5 minutes.

---

## 3. Features by module (mapped to the brief)

| Brief use case | Where it lives |
|---|---|
| 1. Registration & authentication | Email/phone + password sign-up/login (JWT, bcrypt), rider & driver roles, **Continue with Google** (mock or real), role-based routes |
| 2. Profile management | Name/phone, **profile picture upload**, add/remove/default **cards & UPI**, wallet top-up, change password, driver vehicle & licence |
| 3. Booking a ride | Place autocomplete, pin-on-map, use-my-location, ride options (Moto/Auto/Mini/Sedan/SUV) with ETA and capacity; matching notifies nearby drivers |
| 4. Real-time tracking | Socket.IO rooms per ride, live driver marker and ETA, "Driver is arriving" / "arrived" / "started" notifications, GPS simulator or real driver GPS |
| 5. Fare estimation | Base + per-km + per-min + stop fee, minimum fare, **demand-based surge** (open requests vs. idle drivers) + peak hours, full fare breakdown |
| 6. Payments (Stripe) | Card / UPI / Wallet / Cash; mock gateway with success and decline paths, real Stripe adapter; 80% driver share; payouts |
| 7. History & receipts | Search/filter/sort/paginate history, **PDF receipts**, receipt **email** with PDF attached |
| 8. Cancelling | Free before a driver accepts and within the free window; fee after that; driver cancel re-matches the rider |
| 9. Ratings & reviews | 1–5 stars, tags, comment; running average on the driver; public driver profile; driver ratings page with distribution |
| 10. Multi-stop rides | Up to 3 stops, routed and priced (₹15/stop), shown to the driver |
| 11. Promo codes | Percent/flat, cap, minimum fare, expiry, global and per-user limits; "view offers"; admin CRUD |
| 12. Emergency SOS | Shares live location and vehicle with emergency contacts by SMS, alerts admins in real time, admin acknowledge/resolve |
| 13. Help & support | Categorised tickets linked to rides, threaded replies, admin status/priority, notifications both ways |
| Driver dashboard | Online/offline, real-time requests, accept/decline, arrive, PIN start, complete, cancel, earnings charts, payouts |
| Admin (extra) | KPIs, 14-day ride and revenue charts, rides/users/payments tables, promos, SOS, outbox |
| Responsive UI | Sidebar on desktop, drawer on mobile, responsive grids/tables |

---

## 4. Architecture

```
CabConnect/
├── package.json             # root scripts (install:all, dev, seed, test, build, lint)
├── server/
│   ├── .env.example
│   ├── src/
│   │   ├── config/          # env, db connection, business constants (ride types, statuses)
│   │   ├── models/          # Mongoose schemas
│   │   ├── controllers/     # thin HTTP handlers
│   │   ├── routes/          # all REST routes (index.js)
│   │   ├── middleware/      # auth (JWT/roles), zod validation, sanitize, upload, errors
│   │   ├── services/        # business logic: ride lifecycle, matching, fares, tracking,
│   │   │   ├── payment/     #   payments, receipts, promos, reviews, SOS, notifications
│   │   │   ├── maps/        # ← integration adapters (mock + real), chosen by env
│   │   │   ├── email/
│   │   │   └── sms/
│   │   ├── sockets/         # Socket.IO server (JWT auth, rooms, driver GPS input)
│   │   ├── validators/      # zod request schemas
│   │   ├── seed/            # demo data
│   │   ├── app.js           # express app (used by tests)
│   │   └── server.js        # http + socket bootstrap, request-expiry sweeper
│   └── tests/               # Jest + Supertest API tests
└── client/
    ├── .env.example
    └── src/
        ├── theme/           # Chakra theme (brand teal, accent amber, semantic tokens)
        ├── services/        # axios instance (api.js) + every endpoint (endpoints.js)
        ├── context/         # AuthContext, SocketContext (live notifications)
        ├── hooks/           # useAsync, useDebounce, useApiAction
        ├── layouts/         # AppLayout (sidebar/drawer), AuthLayout
        ├── components/      # RideMap, PlaceInput, PaymentMethodSelect, FareBreakdown, …
        ├── pages/           # rider/, driver/, admin/, auth/
        └── utils/           # formatting helpers
```

**Ride state machine:** `requested → accepted → arriving → in_progress → completed`, and `cancelled` from any pre-trip state. Accepting is atomic: one `findOneAndUpdate` on `status: 'requested'`, after claiming the driver, so two drivers can't take the same ride and one driver can't hold two.

**API response format:** success is `{ success: true, data, meta? }` and errors are `{ success: false, error: { message, details? } }`. All errors go through `middleware/error.js`, which maps Mongoose validation, cast and duplicate-key errors plus Multer and JSON parse errors to clean 4xx responses.

**Security:** bcrypt password hashing, JWT with role checks, Helmet, CORS allow-list, rate-limited auth routes, stripping of NoSQL operators (`$`/`.` keys), Zod validation on every write, server-side ownership checks, ride PIN hidden from drivers, card tokens never serialized, generic login errors (no account enumeration).

### MongoDB models

| Model | Purpose | Key indexes |
|---|---|---|
| `User` | riders/drivers/admins; payment methods, emergency contacts, wallet, `driver` sub-doc (vehicle, online/busy, GeoJSON location, rating, earnings) | unique email, unique sparse phone, `2dsphere` on `driver.location`, role/online/busy |
| `Ride` | places, stops, route polyline, fare breakdown, status timeline, PIN, payment status, offered/declined drivers | rider+date, driver+date, status+type |
| `Payment` | each charge attempt (fare or cancellation fee), provider ref, driver share, receipt no. | ride, status+date, unique receipt no. |
| `Review` | one per ride | unique ride, driver+date |
| `PromoCode` | discount rules and usage counters | unique code |
| `SupportTicket` | threaded messages | user, status |
| `SosAlert` | emergency alerts and resolution | ride, status |
| `Notification` | in-app inbox (also pushed by socket) | user+read+date |
| `MessageLog` | every email/SMS sent (real or mock) | — |
| `Payout` | driver cash-outs | driver |

### REST API (prefix `/api`)

| Area | Endpoints |
|---|---|
| Meta | `GET /health`, `GET /config` (active providers, cancellation rules) |
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/social`, `GET /auth/me`, `POST /auth/change-password` |
| Profile | `PATCH /users/me`, `POST/DELETE /users/me/avatar`, `PUT /users/me/vehicle`, `POST /users/me/payment-methods`, `DELETE /users/me/payment-methods/:pmId`, `PATCH /users/me/payment-methods/:pmId/default`, `POST /users/me/emergency-contacts`, `DELETE /users/me/emergency-contacts/:contactId`, `POST /users/me/wallet/top-up` |
| Maps | `GET /maps/search?q=`, `GET /maps/reverse?lat=&lng=` |
| Rides | `GET /rides/types`, `POST /rides/estimate`, `POST /rides`, `GET /rides` (page, limit, status, rideType, from, to, q, sort), `GET /rides/active`, `GET /rides/:id`, `POST /rides/:id/cancel`, `POST /rides/:id/pay`, `POST /rides/:id/review`, `POST /rides/:id/sos`, `GET /rides/:id/receipt` (PDF), `POST /rides/:id/receipt/email` |
| Driver | `PATCH /driver/status`, `POST /driver/location`, `GET /driver/requests`, `POST /driver/rides/:id/{accept,decline,arrive,start,complete}`, `GET /driver/earnings`, `POST /driver/payouts`, `GET /driver/reviews`, `GET /drivers/:id` |
| Promos | `GET /promos`, `POST /promos/validate` |
| Notifications | `GET /notifications`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all` |
| Support | `POST/GET /support/tickets`, `GET /support/tickets/:id`, `POST /support/tickets/:id/messages`, `PATCH /support/tickets/:id` (admin) |
| Admin | `GET /admin/stats`, `GET /admin/users`, `PATCH /admin/users/:id`, `GET /admin/rides`, `GET /admin/payments`, `GET/POST /admin/promos`, `PUT/DELETE /admin/promos/:id`, `GET /admin/sos`, `PATCH /admin/sos/:id`, `GET /admin/outbox` |

**Socket.IO events.** Client → server: `ride:join`, `ride:leave`, `driver:location {rideId, lat, lng}`. Server → client: `ride:request`, `ride:taken`, `ride:update`, `ride:location`, `notification:new`, `sos:new` (admins).

---

## 5. Mocked integrations & switching to real services

Every external service sits behind an adapter with the same interface. **Everything defaults to `mock`, so the app runs with zero credentials.** Set the provider variable in `server/.env` and restart.

| Integration | Default mock behaviour | Switch to real | Credentials needed |
|---|---|---|---|
| **Payments** (`services/payment`) | Luhn-checks and tokenises test cards; card ending **0002** → declined, **9995** → insufficient funds; UPI IDs containing `fail` fail; payouts succeed | `PAYMENT_PROVIDER=stripe` | `STRIPE_SECRET_KEY`. The client must then collect cards with Stripe Elements and send the `pm_…` id as `providerToken` (raw card numbers are rejected). Driver payouts need Stripe Connect accounts. |
| **Maps** (`services/maps`) | 40 Bengaluru landmarks for search/reverse-geocode; routes are curved polylines with ×1.3 road factor and ~24 km/h ETA | `MAPS_PROVIDER=google` | `GOOGLE_MAPS_API_KEY` with Places, Geocoding and Directions APIs enabled |
| **Map tiles** (client) | OpenStreetMap via Leaflet: real and free, needs internet | — | none |
| **Social login** (`services/socialAuthService.js`) | "Continue with Google" opens a demo dialog and sends a `mock-google.<payload>` token | `SOCIAL_AUTH_PROVIDER=google` | `GOOGLE_CLIENT_ID`. The server verifies real ID tokens. On the client, load Google Identity Services and post its `credential` to `/api/auth/social`. |
| **Email receipts** (`services/email`) | Logged to the `MessageLog` collection (Admin → Email & SMS log) and the console | `EMAIL_PROVIDER=smtp` | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` |
| **SOS SMS** (`services/sms`) | Logged to `MessageLog` | `SMS_PROVIDER=twilio` | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` |
| **Emergency services (112)** | No public API exists, so dispatch is simulated and logged | — | — |
| **Driver GPS** (`services/trackingService.js`) | Simulator moves the driver along the route (`SIMULATE_DRIVER_MOVEMENT=true`) | Driver devices emit `driver:location` over the socket (or `POST /driver/location`); real GPS automatically stops the simulator for that ride | — |

`.env.example` files use explicit `REPLACE_WITH_…` placeholders. No working credentials are included.

---

## 6. Environment variables

`server/.env` (see `server/.env.example` for all of them):

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `5000` | |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/cabconnect` | Atlas: `mongodb+srv://…` |
| `USE_IN_MEMORY_DB` | `false` | dev fallback, auto-seeds |
| `CLIENT_URL` | `http://localhost:5173` | CORS allow-list (comma-separated) |
| `JWT_SECRET` / `JWT_EXPIRES_IN` | — / `7d` | **required in production** |
| `AUTH_RATE_LIMIT` | `30` prod / `200` dev | login/register attempts per IP per 15 min |
| `MATCH_RADIUS_KM` | `8` | driver search radius |
| `CANCELLATION_FREE_WINDOW_MIN` / `CANCELLATION_FEE` | `2` / `50` | |
| `DRIVER_EARNING_SHARE` | `0.8` | |
| `SIMULATE_DRIVER_MOVEMENT` / `SIMULATION_TICK_MS` | `true` / `2000` | lower the tick for faster demos |
| `PAYMENT_PROVIDER`, `MAPS_PROVIDER`, `SOCIAL_AUTH_PROVIDER`, `EMAIL_PROVIDER`, `SMS_PROVIDER` | `mock` | see section 5 |

`client/.env`: `VITE_API_URL` (empty = use the Vite proxy) and `VITE_PROXY_TARGET` (default `http://localhost:5000`).

---

## 7. Scripts, tests & checks

| Command (root) | What it does |
|---|---|
| `npm run install:all` | install root, server and client deps |
| `npm run seed` | reset demo collections and load seed data |
| `npm run dev` / `npm run dev:memory` | API + web together (real MongoDB / in-memory) |
| `npm test` | backend Jest suite (spins up its own in-memory MongoDB; set `TEST_MONGODB_URI` to use an existing server) |
| `npm run lint` | server syntax check + client ESLint |
| `npm run build` | production build of the client (`client/dist`) |
| `npm start` | API in production mode (serve `client/dist` from any static host) |

The test suite (30 tests) covers auth and roles, NoSQL-injection blocking, fare estimation with multi-stop and promos, the full ride lifecycle (book → match → accept race → PIN start → SOS → complete → declined/successful payment → receipt PDF/email → rating), cancellation fees, driver cancel re-matching, payment-method validation, wallet top-up, support tickets, admin suspend and promo CRUD, and error handling.

---

## 8. Troubleshooting

| Symptom | Fix |
|---|---|
| `Failed to start server: connect ECONNREFUSED 127.0.0.1:27017` | MongoDB isn't running. Start it, fix `MONGODB_URI`, or use `npm run dev:memory`. |
| Login says "Cannot reach the server" | The API isn't running on :5000, or `VITE_PROXY_TARGET` points elsewhere. |
| Map is grey | Map tiles come from openstreetmap.org and need internet access. Everything else works without them. |
| Driver never gets the request | The driver must be **online**, not on a ride, have the **same ride type**, and be within `MATCH_RADIUS_KM` of the pickup. Click the driver's map near the pickup to move them. |
| "You already have an active ride" | Finish or cancel it from *My rides* (one active ride per rider). Or re-run `npm run seed`. |
| `mongodb-memory-server` download fails | Your network blocks `fastdl.mongodb.org`. Install MongoDB locally, or point `MONGOMS_SYSTEM_BINARY` at an existing `mongod`. |
| Real-time indicator shows "Offline" | The socket reconnects automatically; pages fall back to polling meanwhile. Check that the API is up. |
| Port in use | Change `PORT` (server) or run `npx vite --port 5174` (client) and update `CLIENT_URL`. |

---

## 9. Assumptions

- The default city is **Bengaluru** and the currency is **INR** (the brief mentions UPI). The mock maps provider knows Bengaluru places; the Google provider works anywhere.
- After a non-cash ride, payment is collected **after** the trip (as in the brief's flow); cash is marked paid when the driver completes the trip.
- A rider sees the 4-digit ride PIN; the driver must enter it to start the trip.
- Drivers who decline or cancel a request won't be offered it again.
- New riders get a ₹200 welcome wallet credit, so the wallet flow can be demoed straight away.

---

## 10. Code review findings (all fixed ✅)

A `/code-review` pass found 10 issues. Each one is fixed below. ✅ means fixed and verified. The backend fixes have Jest tests; the frontend fixes were reproduced in a real browser with Playwright before and after the fix.

| # | Severity | Where | Problem | Fix | Status |
|---|---|---|---|---|---|
| 1 | High | `client/src/pages/rider/RideDetail.jsx` | After cancelling a **cash** ride (fee due), the pay form hid "Cash" but still had it selected, so no radio was checked and **Pay** sent `cash`, which the server rejects. | An effect watches `ride.status`. When the ride becomes cancelled, a `cash` selection switches to the rider's default card/UPI (or wallet). | ✅ |
| 2 | High | `client/src/pages/rider/Profile.jsx` (Wallet) | The top-up source was set only at mount: empty after adding the first card ("Add a card first") and stale after removing one (server 400). | The selected source is now *derived* from the saved methods and falls back to the default/first one when nothing valid is picked. | ✅ |
| 3 | Medium | `client/src/pages/rider/BookRide.jsx` | Clearing pickup/drop-off while a quote was loading left `quoting=true`, so loading skeletons spun forever, and old errors stayed on screen. | The early-return branch now also resets `quoting` and `quoteError`. | ✅ |
| 4 | Medium | `client/src/pages/admin/AdminPromos.jsx` | `expiresAt` was sent as `YYYY-MM-DD`, read as UTC midnight, so a promo "expiring 20 Oct" died at 05:30 IST that morning. | Sends the **end of the chosen local day** (`T23:59:59.999`) and shows the date back in local time when editing. | ✅ |
| 5 | Medium | `AdminPromos.jsx` + `server/src/services/promoService.js` | A hidden, stale `maxDiscount` was still sent for **flat** promos, and the server applied the cap to flat promos too (₹150 off became ₹100). | The client sends `maxDiscount: null` for flat promos, and the server applies the cap **only** to percentage promos. Test: *maxDiscount never caps a flat promo*. | ✅ |
| 6 | Medium | `RideDetail.jsx` | The cancel dialog worked out the fee from the phone's clock (`Date.now()`), so it could say "free" while the server charged ₹50. | Opening the dialog re-fetches the ride and shows the server's `cancellationFeeIfCancelledNow`. | ✅ |
| 7 | Low | `client/src/services/api.js` | For file downloads (receipt PDF), error bodies arrive as a `Blob`, so the real message was lost ("Request failed (400)"). | The error interceptor parses JSON `Blob` bodies before reading `error.message`. | ✅ |
| 8 | Low (perf) | `server/src/services/fareService.js` | One estimate with a promo ran the **same promo DB query 5×** (once per ride type). | `promoService` is split into `loadUsable()` (one DB read) and a pure `discountFor()` per ride type. Test: *an estimate looks up the promo once*. | ✅ |
| 9 | Low | `client/src/context/AuthContext.jsx` | Login set the token, which re-ran the session-restore effect: an extra `GET /auth/me`, and any blip on that call logged the user out. | The restore runs **once on load** and only logs out on 401/403, never on network errors. | ✅ |
| 10 | Cleanup | `Profile.jsx` | Three hand-written copies of `refreshUser` (one of them also called `setUser` twice). | All of them use `refreshUser()` from `AuthContext`. | ✅ |

**Checks after the fixes:** backend tests 32/32 (2 new), client ESLint clean, production build OK, a browser script reproducing all 10 scenarios passes, and the full 27-step end-to-end flow still passes.

---

## 11. Design critique fixes (all implemented ✅)

A `/design:design-critique` review of the UI (landing, booking, tracking, payment, history, driver, admin and mobile screens) led to these changes. Each one was checked in the running app with a Playwright script that measures real colours and sizes.

### Priority recommendations
| # | Problem | Fix | Where | Status |
|---|---|---|---|---|
| 1 | **Button/link contrast failed WCAG AA.** White text on `brand.500` was **2.5:1**, and teal links (`brand.600`) were **3.7:1** (4.5:1 is required). | Solid brand buttons now use `brand.700` (hover `800`, active `900`). Outline, ghost and link buttons, `<Link>` and all teal text use `brand.700`. Measured: **5.47:1**. | `theme/index.js`, all pages (`brand.600 → brand.700`) | ✅ |
| 2 | **Mobile booking showed the map first**, pushing the pickup/drop-off inputs and the Book button below the fold. | Inputs come first on every screen size, and the mobile map is shorter (220px). Measured: pickup input at y=213, map below it. | `pages/rider/BookRide.jsx` | ✅ |
| 3a | **Sidebar icons rendered as tiny dots** (`boxSize={4.5}` isn't a Chakra spacing token). | `boxSize={5}` (measured: 20px). | `layouts/AppLayout.jsx` | ✅ |
| 3b | **After a trip, Pay was below the "You have arrived" card.** | The next action (Pay, then Rate) is the first card in the side column. | `pages/rider/RideDetail.jsx` | ✅ |

### Usability & consistency
| Problem | Fix | Status |
|---|---|---|
| The pay screen said "Cash: Pay the driver at drop-off" *after* the trip | After a trip it reads "Cash: Paid to the driver directly" (`PaymentMethodSelect` `afterTrip` prop) | ✅ |
| "130 km travelled" was shown under the **Cancelled** card | Moved under **Completed trips** | ✅ |
| Open ride requests on the driver map used the numbered **stop** pin | New amber **price-tag marker** (e.g. "₹130") through a `requests` prop on `RideMap`; the helper text is updated | ✅ |
| Every history row repeated "Receipt PDF" + "Details" | Rows use a compact **download icon** (`ReceiptActions compact`); the full buttons stay on the ride page | ✅ |
| Payment and ride status badges were both loud green side by side | Payment badge is neutral grey when paid / no charge, and orange or red only when the rider must act | ✅ |

### Accessibility
| Problem | Fix | Status |
|---|---|---|
| Small icon buttons (clear ×, use-location, remove card) were 32px on phones | `Button` sizes `sm`/`xs` are **44px / 36px on mobile** and stay 32px / 24px on desktop. Measured: 44×44. | ✅ |
| Captions at 10px (`fontSize="2xs"`) | Minimum caption size is now 12px (`xs`) | ✅ |

**Checks:** client ESLint clean, production build OK, the design checks pass 8/8, and the full end-to-end flow passes 27/27. (An occasional failure at the "start trip" step turned out to be a real PIN-entry bug, fixed in section 12.)

---

## 12. Debug report: driver PIN sometimes lost a digit ✅ fixed

**Symptom.** About 1 in 5 end-to-end runs failed at "driver starts the trip": the **Start trip** button stayed disabled after typing the rider's PIN.

**Reproduction.**
- **Expected:** typing `5604` fills the PIN and enables *Start trip*.
- **Actual (captured on failure):** the boxes held `6, 0, 4, (empty)`. The **first digit was lost**.
- **Deterministic repro:** delay `requestAnimationFrame` by 150ms (like a slow or busy phone) and type the PIN at full speed. It failed **3/3**, leaving only the last digit (e.g. `9788 → [8,,,]`).

**Root cause.** Chakra UI's `PinInput` moves focus to the next box **on the next animation frame** (`requestAnimationFrame` in `use-pin-input.mjs`), not right away. If the next keystroke arrives before that frame, which happens when the driver page is busy re-drawing the live map, it lands in the *same* box, and Chakra keeps only the newest character, overwriting the previous digit. Fast typists, SMS one-time-code autofill and slow devices can all hit this; it isn't only a test problem.

**Fix.** `client/src/pages/driver/DriverDashboard.jsx`: the 4-box `PinInput` is replaced with **one numeric `<Input>`** (`inputMode="numeric"`, `autoComplete="one-time-code"`, `maxLength={4}`, non-digits stripped, **Enter** starts the trip). No focus has to move between boxes, so no keystroke can be lost. It also improves accessibility: one properly labelled field instead of four boxes all labelled "Please enter your pin code". The rider's read-only PIN display is unchanged.

**Verification.**
- Deterministic repro after the fix: **3/3 pass**, full PIN entered and *Start trip* enabled.
- Full 27-step end-to-end flow: **6/6 runs pass** (it was about 4/5 before).

**Prevention.**
- The end-to-end flow types the PIN at full speed through the labelled input.
- Avoid multi-box OTP widgets that move focus asynchronously for anything typed under time pressure, or test them with slowed animation frames.
