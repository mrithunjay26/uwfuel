# UW Fuel

**A nutrition and fitness companion for University of Washington students.** UW Fuel turns live campus dining data into budget aware AI meal plans, pairs them with a full workout logger and progress tracker, and runs entirely on credentials each student owns. No shared server, no shared quota, no vendor lock in.

> Live UW dining menus → AI meal plans that fit your budget → a workout logger with a 1,300+ exercise library → progress charts. All in one installable web app.

Built with **Next.js 16 (App Router + Turbopack), React 19, TypeScript, Tailwind CSS v4, Firebase, and Cohere.**

Repository: https://github.com/mrithunjay26/uwfuels

---

## Table of contents

- [Why this exists](#why-this-exists)
- [Feature tour](#feature-tour)
- [Architecture at a glance](#architecture-at-a-glance)
- [Privacy and security model](#privacy-and-security-model)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [How the budget aware planner works](#how-the-budget-aware-planner-works)
- [Data sources](#data-sources)
- [Engineering highlights](#engineering-highlights)
- [Roadmap](#roadmap)
- [About the author](#about-the-author)
- [License and disclaimer](#license-and-disclaimer)

---

## Why this exists

Eating well on a student meal plan is genuinely hard. Dining dollars vanish before the month ends, you never quite know what is open or what fits your macros, and most nutrition apps know nothing about campus dining halls. UW Fuel was built to make the smart choice the easy one, using the real University of Washington Housing and Food Services menu, with real prices and real open hours, plus an AI assistant that respects your wallet and your goals.

The project also serves as a reference implementation of a **self hostable, bring your own key web app**: every user supplies their own AI key and can optionally connect their own database, so the app costs the maintainer nothing per user and never holds anyone else's secrets.

---

## Feature tour

### Campus dining, live

- Browse the current UW dining menu by location, station, and category.
- Real prices, calories, and estimated macros for every item.
- Open or closed status computed against Pacific time, so availability is correct no matter where you load the app from.
- Dietary filters (vegan, vegetarian, high protein, low calorie) and search and sort.
- Tap any item for a full detail sheet with macro rings, then log it in one tap.

### AI meal planner

- Generates a full day of meals from **real menu items that actually fit your budget.** It will never inflate a plan past your cap or invent a price (see [how it works](#how-the-budget-aware-planner-works)).
- Class aware walking routes: pin your buildings and the planner suggests stops timed to your schedule, with one tap Google Maps directions.
- Save, edit, delete, and reactivate plans from a personal plan library.
- Log any planned meal straight into your daily journal.

### Nearby pick

Uses your location (only with permission, computed on device) to surface the single best real food item near you that fits your budget right now, with walking directions and a one tap log.

### Workout logger and trainer

- A dedicated logger with a calendar, per set weight and reps entry, automatic personal record detection, rep max records, and volume charts per exercise.
- Specific body parts worked are surfaced on each logged exercise.
- An AI trainer that builds sessions from a library of **1,300+ exercises** (with animated demos), adds a short form cue to each movement, and exports the session straight into the logger to fill in weights.

### Progress

Calorie, macro, weight, and spend trends over selectable ranges, an editable food journal, and per day breakdowns.

### Everything else

- Email and Google authentication.
- Light theme by default with a dark mode toggle.
- Installable PWA with service worker meal reminders and an in app install prompt.
- A beginner friendly, walkthrough style setup guide built into the app.

---

## Architecture at a glance

UW Fuel is a single Next.js App Router application split into three route groups:

| Route group | Purpose | Auth |
| --- | --- | --- |
| `(public)` | Landing page, setup guide, terms, privacy | None |
| `(onboarding)` | Welcome, sign up, log in, key and database setup | Partial |
| `(app)` | Dashboard, menu, plan, chat, workout, log, progress, profile | Required |

Data flows through two Firebase Realtime Database projects:

1. **Shared project (maintainer owned, read only for users):** holds the scraped UW dining menus and the exercise library. Every user reads the same public data.
2. **Per user data:** stored either in the shared project under a node scoped to the authenticated user, or in the user's own Firebase project if they choose to connect one.

React talks to the database through a set of typed hooks built on Firebase `onValue`, so screens update reactively as data changes. AI requests are sent **from the browser using the user's own Cohere key**, never proxied through a maintainer server.

---

## Privacy and security model

This was a first class design goal, not an afterthought.

- **No secrets in local storage.** A user's Cohere API key and optional personal Firebase config are stored under their authenticated account node in the database, not in `localStorage`. This reduces exposure to cross site scripting.
- **Per user isolation.** Security rules scope every user to their own subtree. One user can never read another user's data.
- **Bring your own key.** AI runs on the user's own Cohere key, billed to them, with no shared quota. The maintainer never sees it.
- **Optional full ownership.** Any user can connect their own Firebase project and own 100% of their data.
- **Public data stays public.** Dining menus and the exercise library contain no personal information and are read only for everyone.

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16.2.7 (App Router, Turbopack) |
| UI runtime | React 19.2 |
| Language | TypeScript 5 (strict mode) |
| Styling | Tailwind CSS v4, CSS variable design tokens, custom glassmorphism |
| Auth and data | Firebase 12 (Authentication + Realtime Database) |
| AI | Cohere API (client supplied key) |
| Maps | Leaflet with OpenStreetMap tiles, Google Maps for directions |
| Icons | lucide-react |
| Data pipeline | Python scrapers for dining menus and the exercise library |
| PWA | Web app manifest, service worker, scheduled notifications |

---

## Project structure

```
src/
  app/
    (public)/          Landing, setup guide, terms, privacy
    (onboarding)/      Welcome, login, signup, key + database setup
    (app)/             Dashboard, menu, plan, chat, workout, log, progress, profile
    layout.tsx         Root layout, metadata, theme bootstrap
    manifest.ts        PWA manifest
    globals.css        Design tokens and base styles
  components/
    app/               Feature components (sheets, modals, maps, cards)
    docs/              Documentation building blocks for the guide
    landing/           Marketing landing page
    onboarding/        Key and database connection forms
    brand/  system/  ui/   Logo, theme toggle, design primitives
  lib/
    ai/                Cohere client, prompt building, plan generation
    auth/              Auth context
    config/            Per user config (Cohere key, Firebase) types and storage
    db/                Paths, types, and CRUD write helpers
    firebase/          App initialization and connection testing
    hooks/             Reactive data hooks over Firebase
    menu/              Menu flattening and filtering
    theme/             Theme context and pre-paint bootstrap
    utils/  workout/   Nutrition math, notifications, parsing
```

---

## Getting started

### Prerequisites

- Node.js 20 or newer
- A free [Cohere](https://cohere.com) account (for AI features)
- A [Firebase](https://firebase.google.com) project with Authentication and Realtime Database enabled

### Install and run

```bash
git clone https://github.com/mrithunjay26/uwfuels.git
cd uwfuels
npm install
npm run dev
```

Open http://localhost:3000 and follow the in app setup guide.

### Build for production

```bash
npm run build
npm run start
```

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |

---

## Configuration

UW Fuel is configured by the user inside the app, not through build time secrets. After signing up:

1. **Add your Cohere key.** Go to Profile, then AI key, paste your key, test it, and save. This unlocks the chat, meal planner, and workout generator.
2. **(Optional) Connect your own database.** Go to Profile, then Data Storage, and paste your own Firebase config to store your personal data in your own project. If you skip this, your data lives in the shared project isolated to your account.

The in app setup guide walks through both steps in plain language, including how to create a free Cohere key and a Firebase Realtime Database.

The shared dining project is configured through public environment variables (it holds only public, read only data). See `src/lib/firebase` for the initialization pattern.

### Meal scanner (camera, barcode, type-it)

Photo + "type-it" analysis is powered by **the user's own free keys**, so **nobody pays out of
pocket**. The server route tries them in order:

1. **Cohere** (Command A Vision) — the same key set in Profile → AI key.
2. **Groq** (free, generous) — an optional key added in **Profile → Meal scanner key**.
3. A server-side fallback provider (`VISION_PROVIDER`), used only if neither user key is present.

Both user keys live per-account in the same place as the Cohere key (`users/{uid}/account`). They're
sent to our own `/api/nutrition/*` route (same origin), which calls the provider, then grounds the
numbers via USDA FDC. Copy `.env.example` to `.env.local` and set:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SCAN_ENABLED` | `true` shows the camera/scan entry points (Dashboard + Dining header). |
| `VISION_PROVIDER` | Optional server fallback: `groq` (recommended), `gemini`, `claude`, or `none`. |
| `GROQ_API_KEY` | Optional server fallback key from [console.groq.com](https://console.groq.com/keys). |
| `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` | Only if you pick that fallback provider instead. |
| `FDC_API_KEY` | Free [USDA FoodData Central](https://fdc.nal.usda.gov/api-key-signup) key — grounds generic-food numbers and powers manual search. |

**Getting a free Groq key (recommended for users):** sign in at
[console.groq.com/keys](https://console.groq.com/keys), create a key (starts with `gsk_`), and paste
it into Profile → Meal scanner key → Add. It's validated, stored on your account, and used for
scanning whenever Cohere isn't set or is busy.

Barcodes use [Open Food Facts](https://world.openfoodfacts.org/) (no key) with the native
`BarcodeDetector` where available and a lazily-loaded [ZXing](https://github.com/zxing-js/library)
fallback on desktop browsers. **No server key or third-party call ships to the browser.** The camera
requires HTTPS (Vercel) or `localhost`. There is no FatSecret dependency.

### Online ordering (Dub Grub)

Menu items at orderable HFS venues show an **Order on Dub Grub** button that opens
`order.hfs.uw.edu`. Exact item deep-links populate automatically once the dining scraper writes an
`order_url` onto an item (see `src/lib/dining/ordering.ts`); until then it opens the storefront and
copies the item name to search.

---

## How the budget aware planner works

The planner's core rule: **find meal items that fit the budget, never bend the budget to fit a plan.**

1. Pull today's real menu (items, prices, calories, estimated macros, open status) from the shared database.
2. Build a Cohere prompt that includes the user's goal, dietary preferences, meal count, hard budget cap, and the exact menu with exact prices.
3. Instruct the model to choose only from the supplied items, reuse their exact prices, and return fewer meals rather than exceed the cap.
4. Parse the response, then enforce the budget in code as a safety net: totals are recomputed from real prices, and the plan is flagged if it ever exceeds the cap.

Prices are never rescaled or fabricated to make a plan look like it fits. If a target cannot be met, the user sees an honest message instead of a misleading plan.

---

## Data sources

- **Dining:** UW Housing and Food Services menus, hours, and pricing are scraped into the shared Firebase project. This is public information and contains no personal data.
- **Exercises:** A library of 1,300+ exercises (names, target muscles, and animated demos) is scraped and stored in the shared project, powering both the AI trainer and the logger's exercise lookup.

Both pipelines are Python services that write to the shared Realtime Database; the app only ever reads them.

---

## Engineering highlights

A few pieces that went beyond wiring up a CRUD app:

- **Reactive, typed data layer.** Every personal data path has a typed hook over Firebase `onValue`, with defensive normalization for Realtime Database quirks (dropped empty arrays, array versus object shapes, missing fields).
- **Time correct availability.** Open and closed status is computed against Pacific time so a dining hall never shows as open at the wrong hour, regardless of the device's clock or timezone.
- **Budget enforcement as an algorithm,** not a prompt hope: the model's output is re validated against real prices in code.
- **Custom design system.** CSS variable tokens, a light and dark theme with a pre paint bootstrap script to avoid a flash of the wrong theme, and a restrained glassmorphism component set.
- **PWA depth.** Installable, with a service worker that schedules meal reminder notifications and an install prompt banner.
- **Scale.** The UI stays responsive against a 1,300+ item exercise library through careful filtering and lookup.
- **Security first config.** Sensitive credentials live in the authenticated database subtree rather than browser storage.

---

## Roadmap

UW Fuel is actively developed. Current focus areas include richer progress analytics, smarter routing between classes and dining locations, and broader exercise demonstrations. The auth, onboarding, dining, planning, logging, and progress flows are complete and in use.

---

## About the author

Built and maintained by **Mrithunjay Tanish Shanmuganand**, a University of Washington student.

UW Fuel is a solo project covering the full stack: product design, a custom design system, authentication, a reactive Firebase data layer, AI integration, two Python data pipelines, and a polished installable PWA. It is meant to be a genuinely useful tool for UW students while also demonstrating end to end product engineering.

Find more at https://github.com/mrithunjay26

---

## License and disclaimer

Released under the MIT License.

UW Fuel is an independent student project. It is **not affiliated with, endorsed by, or sponsored by** the University of Washington or UW Housing and Food Services. Dining data is public information and may be outdated or incorrect; always verify with the dining location. Calorie targets, macros, and AI suggestions are informational only and are not a substitute for professional medical, nutritional, or fitness advice.
#
