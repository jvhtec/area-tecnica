# ARCHITECTURE.md — Area Tecnica (Sector Pro)

> **Last updated**: 2026-03-18
> **Repository**: github.com/jvhtec/area-tecnica
> **Team**: Sector Pro Engineering
> **Platform**: sector-pro.work

---

## Table of Contents

1. [Project Structure](#1-project-structure)
2. [High-Level System Diagram](#2-high-level-system-diagram)
3. [Core Components](#3-core-components)
4. [Data Stores](#4-data-stores)
5. [External Integrations](#5-external-integrations)
6. [Deployment & Infrastructure](#6-deployment--infrastructure)
7. [Security Considerations](#7-security-considerations)
8. [Development & Testing](#8-development--testing)
9. [Future Considerations](#9-future-considerations)
10. [Glossary](#10-glossary)
11. [Project Identification](#11-project-identification)

---

## 1. Project Structure

```text
area-tecnica/
├── .claude/                          # Claude Code workspace
│   ├── commands/                     # Custom slash commands (7 commands)
│   ├── skills/                       # Custom skills (plan-review, techdebt)
│   └── notes/                        # Session notes and learnings
│
├── .github/                          # GitHub configuration
│   ├── workflows/
│   │   └── tests.yml                 # CI: lint, test, build, e2e
│   ├── CODEOWNERS                    # Code ownership rules
│   ├── pull_request_template.md
│   └── GIT_HYGIENE.md
│
├── android/                          # Capacitor Android project
│   ├── app/src/                      # Android source code
│   ├── build.gradle                  # Gradle build config
│   └── capacitor.settings.gradle
│
├── docs/                             # Documentation (60+ files)
│   ├── AUDIT_REPORT_*.md             # Audit reports
│   ├── *-workflow.md                 # Workflow documentation
│   └── PUSH_NOTIFICATIONS_*.md       # Feature implementation docs
│
├── ios/                              # Capacitor iOS project
│   ├── App/                          # Xcode project
│   └── CapApp-SPM/                   # Capacitor Swift Package
│
├── memory-bank/                      # Context & progress notes
│   ├── activeContext.md
│   ├── productContext.md
│   ├── progress.md
│   ├── projectbrief.md
│   ├── systemPatterns.md
│   └── techContext.md
│
├── public/                           # Static assets & PWA
│   ├── manifest.json                 # PWA manifest
│   ├── sw.js                         # Service Worker
│   ├── _headers / _redirects         # Cloudflare routing rules
│   ├── Logos/                        # Company logos
│   ├── fonts/                        # Custom fonts
│   ├── icons/                        # Icon assets
│   └── stageplot/                    # Stage plot templates
│
├── scripts/                          # Build & utility scripts
│   ├── worktree.sh                   # Git worktree management
│   ├── inject-sw-version.mjs         # SW version injection (post-build)
│   ├── check-staged-secrets.sh       # Pre-commit secret detection
│   └── streamdeck/                   # Stream Deck server
│
├── SectorProWallboard/               # LG webOS wallboard app
│   ├── appinfo.json                  # webOS manifest
│   └── launcher.js                   # Launcher UI
│
├── streamdeck-plugin/                # Elgato Stream Deck plugin
│   └── com.jvhtec.areatecnica.sdPlugin/
│
├── supabase/                         # Supabase backend
│   ├── config.toml                   # Local Supabase config
│   ├── seed.sql                      # Database seed data
│   ├── migrations/                   # 98 SQL migration files
│   │   ├── 00000000000000_production_schema.sql  # Initial schema (10,500 lines)
│   │   └── 20260305120000_*.sql      # Latest migration
│   └── functions/                    # 61 Edge Functions (Deno/TypeScript)
│       ├── push/                     # Push notification service
│       ├── send-*-email/             # Email services (11 functions)
│       ├── create-flex-folders/      # Flex ERP integration
│       ├── create-whatsapp-group/    # WhatsApp automation
│       ├── staffing-orchestrator/    # Staffing campaign engine
│       └── ...
│
├── supabase-server/                  # Backend server utilities
│
├── tests/                            # Integration & E2E tests
│   ├── assignments/                  # Assignment system tests
│   ├── timesheets/                   # Timesheet calculation tests
│   └── e2e/                          # Playwright E2E tests
│
├── src/                              # Application source code
│   ├── App.tsx                       # Root component with routes
│   ├── main.tsx                      # React entry point
│   │
│   ├── assets/                       # Static assets (icons, images)
│   │
│   ├── components/                   # Feature-based UI (38 domains)
│   │   ├── auth/                     # Authentication UI + signup flow
│   │   ├── dashboard/                # Dashboard views
│   │   ├── department/               # Department-specific views
│   │   ├── disponibilidad/           # Availability management
│   │   ├── equipment/                # Equipment management
│   │   ├── expenses/                 # Expense tracking
│   │   ├── festival/                 # Festival management
│   │   │   ├── form/                 # Festival creation/edit
│   │   │   ├── gear-setup/           # Equipment setup
│   │   │   ├── mobile/               # Mobile-optimized views
│   │   │   ├── pdf/                  # PDF exports
│   │   │   └── scheduling/           # Shift scheduling
│   │   ├── flex/                     # Flex Rental UI
│   │   ├── hoja-de-ruta/             # Tour book/routing
│   │   │   ├── components/
│   │   │   ├── dialogs/
│   │   │   └── sections/
│   │   ├── incident-reports/         # Incident reporting
│   │   ├── jobs/                     # Job management
│   │   │   ├── cards/                # Job card variants
│   │   │   └── job-details-dialog/
│   │   ├── landing/                  # Public landing page
│   │   ├── layout/                   # App shell & navigation
│   │   ├── lights/                   # Lighting department
│   │   │   └── tools/                # Engineering calculators
│   │   ├── logistics/                # Logistics & warehouse
│   │   ├── maps/                     # Map components (Mapbox)
│   │   ├── matrix/                   # Crew assignment matrix
│   │   │   └── optimized-assignment-matrix/
│   │   ├── messages/                 # Internal messaging
│   │   ├── profile/                  # User profile
│   │   ├── schedule/                 # Scheduling views
│   │   ├── settings/                 # App settings
│   │   ├── sound/                    # Sound/audio department
│   │   │   ├── amplifier-tool/       # Amplifier calculator
│   │   │   └── tools/                # Audio engineering tools
│   │   ├── soundvision/              # SoundVision file management
│   │   ├── tasks/                    # Task management
│   │   ├── technician/               # Technician-specific views
│   │   ├── timesheet/                # Timesheet entry & approval
│   │   ├── tours/                    # Tour management
│   │   │   ├── scheduling/
│   │   │   └── tour-date-management/
│   │   ├── ui/                       # shadcn/ui primitives (30+)
│   │   ├── users/                    # User management
│   │   │   └── import/               # Bulk user import
│   │   ├── video/                    # Video department
│   │   └── wallboard/                # Digital signage
│   │
│   ├── constants/                    # Application constants
│   ├── contexts/                     # React Context providers
│   ├── data/                         # Static data / fixtures
│   │
│   ├── features/                     # Feature modules (co-located logic)
│   │   ├── activity/                 # Activity feed & notifications
│   │   ├── lights/                   # Lighting department logic
│   │   ├── rates/                    # Rate management
│   │   ├── staffing/                 # Crew staffing logic
│   │   └── timesheets/              # Timesheet calculations
│   │
│   ├── hooks/                        # Custom React hooks (100+)
│   │   ├── festival/                 # Festival-specific hooks
│   │   ├── hoja-de-ruta/             # Tour book hooks
│   │   ├── useOptimizedAuth.tsx      # Auth provider (core)
│   │   ├── usePushNotifications.ts   # Push notification hooks
│   │   └── use*.ts                   # Domain-specific hooks
│   │
│   ├── integrations/                 # External service clients
│   │   └── supabase/
│   │       ├── client.ts             # Supabase client instance
│   │       └── types.ts             # Auto-generated DB types (8,999 lines)
│   │
│   ├── legacy/                       # Deprecated code (migration in progress)
│   │
│   ├── lib/                          # Core libraries
│   │   ├── flex/                     # Flex Rental utilities
│   │   ├── shortcuts/                # Keyboard shortcuts engine
│   │   ├── streamdeck/               # Stream Deck WebSocket bridge
│   │   ├── react-query.ts            # Query client & key factories
│   │   ├── optimized-react-query.ts  # Optimized query patterns
│   │   ├── supabase-client.ts        # Enhanced Supabase wrapper
│   │   ├── push.ts                   # Web Push API utilities
│   │   └── push-native.ts           # Capacitor push utilities
│   │
│   ├── pages/                        # Route components (42 pages, lazy-loaded)
│   │   ├── Auth.tsx                  # Auth page
│   │   ├── Dashboard.tsx             # Main dashboard
│   │   ├── Jobs.tsx                  # Job management
│   │   ├── Tours.tsx                 # Tours & festivals
│   │   ├── Timesheets.tsx            # Timesheet management
│   │   ├── JobAssignmentMatrix.tsx   # Crew assignment matrix
│   │   ├── EquipmentManagement.tsx   # Equipment catalog
│   │   ├── festival-management/      # Festival management (multi-file)
│   │   ├── wallboard/                # Wallboard pages
│   │   ├── consumos-tool/            # Power consumption calculator
│   │   └── ...
│   │
│   ├── providers/                    # React providers
│   ├── routes/                       # Routing configuration
│   ├── services/                     # Business logic services
│   ├── stores/                       # Zustand global state
│   │   ├── useSelectedJobStore.ts    # Selected job card state
│   │   ├── useSelectedCellStore.ts   # Matrix cell selection
│   │   ├── useCreateJobDialogStore.ts # Job creation dialog
│   │   └── useShortcutStore.ts       # Shortcut registry (persisted)
│   │
│   ├── test/                         # Test setup
│   │   └── setup.ts                  # Vitest setup
│   │
│   ├── types/                        # TypeScript type definitions
│   │
│   └── utils/                        # Utility functions
│       ├── flex-folders/             # Flex folder hierarchy management
│       ├── hoja-de-ruta/             # Tour book utilities & PDF export
│       ├── incident-report/          # Incident report utilities
│       ├── pdf/                      # PDF generation engine (jsPDF + pdf-lib)
│       ├── stage-plot/               # Stage plot rendering
│       ├── weather/                  # Weather API (Open-Meteo)
│       ├── roleBasedRouting.ts       # Role-based navigation
│       ├── permissions.ts            # Permission checks
│       ├── timezoneUtils.ts          # Timezone handling (Europe/Madrid)
│       └── ...
│
├── capacitor.config.ts               # Capacitor mobile config
├── components.json                   # shadcn/ui configuration
├── eslint.config.js                  # ESLint rules
├── index.html                        # PWA entry point
├── package.json                      # NPM dependencies (139 packages)
├── playwright.config.ts              # Playwright E2E config
├── postcss.config.js                 # PostCSS configuration
├── tailwind.config.ts                # Tailwind CSS config
├── tsconfig.json                     # TypeScript base config
├── tsconfig.app.json                 # App TypeScript config
├── vite.config.ts                    # Vite build config (manual chunks)
└── vitest.config.ts                  # Vitest test config
```

---

## 2. High-Level System Diagram

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                   USERS                                         │
│  Production Companies · Technical Crews · Freelancers · Coordinators            │
└────────┬──────────────────┬────────────────────┬───────────────────┬────────────┘
         │                  │                    │                   │
    ┌────▼────┐     ┌──────▼──────┐     ┌───────▼───────┐   ┌──────▼──────┐
    │   PWA   │     │  iOS App    │     │  Android App  │   │  Wallboard  │
    │ (React) │     │ (Capacitor) │     │  (Capacitor)  │   │ (LG webOS)  │
    └────┬────┘     └──────┬──────┘     └───────┬───────┘   └──────┬──────┘
         │                 │                    │                   │
         └─────────────────┴────────────────────┴───────────────────┘
                                    │
                         ┌──────────▼──────────┐
                         │   Cloudflare Pages   │
                         │  (Static Hosting +   │
                         │   Edge Caching)      │
                         └──────────┬──────────┘
                                    │
              ┌─────────────────────▼─────────────────────────┐
              │              SUPABASE PLATFORM                 │
              │                                                │
              │  ┌──────────────┐  ┌─────────────────────┐    │
              │  │   Auth       │  │  Realtime            │    │
              │  │   (PKCE)     │  │  (WebSocket)         │    │
              │  └──────┬───────┘  └──────────┬──────────┘    │
              │         │                     │                │
              │  ┌──────▼─────────────────────▼──────────┐    │
              │  │         PostgreSQL Database            │    │
              │  │         (145 tables, 36 enums)         │    │
              │  │         + Row-Level Security           │    │
              │  └───────────────────┬───────────────────┘    │
              │                      │                         │
              │  ┌───────────────────▼───────────────────┐    │
              │  │      Edge Functions (61 functions)     │    │
              │  │      (Deno runtime)                    │    │
              │  └──┬──────┬──────┬──────┬──────┬───────┘    │
              │     │      │      │      │      │             │
              │  ┌──▼──┐┌──▼──┐┌──▼──┐┌──▼──┐┌──▼──┐        │
              │  │Email││Push ││Flex ││Maps ││WAHA │        │
              │  │     ││     ││ ERP ││     ││(WA) │        │
              │  └──┬──┘└──┬──┘└──┬──┘└──┬──┘└──┬──┘        │
              │     │      │      │      │      │             │
              └─────┼──────┼──────┼──────┼──────┼─────────────┘
                    │      │      │      │      │
         ┌──────────▼──┐   │  ┌───▼──────▼──┐   │
         │   Brevo     │   │  │  Google     │   │
         │ (Sendinblue)│   │  │  Maps API   │   │
         └─────────────┘   │  └─────────────┘   │
                    ┌──────▼──────┐    ┌────────▼────────┐
                    │  Web Push   │    │  WAHA (WhatsApp  │
                    │  (VAPID)    │    │  HTTP API)       │
                    └─────────────┘    └─────────────────┘
                                            │
         ┌──────────────────────────────────▼──────────┐
         │         Flex Rental Solutions ERP            │
         │  sectorpro.flexrentalsolutions.com/f5/api   │
         └─────────────────────────────────────────────┘

         ┌──────────────────────────────────────────────┐
         │         PERIPHERAL SYSTEMS                    │
         │                                               │
         │  ┌─────────────────┐  ┌────────────────────┐ │
         │  │  Stream Deck    │  │  Open-Meteo         │ │
         │  │  (WebSocket     │  │  (Weather API,      │ │
         │  │  localhost:3001)│  │  no auth required)  │ │
         │  └─────────────────┘  └────────────────────┘ │
         │                                               │
         │  ┌─────────────────┐  ┌────────────────────┐ │
         │  │  Mapbox GL      │  │  OpenStreetMap      │ │
         │  │  (Maps SDK)     │  │  Nominatim          │ │
         │  │                 │  │  (Geocoding)        │ │
         │  └─────────────────┘  └────────────────────┘ │
         └──────────────────────────────────────────────┘
```

### Data Flow Summary

| Flow | Path |
|------|------|
| **User Auth** | Client → Supabase Auth (PKCE) → JWT token → RLS-protected queries |
| **Data CRUD** | Client → Supabase JS SDK → PostgreSQL (with RLS) |
| **Realtime** | Client ↔ Supabase Realtime (WebSocket, 1 event/sec throttle) |
| **Email** | Client → Edge Function → Brevo API → Recipient inbox |
| **Push** | Client → Edge Function → Web Push (VAPID) → Service Worker |
| **WhatsApp** | Client → Edge Function → WAHA API → WhatsApp |
| **Flex ERP** | Client → Edge Function → Flex REST API → Response |
| **PDF Export** | Client-side generation (jsPDF/pdf-lib) → Browser download |
| **Weather** | Client → Open-Meteo API (no auth, cached 30 min) |

---

## 3. Core Components

### 3.1 Frontend — React SPA (PWA)

| Attribute | Detail |
|-----------|--------|
| **Framework** | React 18.3 with TypeScript 5.5 |
| **Build Tool** | Vite 6.3 with SWC plugin (fast compilation) |
| **Styling** | Tailwind CSS 3.4 + shadcn/ui (Radix UI primitives) |
| **State** | TanStack React Query 5 (server state) + Zustand 5 (UI state) |
| **Forms** | react-hook-form 7 + Zod validation |
| **Routing** | react-router-dom 6 with lazy-loaded pages |
| **Charts** | Recharts 2.12 |
| **Rich Text** | Quill 2.0 (via react-quill) |
| **Maps** | Mapbox GL 3.15 |
| **PDF** | jsPDF 4.0 + pdf-lib 1.17 (client-side generation) |
| **Spreadsheets** | ExcelJS 4.4 |
| **Animations** | Framer Motion 12.22 |
| **Deployment** | Cloudflare Pages (static hosting) |

**Code Splitting Strategy** (vite.config.ts manual chunks):

| Chunk | Libraries | Rationale |
|-------|-----------|-----------|
| `pdf-libs` | jsPDF, pdf-lib | 300KB+ only needed for PDF export flows |
| `maps-lib` | mapbox-gl | Large map SDK, lazy-loaded |
| `spreadsheet-libs` | ExcelJS | Only needed for Excel export |
| `editor-lib` | Quill | Rich text editor, lazy-loaded |

### 3.2 Backend — Supabase Edge Functions (Deno)

61 serverless functions organized by domain:

| Category | Count | Functions |
|----------|-------|-----------|
| **Email** | 11 | `send-corporate-email`, `send-onboarding-email`, `send-password-reset`, `send-job-payout-email`, `send-staffing-email`, `send-timesheet-reminder`, `send-expense-notification`, `send-payout-override-notification`, `send-vacation-decision`, `send-bug-resolution-email`, `send-warehouse-message` |
| **Flex Integration** | 8 | `create-flex-folders`, `fetch-flex-image`, `fetch-flex-contact-info`, `fetch-flex-inventory-model`, `manage-flex-crew-assignments`, `persist-flex-elements`, `apply-flex-status`, `sync-flex-crew-for-job` |
| **User Management** | 4 | `create-user`, `delete-user`, `import-users`, `delete-public-artist-rider` |
| **PDF/Reports** | 4 | `generate-memoria-tecnica`, `generate-lights-memoria-tecnica`, `generate-video-memoria-tecnica`, `generate-sv-report` |
| **Staffing** | 3 | `staffing-orchestrator`, `staffing-sweeper`, `staffing-click` |
| **Maps/Location** | 3 | `get-mapbox-token`, `get-google-maps-key`, `static-map` |
| **WhatsApp** | 2 | `create-whatsapp-group`, `send-job-whatsapp-message` |
| **Push Notifications** | 1 | `push` (handles subscribe, unsubscribe, broadcast, test, check_scheduled) |
| **Wallboard** | 3 | `wallboard-auth`, `wallboard-feed`, `wallboard-debug` |
| **Other** | 22+ | `system-health`, `submit-bug-report`, `submit-feature-request`, `tech-calendar-ics`, `evaluate-achievements`, `image-proxy`, `recalc-timesheet-amount`, etc. |

### 3.3 Mobile Apps — Capacitor 8

| Platform | Project Path | Status |
|----------|-------------|--------|
| **iOS** | `ios/App/` | Xcode project with Capacitor Swift Package |
| **Android** | `android/app/` | Gradle project |
| **Web** | `dist/` → both platforms | Shared web assets via `cap:sync` |

**Capacitor Plugins**: Push Notifications (`@capacitor/push-notifications`), native platform bridges.

### 3.4 Digital Signage — Wallboard

| Attribute | Detail |
|-----------|--------|
| **Platform** | LG webOS |
| **Package** | `SectorProWallboard/` (.ipk installable) |
| **Access** | Token-based public URLs (no login required) |
| **Features** | Real-time crew schedules, announcements, auto-refresh |
| **Backend** | `wallboard-auth`, `wallboard-feed` Edge Functions |

### 3.5 Stream Deck Integration

| Attribute | Detail |
|-----------|--------|
| **Plugin** | `streamdeck-plugin/com.jvhtec.areatecnica.sdPlugin/` |
| **Protocol** | WebSocket (localhost:3001) |
| **Features** | Job card selection, matrix cell selection, keyboard shortcuts, navigation |
| **State Sync** | Zustand stores ↔ Stream Deck via WebSocket messages |

---

## 4. Data Stores

### 4.1 PostgreSQL (Supabase-managed)

| Attribute | Detail |
|-----------|--------|
| **Type** | PostgreSQL (Supabase-hosted) |
| **Tables** | ~145 tables across `public` and `dreamlit` schemas (as-of 2026-03-18) |
| **Enums** | ~36 custom enum types (as-of 2026-03-18) |
| **Migrations** | ~98 migration files (as-of 2026-03-18) |
| **RLS** | Enabled on all tables with role-based policies |
| **Functions** | `compute_timesheet_hours()`, `check_technician_conflicts()`, and others |

#### Key Table Groups

**Core Entities**:

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `profiles` | User profiles | role, department, autonomo, skill_level, waha_endpoint |
| `jobs` | Individual gigs/shows | job_type, status, location, start_time, end_time |
| `tours` | Tour/festival containers | Groups multiple jobs |
| `job_assignments` | Tech → Job mapping | status (invited/confirmed/declined), department, sound_role |
| `tour_assignments` | Tech → Tour mapping | Cascades to job_assignments + timesheets |
| `timesheets` | Time tracking & payroll | hours, amount, category (tecnico/especialista/responsable), is_active |

**Rate & Payroll**:

| Table | Purpose |
|-------|---------|
| `rate_cards_2025` | Base rates by technician category |
| `rate_cards_tour_2025` | Tour-specific base rates |
| `rate_extras_2025` | Extra payment definitions (travel, day-off) |
| `custom_tech_rates` | Per-technician rate overrides (category-aware) |
| `job_rate_extras` | Applied extras per job/technician |
| `tour_week_multipliers_2025` | Tour week-based rate multipliers |

**Festival Management**:

| Table | Purpose |
|-------|---------|
| `festival_artists` | Artist/band info per festival |
| `festival_artist_form_submissions` | Technical riders submitted via public artist form |
| `festival_shifts` | Crew shift assignments |
| `festival_gear_setups` | Equipment setup per stage/artist |
| `festival_dates` | Festival schedule/agenda |
| `soundvision_files` | Venue acoustic documentation |

**Equipment & Inventory**:

| Table | Purpose |
|-------|---------|
| `equipment_models` | Unified equipment catalog |
| `presets` / `preset_items` | Equipment package templates |
| `global_stock_entries` | Global inventory tracking |
| `stock_movements` | Equipment allocation (addition/subtraction) |
| `sub_rentals` | Subrental request workflow |

**Logistics & Operations**:

| Table | Purpose |
|-------|---------|
| `hoja_de_ruta` | Tour book (accommodations, transport, equipment, staff, logistics) |
| `hoja_de_ruta_*` | 14 related tables for tour book sections |
| `logistics_events` | Load-in/load-out tracking |
| `transport_requests` | Vehicle requests and items |

**Flex Integration**:

| Table | Purpose |
|-------|---------|
| `flex_folders` | Folder hierarchy mapping (Tour → Date → Department → Dryhire) |
| `flex_work_orders` | Work orders synced from Flex |
| `flex_crew_calls` / `flex_crew_assignments` | Crew call data |
| `flex_status_log` | Sync audit trail |

**Communication**:

| Table | Purpose |
|-------|---------|
| `messages` / `direct_messages` | Internal messaging |
| `announcements` | Company-wide announcements |
| `notifications` | In-app notification queue |
| `push_subscriptions` | Web Push subscriptions |
| `push_notification_schedules` | Scheduled notifications |
| `job_whatsapp_groups` | WhatsApp group tracking |

**Audit & Activity**:

| Table | Purpose |
|-------|---------|
| `activity_log` | User action tracking |
| `assignment_audit_log` | Assignment change history |
| `corporate_email_logs` | Email audit trail |
| `security_audit_log` | Persistent security-sensitive access log |
| `dreamlit.event_log` | Workflow event logging |
| `dreamlit.error_log` | System error tracking |

### 4.2 Supabase Storage

| Bucket | Purpose |
|--------|---------|
| Job documents | Technical riders, contracts, SoundVision files |
| Festival artist files | Artist riders, promotional material |
| Public artist form uploads | Submitted rider files |
| Company logos | Corporate branding for PDFs |
| Stage plots | Stage diagram images |

### 4.3 Client-Side Storage

| Store | Technology | Purpose |
|-------|-----------|---------|
| Auth tokens | localStorage | Session persistence (30-min cache TTL) |
| Profile cache | localStorage | Cached user profile (30-min expiry) |
| Shortcut registry | localStorage (Zustand persist) | Keyboard shortcut configuration |
| Service Worker cache | Cache API | Offline asset caching |
| Push subscriptions | IndexedDB (via browser) | Push notification state |

---

## 5. External Integrations

### 5.1 Flex Rental Solutions (ERP)

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Equipment management, work orders, crew calls |
| **Base URL** | `https://sectorpro.flexrentalsolutions.com/f5/api` |
| **Integration** | REST API via Edge Functions (`secure-flex-api` proxy) |
| **Folder Hierarchy** | Tour → Date → Department → Dryhire |
| **Sync** | Bi-directional (crew assignments, work orders, status) |
| **Deep Linking** | `src/lib/flex/urlBuilder.ts` — links to Flex UI elements |

### 5.2 Brevo (Sendinblue) — Email

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Transactional & notification emails |
| **Integration** | REST API via Edge Functions |
| **Auth** | API key (`BREVO_API_KEY`) |
| **Features** | Branded templates, inline images, PDF attachments |
| **Limits** | Images 5MB, PDFs 10MB, total 20MB per email |
| **Image Retention** | 7 days (configurable) |

### 5.3 WAHA — WhatsApp HTTP API

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Automated WhatsApp group creation for job crews |
| **Base URL** | `https://waha.sector-pro.work` (configurable per user) |
| **Auth** | API key (`WAHA_API_KEY`) + session (`WAHA_SESSION`) |
| **Features** | Group creation, phone normalization (+34 Spain), admin toggling, festival logo setting |
| **Access** | Admin/management roles only |

### 5.4 Google Maps

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Static maps, place photos, restaurant search for tour books |
| **Integration** | API key delivered via role-gated Edge Function |
| **Auth** | `GOOGLE_MAPS_API_KEY` + role verification |
| **Edge Functions** | `get-google-maps-key`, `static-map`, `place-photos`, `place-restaurants` |

### 5.5 Mapbox GL

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Interactive map components in the frontend |
| **Integration** | Client-side SDK (`mapbox-gl` npm package) |
| **Auth** | Public token delivered via `get-mapbox-token` Edge Function |

### 5.6 Open-Meteo — Weather

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Weather forecasts for tour/event dates |
| **Integration** | Direct REST API calls (no auth required) |
| **Geocoding** | OpenStreetMap Nominatim (no auth required) |
| **Caching** | 30-minute in-memory cache |
| **Location** | `src/utils/weather/weatherApi.ts` |

### 5.7 Web Push (VAPID)

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Browser push notifications |
| **Protocol** | Web Push API with VAPID authentication |
| **Auth** | `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` |
| **Service Worker** | `public/sw.js` (version injected at build time) |
| **Native** | Capacitor Push Notifications plugin for iOS/Android |

---

## 6. Deployment & Infrastructure

### 6.1 Cloud Provider — Cloudflare Pages

| Attribute | Detail |
|-----------|--------|
| **Hosting** | Cloudflare Pages (static site hosting with edge CDN) |
| **Production URL** | `sector-pro.work` (main branch) |
| **Preview** | Automatic preview deployments (dev branch, PRs) |
| **Build Command** | `npm install --legacy-peer-deps && npm run build` |
| **Output Directory** | `dist/` |
| **Headers/Redirects** | `public/_headers`, `public/_redirects` |

### 6.2 Backend — Supabase (Managed)

| Service | Purpose |
|---------|---------|
| **Auth** | PKCE-based authentication, JWT tokens |
| **Database** | Managed PostgreSQL with RLS |
| **Realtime** | WebSocket subscriptions (1 event/sec, 30s timeout, 15s heartbeat) |
| **Edge Functions** | 61 Deno serverless functions |
| **Storage** | File storage with access policies |

### 6.3 CI/CD Pipeline

```text
┌──────────────┐     ┌──────────────────────────────────────┐
│  Developer   │     │        GitHub Actions                 │
│  pushes to   │────▶│                                      │
│  dev/main    │     │  ┌──────┐ ┌──────────┐ ┌──────────┐ │
│              │     │  │ Lint │ │ Test     │ │ Test     │ │
│              │     │  │(ESLint)│ │(Critical)│ │ (Full)  │ │
│              │     │  └──────┘ └──────────┘ └──────────┘ │
│              │     │  ┌──────┐ ┌──────────┐              │
│              │     │  │Build │ │ E2E      │              │
│              │     │  │(Vite)│ │(Playwright│              │
│              │     │  └──┬───┘ │ Chromium)│              │
│              │     │     │     └──────────┘              │
│              │     └─────┼──────────────────────────────┘
│              │           │
│              │     ┌─────▼─────────────┐
│              │     │ Cloudflare Pages  │
│              │     │ Auto-deploy on    │
│              │     │ merge to main     │
│              │     └───────────────────┘
└──────────────┘
```

**CI Jobs** (all parallel, Ubuntu + Node 20):

| Job | Timeout | Command |
|-----|---------|---------|
| Lint | 20 min | `npm run lint` |
| Test Critical | 25 min | `npm run test:critical` |
| Test Full | 25 min | `npm run test:run` |
| Build | 25 min | `npm run build` |
| E2E Smoke | 30 min | `npm run test:e2e` (Playwright + Chromium) |

### 6.4 Environment Variables

**Cloudflare Pages** (build-time):
```dotenv
VITE_SUPABASE_URL          # Supabase project URL
VITE_SUPABASE_ANON_KEY     # Supabase anonymous key
VITE_APP_VERSION           # Auto-set to build timestamp
VITE_BUILD_TIMESTAMP       # Auto-set to Unix timestamp
```

**Supabase Secrets** (Edge Function runtime):
```dotenv
BREVO_API_KEY              # Email service
BREVO_FROM                 # Email sender address
MAPBOX_PUBLIC_TOKEN        # Mapbox maps
GOOGLE_MAPS_API_KEY        # Google Maps
WAHA_API_KEY               # WhatsApp API
WAHA_SESSION               # WhatsApp session
VAPID_PUBLIC_KEY           # Web Push public key
VAPID_PRIVATE_KEY          # Web Push private key
WA_DEFAULT_COUNTRY_CODE    # Default country code (+34)
```

### 6.5 Monitoring

| Tool | Purpose |
|------|---------|
| `system-health` Edge Function | System health check endpoint |
| `dreamlit.event_log` table | Workflow event logging |
| `dreamlit.error_log` table | System error tracking |
| `activity_log` table | User action auditing |
| `security_audit_log` table | Persistent security access auditing |
| `push_cron_execution_log` | Cron job execution history |
| Supabase Dashboard | Database metrics, function logs |
| Cloudflare Analytics | CDN performance, request metrics |

---

## 7. Security Considerations

### 7.1 Authentication

| Attribute | Detail |
|-----------|--------|
| **Provider** | Supabase Auth |
| **Flow** | OAuth 2.0 PKCE (Proof Key for Code Exchange) |
| **Token Type** | JWT (access + refresh tokens) |
| **Storage** | localStorage with key `supabase.auth.token` |
| **Token Cache** | 30-minute TTL via `TokenManager` |
| **Auto-Refresh** | Every 4 minutes; on tab focus if < 10 min to expiry |
| **Idle Recovery** | Refresh after 15 minutes idle |
| **Implementation** | `OptimizedAuthProvider` in `src/hooks/useOptimizedAuth.tsx` |

### 7.2 Authorization Model

| Layer | Mechanism |
|-------|-----------|
| **Database** | Row-Level Security (RLS) policies on all 145 tables |
| **Edge Functions** | JWT extraction + profile role check |
| **Frontend** | `ProtectedRoute` component with role guards |
| **Navigation** | `getDashboardPath()` role-based routing |
| **Inline Checks** | `userRole` / `userDepartment` from auth context |

**User Roles** (`user_role` enum):

| Role | Access Level |
|------|-------------|
| `admin` | Full platform access |
| `management` | Department-level management |
| `house_tech` | In-house technician (extended access) |
| `technician` | Freelance technician |
| `logistics` | Logistics-specific access |
| `wallboard` | Digital signage display only |
| `user` | Basic user access |

### 7.3 Data Protection

| Aspect | Implementation |
|--------|---------------|
| **Transport** | HTTPS everywhere (Cloudflare edge + Supabase) |
| **At-Rest** | Supabase-managed PostgreSQL encryption |
| **Input Sanitization** | DOMPurify 3.3 for HTML/rich text |
| **Secret Detection** | `scripts/check-staged-secrets.sh` (pre-commit) |
| **File Upload Limits** | Images 5MB, PDFs 10MB, total 20MB |
| **CORS** | Configured on all Edge Functions |

### 7.4 Known Vulnerability Status

| Package | Issue | Severity | Status |
|---------|-------|----------|--------|
| jsPDF | Path traversal (GHSA-f8cm-6447-x5h2) | High | **Fixed** — Upgraded to 4.0.0 |
| xlsx (SheetJS) | Prototype pollution (CVE-2023-30533) | High | **Fixed** — Replaced with ExcelJS 4.4 |
| react-quill/quill | XSS (GHSA-4943-vgg-gr5r) | Moderate | **Accepted** — App uses quill 2.x directly |
| esbuild | Dev server vuln (GHSA-67mh-4wv8-2f99) | Moderate | **Dev-only** — Needs vitest 4.x upgrade |

### 7.5 Security Roadmap

- [ ] Rotate VAPID keys and Supabase anon key (exposed in git history)
- [ ] Implement pre-commit hooks (`git-secrets`, `detect-secrets`)
- [ ] Add automated security scanning to CI (`npm audit`, Snyk)
- [x] Persist security audit logging via `public.security_audit_log` and the `security-audit` Edge Function
- [ ] Plan vitest 4.x upgrade to resolve esbuild vulnerability

---

## 8. Development & Testing

### 8.1 Local Setup

```bash
# Clone repository
git clone https://github.com/jvhtec/area-tecnica.git
cd area-tecnica

# Install dependencies (ALWAYS use --legacy-peer-deps)
npm install --legacy-peer-deps

# Set environment variables
cp .env.example .env
# Edit .env with Supabase credentials

# Start development server (localhost:8080)
npm run dev
```

**Critical**: Always use `--legacy-peer-deps` due to peer dependency conflicts (Vite 6, date-fns 3, Vitest). Never add `package-lock.json` to the repo.

### 8.2 Testing Frameworks

| Framework | Purpose | Config |
|-----------|---------|--------|
| **Vitest 2.1** | Unit & component tests | `vitest.config.ts` |
| **Testing Library** | React component testing | `@testing-library/react` + `jest-dom` |
| **Playwright 1.58** | End-to-end tests | `playwright.config.ts` (Chromium) |
| **jsdom 27** | DOM simulation | Configured via Vitest `environmentMatchGlobs` |

### 8.3 Test Commands

```bash
# Run all tests
npm test

# Run specific test file
npm test -- src/components/expenses/__tests__/ExpenseForm.test.tsx

# Run critical tests only
npm run test:critical

# Run full test suite (no watch)
npm run test:run

# Run E2E tests
npm run test:e2e
```

### 8.4 Code Quality Tools

| Tool | Purpose | Config |
|------|---------|--------|
| **ESLint 9** | Code linting | `eslint.config.js` |
| **TypeScript 5.5** | Type checking (partial strict mode) | `tsconfig.json` |
| **Prettier** (implicit) | Code formatting | Via editor integration |
| **DOMPurify** | HTML sanitization | Runtime security |

**TypeScript Configuration** (intentionally relaxed):
- `noImplicitAny: false` — Large codebase in active development
- `strictNullChecks: false` — Gradual migration
- `skipLibCheck: true` — Faster builds
- Path alias: `@/*` → `./src/*`

### 8.5 Development Workflow

```text
Feature Branch → PR to dev → CI passes → Merge to dev → Preview deploy
                                                              │
                                    PR to main → CI passes → Merge to main → Production
```

**Commit Convention**: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`

**Parallel Development**: Git worktrees via `scripts/worktree.sh` for 3-5 concurrent Claude Code sessions.

---

## 9. Future Considerations

### 9.1 Known Technical Debt

Based on the [Tech Debt Audit (2026-02-01)](/.claude/notes/2026-02-01-tech-debt-audit.md):

| Category | Severity | Count | Example |
|----------|----------|-------|---------|
| Fire-and-forget DB operations | Critical | 4 | Silent delete failures in stock/logistics |
| Direct Supabase calls bypassing hooks | High | 60 files | Should use custom hooks for consistency |
| Unsafe date handling (no timezone) | High | 68 files | `new Date()` without `Europe/Madrid` |
| Duplicate job query hooks | Resolved (2026-03-20) | 0 active hooks | Consolidated into `useJobsData` with normalized query keys and realtime support |
| `as any` type casts | Medium | 463 | Scattered across components and utilities |
| Files exceeding 300 lines | Medium | 208 | Top file: 1,401 lines (`flex-folders/folders.ts`) |
| Inconsistent toast patterns | Medium | 2 systems | `useToast` (73 files) vs. `sonner` (37 files) |
| Duplicate utility functions | Medium | 4 | `hexToRgb()` implemented 4 times |
| Code duplication across features | High | ~1,100 lines | Rate approval hooks, PDF setup, permission checks |

### 9.2 Planned Improvements

**Immediate Priority**:
- Error handling for fire-and-forget Supabase operations
- Validate truss model placeholder values in rigging calculations

**Sprint Targets**:
1. Centralized `usePermissions()` hook (replace 114 inline role checks)
2. `createMutationWithToast()` helper (reduce 623 toast boilerplate instances)
3. ✅ Consolidate job query hooks into single canonical hook (`useJobsData`)
4. Standardize on one toast library (sonner recommended)

**Architectural**:
- Migrate 60 components from direct Supabase calls to custom hooks
- Fix 68 files with unsafe date handling → timezone-aware utilities
- Split god files (festival management VM: 1,280 lines, 40+ state variables)
- Reduce `as any` casts through gradual strict TypeScript adoption

### 9.3 Potential Future Features

- Vitest 4.x upgrade (resolves esbuild dev server vulnerability)
- Automated secret rotation pipeline
- Enhanced offline support via Service Worker improvements
- Expanded Flex Rental Solutions bi-directional sync
- Native app feature parity with PWA

---

## 10. Glossary

### Domain Terms (Spanish → English)

| Term | Translation | Context |
|------|-------------|---------|
| **Área Técnica** | Technical Area | The platform itself — technical operations hub |
| **Hoja de Ruta** | Route Sheet / Tour Book | Comprehensive tour documentation |
| **Memoria Técnica** | Technical Memo | Department-specific technical documentation |
| **Responsable** | Lead / Responsible | Senior technician category |
| **Especialista** | Specialist | Mid-level technician category |
| **Técnico** | Technician | Junior technician category |
| **Autónomo** | Self-employed / Freelancer | Contract status for freelance technicians |
| **Tentativa** | Tentative | Unconfirmed job status |
| **Confirmado** | Confirmed | Locked job status |
| **Completado** | Completed | Finished job status |
| **Cancelado** | Cancelled | Voided job status |
| **Evento** | Event | Corporate/private event (fixed 12-hour rate) |
| **Dryhire** | Dry Hire | Equipment-only rental (no crew) |
| **Tourdate** | Tour Date | Individual date within a tour |
| **Ensayo** | Rehearsal | Practice session |
| **Viaje** | Travel | Travel day |
| **Disponibilidad** | Availability | Technician availability calendar |
| **Logística** | Logistics | Warehouse and transport operations |
| **Producción** | Production | Production department |
| **Rider** | Technical Rider | Artist equipment requirements list |
| **Consumos** | Consumption / Power Draw | Electrical power consumption calculator |
| **Pesos** | Weights | Load/weight calculator for rigging |

### Technical Acronyms

| Acronym | Meaning |
|---------|---------|
| **PWA** | Progressive Web App |
| **RLS** | Row-Level Security (Supabase/PostgreSQL) |
| **PKCE** | Proof Key for Code Exchange (OAuth 2.0 flow) |
| **VAPID** | Voluntary Application Server Identification (Web Push) |
| **WAHA** | WhatsApp HTTP API |
| **SPA** | Single Page Application |
| **SSR** | Server-Side Rendering |
| **OT** | Overtime |
| **FOH** | Front of House (audio mixing position) |
| **MON** | Monitors (stage monitor mixing) |
| **PA** | Public Address (speaker system) |
| **IEM** | In-Ear Monitors |
| **SV** | SoundVision (L-Acoustics acoustic prediction software) |
| **Flex** | Flex Rental Solutions (ERP system) |

---

## 11. Project Identification

| Attribute | Detail |
|-----------|--------|
| **Project Name** | Area Tecnica (Sector Pro) |
| **Repository** | github.com/jvhtec/area-tecnica |
| **Production URL** | sector-pro.work |
| **Primary Contact** | Sector Pro Engineering Team |
| **Stack** | React 18 + TypeScript, Vite 6, Supabase, Tailwind CSS + shadcn/ui |
| **License** | Private |
| **Last Updated** | 2026-03-18 |
| **Database Tables** | ~145 (as-of 2026-03-18) |
| **Edge Functions** | ~61 (as-of 2026-03-18) |
| **Custom Hooks** | 100+ (as-of 2026-03-18) |
| **Page Components** | ~42 (as-of 2026-03-18) |
| **Dependencies** | ~139 npm packages (as-of 2026-03-18) |
| **Migrations** | ~98 SQL files (as-of 2026-03-18) |
| **Documentation** | 60+ markdown files (as-of 2026-03-18) |
