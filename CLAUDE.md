# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Area Tecnica (Sector Pro)** is a comprehensive technical operations platform for live events, festivals, tours, and production workflows. It consolidates operations traditionally spread across emails, spreadsheets, messaging apps, and standalone software into a single mobile-first Progressive Web App.

**Stack**: React 18 + TypeScript, Vite 6, Supabase (Auth, DB, Storage, Edge Functions), Tailwind CSS + shadcn/ui, TanStack React Query, Zustand

**Deployment**: Cloudflare Pages
- Main branch → sector-pro.work (production)
- Dev branch → preview deployments

## Development Commands

### Essential Commands
```bash
# Install dependencies (ALWAYS use --legacy-peer-deps)
npm install --legacy-peer-deps

# Development server (runs on localhost:8080)
npm run dev

# Build for production
npm run build

# Build for development mode
npm run build:dev

# Run tests
npm test

# Lint code
npm run lint

# Preview production build
npm preview
```

### Mobile Development (Capacitor)
```bash
# Sync web assets and native dependencies
npm run cap:sync

# Open iOS project in Xcode
npm run cap:ios

# Open Android project in Android Studio
npm run cap:android
```

**Note**: After making changes to web code, always run `cap:sync` before opening native projects.

### Staging & Testing Commands
```bash
# Staging environment (separate Supabase project)
npm run dev:staging       # Dev server against staging
npm run build:staging     # Build for staging

# Testing
npm run test:run          # Single run (CI-friendly)
npm run test:critical     # 30 critical workflow tests
npm run test:coverage     # Coverage report
npm run test:e2e          # Playwright smoke tests (Chromium)

# Linting
npm run lint:functions    # ESLint on Supabase edge functions (Deno globals)
```

### Pre-Commit Security
```bash
# Check staged files for secrets before committing
./scripts/check-staged-secrets.sh
```
Detects API keys, passwords, and credentials in staged files. Consider setting up as a git pre-commit hook.

## Critical Build Requirements

### npm Install
**ALWAYS use**: `npm install --legacy-peer-deps`
- Required due to peer dependency conflicts (vite 6, date-fns 3, vitest)
- No package-lock.json in repo (intentional - prevents Cloudflare npm ci issues)

### Dependency Constraints
- **date-fns**: Must stay at ^3.6.0 (react-day-picker compatibility)
- **vite**: ^6.3.3 (vitest has peer conflicts - ignore warnings)
- Never upgrade these without extensive testing

### Cloudflare Build Command
```bash
npm install --legacy-peer-deps && npm run build
```
Output directory: `dist/`

**Do not** change build command or add package-lock.json to repo.

### Common Build Failures
- "ERESOLVE unable to resolve" → forgot --legacy-peer-deps
- "MIME type text/html" → clear Cloudflare cache, retry deploy
- "Cannot find lovable-tagger" → check vite.config.ts imports (should not import lovable-tagger)

### Local Dependency Reset
If dependencies get corrupted:
```bash
sudo rm -rf node_modules
npm install --legacy-peer-deps
```

## Architecture

### High-Level Structure

The application follows a feature-based architecture with clear separation of concerns:

```
src/
├── components/          # Feature-specific UI components organized by domain
│   ├── festival/        # Festival management (artists, riders, gear setup)
│   ├── tours/           # Tour management (dates, crew, itineraries)
│   ├── jobs/            # Job/gig management and assignment
│   ├── matrix/          # Crew assignment matrix
│   ├── timesheet/       # Timesheet and payroll tracking
│   ├── equipment/       # Equipment/inventory management
│   ├── logistics/       # Load-in/load-out, warehouse operations
│   ├── messages/        # Internal messaging system
│   ├── ui/              # shadcn/ui components
│   └── ...
├── pages/              # Route components (lazy-loaded)
├── features/           # Feature modules with co-located logic
│   ├── activity/       # Activity feed and notifications
│   ├── staffing/       # Staffing and crew management
│   ├── timesheets/     # Timesheet calculation logic
│   └── rates/          # Rate management and approvals
├── hooks/              # Custom React hooks (100+ hooks)
├── stores/             # Zustand global state stores
├── integrations/       # External service integrations
│   └── supabase/       # Supabase client, types (8999 lines of DB types)
├── lib/                # Core libraries and utilities
├── utils/              # Utility functions
│   ├── pdf/            # PDF generation utilities
│   ├── flex-folders/   # Flex Rental Solutions integration
│   └── weather/        # Weather API integration
├── types/              # TypeScript type definitions
├── contexts/           # React contexts
└── providers/          # React providers
```

### Key Architectural Patterns

#### 1. Authentication & Authorization
- **Provider**: `OptimizedAuthProvider` in `src/hooks/useOptimizedAuth.tsx`
- **Session Management**: Token caching with 30-minute TTL
- **Role-based Access**: Roles stored in profiles table, accessed via `userRole` and `userDepartment`
- **Protected Routes**: Use `ProtectedRoute` component with role guards
- **Route-based Role Routing**: `getDashboardPath()` from `src/utils/roleBasedRouting.ts`

#### 2. Data Fetching & State Management
- **Primary**: TanStack React Query with optimized configuration
- **Query Client**: `src/lib/react-query.ts` - centralized queryClient instance
- **Optimized Patterns**:
  - Query key factories in `src/lib/optimized-react-query.ts`
  - Standardized invalidation via `optimizedInvalidation()`
  - Entity-based query options via `createEntityQueryOptions()`
- **Global State**: Zustand stores in `src/stores/`:
  - `useCreateJobDialogStore` — Job creation dialog visibility and context
  - `useSelectedJobStore` — Currently selected job card (also used by Stream Deck)
  - `useSelectedCellStore` — Matrix cell selection (supports multi-select for batch ops)
  - `useShortcutStore` — Global keyboard/Stream Deck shortcut registry with persistence
- **Realtime**: Supabase realtime subscriptions with connection pooling and health monitoring

#### Key Libraries (`src/lib/`)
- `token-manager.ts` — JWT token lifecycle, refresh logic, session recovery
- `unified-subscription-manager.ts` — Centralized realtime subscription management (see Multi-Tab section)
- `multitab-coordinator.ts` — Leader election and cross-tab cache sync
- `enhanced-security-config.ts` — Rate limiting, input sanitization, file validation
- `push.ts` / `push-native.ts` — Web Push and native iOS push notification support
- `wallboard-api.ts` — Tokenized public wallboard data API
- `frequencyBands.ts` — RF/wireless frequency reference data
- `streamdeck/websocket-server.ts` — Stream Deck WebSocket integration

#### 3. Supabase Integration
- **Client**: Unified client at `src/lib/supabase-client.ts`
- **Types**: Auto-generated database types in `src/integrations/supabase/types.ts` (8999 lines)
- **Auth Config**: PKCE flow, auto-refresh, localStorage persistence
- **Realtime Config**: 1 event/sec rate limit, 30s timeout, 15s heartbeat
- **Connection Management**:
  - `checkNetworkConnection()` - uses navigator.onLine
  - `ensureRealtimeConnection()` - force reconnect
  - `monitorConnectionHealth()` - connection health checks

#### 4. Routing & Lazy Loading
- All page components are lazy-loaded via `React.lazy()`
- Routes defined in `src/App.tsx` with `Suspense` boundaries
- Nested routes use `AuthenticatedShell` wrapper for authenticated pages
- Loading states use `PageLoader` component

#### 5. PDF Generation
- Custom PDF engine in `src/utils/pdf/` using jspdf and pdf-lib
- Domain-specific exports:
  - Festival schedules, artist riders, gear lists
  - Tour itineraries, day sheets, tour books
  - Timesheets, incident reports, logistic reports
  - Technical documents (Memoria Técnica)
- Corporate branding support via company logo integration

#### 6. Feature Modules
Each major feature (festivals, tours, jobs, equipment) follows a consistent pattern:
- **Components**: UI components in `src/components/{feature}/`
- **Hooks**: Custom hooks in `src/hooks/use{Feature}.ts`
- **Utils**: Utility functions in `src/utils/{feature}.ts` or feature-specific directories
- **Types**: TypeScript definitions co-located or in `src/types/`

### Database Schema Overview (Supabase)

The database is extensive with 85+ migrations. Key tables:

**Core Entities**:
- `profiles` - User profiles with roles, departments, contact info
- `jobs` - Individual gigs/shows with dates, locations, types
- `tours` - Tour/festival containers grouping multiple jobs
- `job_assignments` - Technician assignments to jobs with roles
- `tour_assignments` - Technician assignments to entire tours
- `timesheets` - Time tracking, breaks, payroll calculations

**Crew & Staffing**:
- `staffing_requests` - Crew requirements per job/department
- `technician_availability` - Availability calendar per technician
- `custom_tech_rates` - Custom rate overrides per tech/tour/job

**Equipment & Inventory**:
- `equipment_models` - Equipment catalog (unified table)
- `equipment_presets` - Equipment packages/templates
- `stock_movements` - Equipment allocation and tracking
- `subrental_requests` - External rental requests

**Festival Management**:
- `festival_artists` - Artist/band information per festival
- `artist_requirements` - Technical riders and requirements
- `festival_dates` - Festival schedule and agenda
- `festival_shifts` - Crew shift assignments

**Communication**:
- `messages` - Internal messaging system
- `announcements` - Company-wide announcements
- `notifications` - Push notification queue
- `push_subscriptions` - Web push subscription endpoints

**Logistics**:
- `load_in_load_out` - Warehouse operations tracking
- `warehouse_time_tracking` - Staff time tracking for logistics

**Integration**:
- `flex_folders` - Flex Rental Solutions folder mapping
- `flex_crew_assignments` - Flex integration for crew calls

### Important Domain Concepts

#### Job Types
- `festival` - Festival dates/shows
- `tour` - Tour dates/shows
- `dry-hire` - Equipment rental only
- `evento` - Corporate/private events

#### Job Status Flow
- `pendiente` - Pending confirmation
- `tentativa` - Tentative booking
- `confirmado` - Confirmed
- `cancelado` - Cancelled

#### Assignment Status
- `pending` - Assignment not yet accepted
- `accepted` - Technician accepted
- `declined` - Technician declined
- `cancelled` - Assignment cancelled

#### Departments — `department` enum
- `sound` - Audio/Sound
- `lights` - Lighting
- `video` - Video
- `logistics` - Logistics
- `production` - Production
- `administrative` - Administrative

#### Roles — `user_role` enum
- `admin` - Admin access
- `management` - Management access
- `house_tech` - In-house technician
- `technician` - Freelance technician
- `user` - Basic user
- `logistics` - Logistics role
- `wallboard` - Digital signage display

### Flex Rental Solutions Integration

Integration with Flex Rental Solutions ERP system for work orders, crew calls, and folder structure sync.

**Key Files**:
- `src/utils/flex-folders/` - Folder management utilities
- `src/utils/flexCrewAssignments.ts` - Crew assignment sync
- `src/utils/flex-labor-resources.ts` - Labor resource mapping
- `src/hooks/useFlexUuid.ts` - Fetch Flex folder UUIDs

**Folder Structure Pattern**:
```
Tour/Festival → Date → Department → Dryhire (optional)
```

**Critical**: Always ensure Flex folder hierarchy exists before creating work elements or crew calls.

### Mobile/PWA Patterns

#### Capacitor Setup
- iOS and Android native apps via Capacitor 8
- Config: `capacitor.config.ts`
- Native projects in `ios/` and `android/` directories
- Service worker for offline support and push notifications

#### Mobile-Specific Components
- Mobile-optimized views in components with "Mobile" prefix
- Viewport detection via `useViewport()` hook from `src/hooks/use-mobile`
- Touch-optimized UI patterns with Radix UI primitives

#### Push Notifications
- Web Push API integration
- Subscription management in `src/hooks/usePushNotifications.ts`
- Recovery detection in `src/hooks/usePushSubscriptionRecovery.ts`
- Notifications stored in `notifications` and `push_subscriptions` tables

### Multi-Tab Coordination

**Critical pattern** in `src/lib/multitab-coordinator.ts` — prevents duplicate API calls and syncs state across browser tabs:
- **Leader election**: Uses Web Locks API (fallback: localStorage) — only leader tab handles realtime subscriptions and refetches
- **Cache sync**: BroadcastChannel broadcasts query updates to follower tabs (75ms debounce)
- **Heartbeat**: 3s intervals to detect leader health; automatic failover when leader closes
- **Impact**: Don't bypass this when adding realtime features — always go through the unified subscription manager

### Unified Subscription Manager

Central realtime manager in `src/lib/unified-subscription-manager.ts` (21.9KB):
- **Priority-based** subscriptions (high/medium/low)
- **Route-aware**: Only subscribes to tables needed for the current route (`useEnhancedRouteSubscriptions`)
- **Stale detection**: 10-minute threshold for subscription refresh
- **Recovery**: Exponential backoff on failures, auto-resubscribe on network recovery, visibility-based refetch
- **Snapshot pattern**: Provides connection status, active subscription list, last refresh timestamp for UI

### Chunk Loading Error Recovery

Automatic recovery from code-split loading failures (`ErrorBoundary.tsx` + `main.tsx`):
- Detects chunk load errors from async imports
- Tracks reload attempts in sessionStorage
- Auto-reloads up to `MAX_CHUNK_ERROR_RELOADS` times with 500ms delay
- In-memory guard prevents infinite loops if sessionStorage unavailable

### Stream Deck & Keyboard Shortcuts

- **Shortcut store**: `src/stores/useShortcutStore.ts` — Zustand registry with categories (navigation, job-card, matrix, global)
- **Stream Deck**: WebSocket client in `src/lib/streamdeck/websocket-server.ts` connects to local server (`ws://localhost:3001`)
- **Commands**: execute-shortcut, navigate, get-state, ping — auto-reconnect silently if server absent
- **Custom keybinds**: Persisted to localStorage, exportable/importable

### Rate Limiting & Input Security

Client-side security config in `src/lib/enhanced-security-config.ts`:
- **Rate limits**: Flex API (60/min), document uploads (10/min), user creation (5/hour), password reset (3/hour)
- **Progressive penalties**: 30s → 5min → 30min on repeated violations
- **Input sanitization**: XSS prevention (strips `<>`, event handlers, `javascript:`, `data:` URIs), SQL injection prevention
- **File upload validation**: 50MB max, type whitelist (PDF, images, Word, plaintext), double-extension blocking

### Performance Optimizations

1. **Code Splitting**: All pages lazy-loaded, manual chunks in vite.config.ts
2. **Query Optimization**: Materialized views (`v_job_staffing_summary`), indexed foreign keys
3. **Realtime Throttling**: Connection pooling, subscription deduplication, route-aware subscriptions
4. **Multi-Tab Dedup**: Leader election prevents duplicate subscriptions across tabs
5. **Virtual Scrolling**: `useVirtualizedMatrix` and `useVirtualizedDateRange` for large datasets
6. **Optimistic Updates**: `useOptimisticJobManagement` for immediate UI feedback with rollback
7. **Image Optimization**: `src/utils/imageOptimization.ts`
8. **Bundle Optimization**: Separate chunks for pdf-libs, maps-lib, spreadsheet-libs, editor-lib
9. **Production Mode**: Console/debugger statements dropped via esbuild
10. **Token Caching**: Auth tokens cached 30 minutes via `OptimizedAuthProvider`

### Testing

- **Framework**: Vitest with jsdom for component tests
- **Config**: `vitest.config.ts`
- **Setup**: `src/test/setup.ts`
- **Pattern**: Co-locate tests in `__tests__/` directories or `.test.ts` files
- **Component Tests**: Use `@testing-library/react` and `@testing-library/jest-dom`
- **E2E Tests**: Playwright (Chromium) smoke tests via `npm run test:e2e`
- **Environment**: Node by default, jsdom for components (configured via environmentMatchGlobs)

**Test Utilities** (in `src/test/`):
- `setup.ts` — DOM matchers, toast mocking, window API polyfills (matchMedia, IntersectionObserver, ResizeObserver)
- `fixtures.ts` — Shared test fixtures
- `renderWithProviders.tsx` — Provider wrapper for component tests
- `mockOptimizedAuth.ts` — Auth context mocking
- `mockSupabase.ts` — Supabase client mocking
- `createTestQueryClient.ts` — Query client factory for isolated tests

**Test Commands**:
```bash
npm test                # Vitest watch mode (interactive development)
npm run test:run        # Vitest single run (CI-friendly)
npm run test:critical   # 30 critical workflow tests (auth, assignments, timesheets, etc.)
npm run test:coverage   # Coverage report
npm run test:e2e        # Playwright smoke tests (requires Chromium)
```

### CI/CD Pipeline (GitHub Actions)

Defined in `.github/workflows/tests.yml`, triggered on PRs to `dev`/`main` or manual dispatch:

| Job | Timeout | What it does |
|-----|---------|-------------|
| `lint` | 20 min | ESLint on app code |
| `test_critical` | 25 min | 30 critical test files (auth, assignments, timesheets) |
| `test_run` | 25 min | Full Vitest suite |
| `build` | 25 min | Vite production build + post-build scripts |
| `e2e_smoke` | 30 min | Playwright Chromium smoke tests |

All jobs use Node 20 and `npm install --legacy-peer-deps`.

### Supabase Edge Functions

62 Deno/TypeScript edge functions in `supabase/functions/`. Key categories:

**Email Services** (11+ functions): `send-corporate-email`, `send-onboarding-email`, `send-staffing-email`, `send-timesheet-reminder`, `send-bug-resolution-email`, `send-expense-notification`, `send-job-payout-email`, `send-password-reset`, `send-tour-availability`, `send-vacation-decision`, `send-warehouse-message`

**Flex Integration**: `create-flex-folders`, `apply-flex-status`, `archive-to-flex`, `sync-flex-crew-for-job`, `manage-flex-crew-assignments`, `persist-flex-elements`, `secure-flex-api`, `fetch-flex-*`

**Staffing Engine**: `staffing-orchestrator` (campaign-based crew matching with ranking, distance, reliability scoring), `staffing-click` (technician response handler), `staffing-sweeper` (cleanup), `notify-staffing-cancellation`

**User Management**: `create-user`, `delete-user`, `import-users`

**Document Generation**: `generate-memoria-tecnica`, `generate-lights-memoria-tecnica`, `generate-video-memoria-tecnica`, `generate-sv-report`

**External Services**: `create-whatsapp-group`, `create-transport-request`, `get-google-maps-key`, `get-mapbox-token`, `static-map`, `place-photos`, `place-restaurants`, `image-proxy`, `tech-calendar-ics`

**Wallboard**: `wallboard-auth`, `wallboard-feed`, `wallboard-debug`

**System**: `system-health`, `security-audit`, `background-job-deletion`, `evaluate-achievements`, `push/` (WebSocket push bridge)

**Shared utilities** live in `supabase/functions/_shared/` (CORS headers, Supabase client init, response helpers).

**Edge Function Patterns**:
- Runtime: Deno (import from `https://esm.sh/` or `jsr:` for deps)
- Linting: `npm run lint:functions` (separate ESLint config with Deno globals)
- Deployment: Via Supabase CLI (`npx supabase functions deploy <name>`)
- Secrets: Managed via `npx supabase secrets set KEY=VALUE`
- Each function is a directory with `index.ts` entry point

## Development Patterns

### Import Aliases
Always use `@/` alias for imports:
```typescript
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { useJobs } from '@/hooks/useJobs'
```

### Database Access
```typescript
// Always import from the main client
import { supabase } from '@/integrations/supabase/client'

// For typed queries
import type { Database } from '@/integrations/supabase/types'

// Query with RLS policies automatically applied
const { data, error } = await supabase
  .from('jobs')
  .select('*')
  .eq('id', jobId)
  .single()
```

### React Query Patterns
```typescript
import { useQuery, useMutation } from '@tanstack/react-query'
import { queryClient, createQueryKey } from '@/lib/react-query'

// Standard query
const { data: jobs } = useQuery({
  queryKey: createQueryKey.jobs.all,
  queryFn: async () => {
    const { data } = await supabase.from('jobs').select('*')
    return data
  }
})

// Mutation with optimistic updates
const mutation = useMutation({
  mutationFn: updateJob,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: createQueryKey.jobs.all })
  }
})
```

### Date Handling
Use `date-fns` v3.6.0 and `date-fns-tz` for all date operations:
```typescript
import { format, parseISO, addDays } from 'date-fns'
import { zonedTimeToUtc, utcToZonedTime } from 'date-fns-tz'

// Timezone-aware formatting
const madridTime = utcToZonedTime(new Date(), 'Europe/Madrid')
const formatted = format(madridTime, 'yyyy-MM-dd HH:mm:ss')
```

### Component Patterns
```typescript
// Use shadcn/ui components
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

// Form handling with react-hook-form + zod
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const schema = z.object({
  name: z.string().min(1)
})

const form = useForm({
  resolver: zodResolver(schema)
})
```

### Error Handling
```typescript
import { useToast } from '@/hooks/use-toast'
import { toast } from 'sonner' // For simpler toasts

const { toast } = useToast()

try {
  await someOperation()
  toast({ title: "Success", description: "Operation completed" })
} catch (error) {
  toast({
    title: "Error",
    description: error.message,
    variant: "destructive"
  })
}
```

## TypeScript Configuration

- **Strict Mode**: Partially enabled (noImplicitAny: false, strictNullChecks: false)
- **Path Alias**: `@/*` → `./src/*`
- **Skip Lib Check**: Enabled for faster builds
- **Allow JS**: Enabled for gradual migration

This is intentional for a large codebase in active development. Don't add strict type checks without extensive testing.

## Key Implementation Notes

### Festivals vs Tours
- **Festival**: Multi-day event with artists, riders, gear setup, collision detection
- **Tour**: Series of shows/dates with itineraries, travel, hotels, crew assignments per date
- Both use the `tours` table with different workflows

### Assignment System
- **Job Assignments**: Individual technician assignments to single jobs
- **Tour Assignments**: Technician assigned to entire tour (auto-creates job assignments per date)
- **Timesheets**: Auto-generated when assignments are created, synced on changes
- **Cascade Logic**: Removing tour assignment removes all related job assignments and timesheets

### Timesheet Calculation
Handled server-side via `compute_timesheet_hours()` RPC function:
- Calculates regular hours, overtime, night hours
- Applies holiday rates (Madrid public holidays in `public_holidays` table)
- Handles overnight shifts correctly
- Respects job-specific rate overrides

### Crew Assignment Matrix
Located in `src/pages/JobAssignmentMatrix.tsx` and `src/components/matrix/`:
- Multi-department view of all technicians vs jobs
- Color-coded status (pending, accepted, declined)
- Conflict detection (double-booking)
- Bulk operations support
- Real-time updates via Supabase subscriptions

### Equipment Management
Unified equipment table (`equipment_models`) with categories:
- Presets for common equipment packages
- Stock tracking and movements
- Subrental request workflow
- Integration with Flex Rental Solutions
- Availability calculation considering job allocations

### PDF Generation Best Practices
- Use `src/utils/pdf/` utilities for consistent styling
- Corporate logo injection via company settings
- Multi-page support with page breaks
- QR code generation for references
- Export to blob for download or preview

### Staffing Orchestrator

Campaign-based crew assignment engine for matching technicians to jobs:
- **Edge Function**: `supabase/functions/staffing-orchestrator/`
- **Frontend**: `src/features/staffing/`, `src/components/staffing/`
- **Database**: `staffing_campaigns` table + related tables (20260112 migrations)
- **Flow**: Create campaign → rank candidates (distance, reliability, availability) → send invitations → technician clicks accept/decline via `staffing-click` → `staffing-sweeper` cleans up expired campaigns
- **Ranking factors**: Geographic distance, past reliability score, technician preferences, custom rates
- **Critical**: Campaign state machine — don't bypass status transitions

### Hoja de Ruta (Route Sheets)

Complex document builder for daily route/logistics sheets:
- **Page**: `src/pages/HojaDeRuta.tsx`
- **Hooks**: `useHojaDeRutaForm` (14.4KB form state), `useHojaDeRutaPersistence` (28.9KB data persistence), `useHojaDeRutaImages` (image handling), `useHojaDeRutaTemplates` (template management)
- **Utils**: `src/utils/hoja-de-ruta/`, `src/utils/hojaDeRutaExport.ts` (20.8KB PDF export)
- **Workflow**: Create/edit route sheets with stops, images, notes → save as template → export to PDF
- **Note**: One of the most complex form systems in the app — 4 dedicated hooks totaling 50KB+

### SoundVision File Library

File management system for SoundVision venue files with access control:
- **Page**: `src/pages/SoundVisionFiles.tsx`
- **Hooks**: `useSoundVisionFiles` (11KB queries), `useSoundVisionUpload` (upload), `useSoundVisionAccessRequest` (6.6KB access workflow), `useSoundVisionFileReviews` (5.9KB review workflow)
- **Access Control**: Users request access → admin approves/denies → approved users can download files
- **Docs**: `docs/soundvision-access-workflow.md`, `docs/soundvision-access-test-cases.md`

### Activity / Audit Logging

Admin-facing activity feed tracking all significant platform events:
- **Feature module**: `src/features/activity/` — `api.ts`, `catalog.ts` (7.2KB event type catalog), `types.ts`
- **Realtime**: `src/features/activity/hooks/useActivityRealtime.ts`
- **Page**: Activity center page for admins
- **Events tracked**: Job creation/updates, assignments, timesheet submissions, staffing campaigns, equipment movements, etc.

### Public Artist Form

Tokenized public routes allowing artists to submit technical riders without authentication:
- **Routes**: `/festival/artist-form/*` (public, no auth required)
- **Edge Functions**: `upload-public-artist-rider`, `delete-public-artist-rider`, `submit-public-artist-form`
- **Pattern**: Festival generates a unique token URL → artist fills requirements form → data saved to `artist_requirements` table
- **Security**: Token-based access, no user session needed

### Digital Signage (Wallboard)
Real-time wallboard displays for crew schedules, announcements:
- Public access via token-based URLs
- Preset management for different display types
- Auto-refresh and sync with platform
- LG webOS app package in repo for TV deployment

## Environment Variables

### Required Variables (set in Cloudflare Pages, never in code)

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL (`https://[project].supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public JWT key |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Fallback alias for anon key (same value) |
| `VITE_SUPABASE_FUNCTIONS_URL` | Edge functions URL (`https://[project].supabase.co/functions/v1`) |
| `VITE_VAPID_PUBLIC_KEY` | Web Push VAPID public key (for push notifications) |
| `VITE_ENABLE_ACTIVITY_PUSH_FALLBACK` | Feature flag: activity push fallback (`true`/`false`) |

### Dynamic (injected at build time by Vite)

```bash
VITE_APP_VERSION        # Auto-set to ISO timestamp
VITE_BUILD_TIMESTAMP    # Auto-set to Unix timestamp (ms)
```

Service worker version injection via `scripts/inject-sw-version.mjs` (runs post-build).

### Local Development

```bash
cp .env.example .env.local        # Copy template, fill in Supabase creds
cp .env.staging.example .env.staging.local  # For staging environment
```

- `.env.local` — default local development
- `.env.staging.local` — staging Supabase project (`npm run dev:staging`)
- `.env.prod.local` — point local UI at production (`npm run dev -- --mode prod`)

**Never commit `.env*` files.** All are gitignored.

### Staging Workflow

```bash
npm run dev:staging     # Dev server against staging Supabase
npm run build:staging   # Build for staging
```

For full Cloudflare + Supabase staging setup, see `docs/STAGING_SETUP.md`.

## Git Workflow

**DO NOT** work directly on `main` branch. Always use `dev` or feature branches.

```bash
# Start new work
git checkout dev
git pull origin dev

# Make changes and commit
git add .
git commit -m "feat: description"  # Use conventional commits
git push origin dev

# Create PR to merge into main
# After approval, merge triggers production deployment
```

**Conventional Commit Prefixes**: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`

## Common Tasks

### Adding a New Page
1. Create page component in `src/pages/YourPage.tsx`
2. Lazy import in `src/App.tsx`
3. Add route in `<Routes>` section
4. Add navigation link in `src/components/layout/Layout.tsx` (if needed)

### Adding a New Database Table
1. Create migration file in `supabase/migrations/` with timestamp naming
2. Define table schema, RLS policies, indexes
3. Run migration (via Supabase dashboard or CLI)
4. Regenerate types (Supabase will auto-update `types.ts`)
5. Update React Query keys if needed in `src/lib/optimized-react-query.ts`

### Adding a New Component
1. Create in appropriate feature directory under `src/components/`
2. Use shadcn/ui primitives for base components
3. Follow existing patterns for forms (react-hook-form + zod)
4. Co-locate types and utilities if feature-specific

### Adding a New Custom Hook
1. Create in `src/hooks/use{Feature}.ts`
2. Use React Query for data fetching
3. Export typed return values
4. Document parameters and return types

### Running Tests for a Specific File
```bash
npm test -- src/components/expenses/__tests__/ExpenseForm.test.tsx
```

### Debugging Realtime Issues
```typescript
import { getRealtimeConnectionStatus, monitorConnectionHealth } from '@/integrations/supabase/client'

// Check connection status
const status = getRealtimeConnectionStatus()
console.log('Realtime status:', status)

// Force reconnect if needed
import { ensureRealtimeConnection } from '@/lib/enhanced-supabase-client'
await ensureRealtimeConnection()
```

## Supabase Local Development

Local Supabase setup is not fully configured. Production Supabase instance is primary environment.

To set up local development:
```bash
npx supabase start
# Update .env with local URLs
# Run migrations: npx supabase db reset
```

## Additional Resources

### Companion Documentation (in repo)
- **ARCHITECTURE.md** — Full system architecture, project structure diagram, all component domains, integrations, security, and glossary
- **DEVELOPMENT.md** — Local dev setup, lock file strategy, dependency management, environment switching, archive/legacy policy
- **DEPLOYMENT.md** — Cloudflare Pages setup, environment variables configuration, deployment process, rollback, troubleshooting
- **SECURITY.md** — Known vulnerabilities, accepted risks, security best practices, incident response plan
- **CHANGELOG.md** — Release notes and version history
- **docs/** — 60+ feature docs: push notifications, staging setup, staffing orchestrator, wallboard, SoundVision, audit reports, workflows
- **docs/README.md** — Documentation index organized by category
- **.github/GIT_HYGIENE.md** — Branch naming, PR workflow, stale branch cleanup

### External Documentation
- **UI Components**: [shadcn/ui documentation](https://ui.shadcn.com/)
- **React Query**: [TanStack Query docs](https://tanstack.com/query/latest)
- **Capacitor**: [Capacitor docs](https://capacitorjs.com/)
- **Supabase**: [Supabase docs](https://supabase.com/docs)
- **Cloudflare Pages**: [Pages docs](https://developers.cloudflare.com/pages/)

## Archive and Legacy Policy

- Use `archive/` for historical planning docs and backup assets — stays in git history, not in active development
- Use `src/legacy/` for deprecated/superseded app code retained for reference
- **Do not** add new runtime imports from `archive/` or `src/legacy/`
- Active sources: `src/`, active docs: `docs/`, active migrations: `supabase/migrations/`
- Helper scripts go in `scripts/` (SQL helpers in `scripts/sql/`), feature docs in `docs/` subfolders

## Project-Specific Context

- **Target Users**: Production companies, technical crews, freelancers, coordinators
- **Primary Language**: Spanish (UI text, database content)
- **Timezone**: Europe/Madrid (default for all date handling)
- **Industry Domain**: Live event production, concerts, festivals, tours
- **Operational Focus**: Crew management, logistics, technical documentation, equipment tracking

This platform replaces fragmented workflows with integrated planning, communication, and execution tools validated by active production professionals.

---

## Claude Code Workflow Guide

This section defines how we work with Claude Code across the project. These patterns apply to all sessions.

### Parallel Worktrees

We run 3-5 Claude Code sessions in parallel using git worktrees. Each worktree is a fully isolated working copy with its own branch, node_modules, and Claude session.

**Setup:**
```bash
# Create a worktree for a feature
./scripts/worktree.sh create feature-auth main

# Create a worktree for a bugfix
./scripts/worktree.sh create bugfix-timesheets main

# List active worktrees
./scripts/worktree.sh list

# Clean up when done
./scripts/worktree.sh remove feature-auth
```

**Shell aliases** (add to `~/.bashrc` or `~/.zshrc`):
```bash
alias za='cd /path/to/area-tecnica-a && claude'
alias zb='cd /path/to/area-tecnica-b && claude'
alias zc='cd /path/to/area-tecnica-c && claude'
alias zmain='cd /path/to/area-tecnica && claude'
```

**Rules for parallel work:**
- Each worktree works on ONE task. Don't mix concerns.
- Name worktrees after the task: `feature-auth`, `bugfix-timesheets`, `refactor-pdf`
- Keep a dedicated "analysis" worktree for read-only investigation (logs, queries, exploration)
- Always `npm install --legacy-peer-deps` in new worktrees
- Merge back to dev/main via PR, never cross-merge between worktrees

### Plan Mode First

Start every complex task in plan mode. Don't start coding until the plan is solid.

**When to use plan mode:**
- Multi-file changes (3+ files)
- New features or components
- Database schema changes
- Refactoring existing patterns
- Anything touching auth, assignments, timesheets, or Flex integration

**How to plan:**
1. Use `/plan <task description>` to create a detailed implementation plan
2. Use `/review-plan` to review the plan as a staff engineer
3. Only proceed to implementation after the plan passes review
4. If implementation goes sideways, STOP and re-plan. Don't keep pushing.
5. Use plan mode for verification steps too, not just the build

**Plan mode shortcuts:**
- `Shift+Tab` in Claude Code cycles through permission modes (Normal -> Auto-Accept -> Plan)
- `claude --permission-mode plan` starts a session directly in plan mode

### Skills & Slash Commands

Custom slash commands live in `.claude/commands/`. Use them frequently:

| Command | Purpose |
|---------|---------|
| `/plan <task>` | Create an implementation plan (plan mode) |
| `/review-plan` | Review a plan as staff engineer |
| `/fix <error>` | Diagnose and fix a bug |
| `/techdebt` | Scan for tech debt and duplicated code |
| `/ci-fix` | Fix failing build/CI |
| `/verify` | Verify changes are correct (diff, build, logic check) |
| `/update-notes` | Capture session learnings in `.claude/notes/` |

**Creating new commands:** If you do something more than once a day, turn it into a command. Create a markdown file in `.claude/commands/<name>.md` with instructions.

**Skills** (in `.claude/skills/`) are more advanced commands that support frontmatter for model selection, tool restrictions, and subagent execution:
- `plan-review` -- Two-phase plan + self-review in a subagent
- `techdebt-scan` -- Deep tech debt scan using Explore agent

### Subagents

Use subagents to throw more compute at problems while keeping the main context window clean.

**When to use subagents:**
- Append "use subagents" to any request where you want parallel investigation
- Offload individual tasks (search, analysis, tests) to subagents
- Use the `Explore` agent type for read-only codebase investigation
- Use the `Plan` agent type for planning without modifying files

**Built-in agent types:** `Bash`, `Explore`, `Plan`, `general-purpose`

### Session Notes

After every meaningful session, run `/update-notes` to capture:
- What was done
- Key decisions and their rationale
- Patterns or gotchas discovered
- Follow-up items

Notes are stored in `.claude/notes/` and feed back into CLAUDE.md when patterns are confirmed.

### CLAUDE.md Maintenance

This file is a living document. After every correction or mistake:
1. Fix the immediate issue
2. Update CLAUDE.md so the mistake doesn't recur
3. Be specific -- add the exact rule or pattern, not vague guidance

### Prompting Patterns

**Challenge Claude:**
- "Grill me on these changes and don't make a PR until I pass your test"
- "Prove to me this works" -- have Claude diff behavior between main and feature branch
- After a mediocre fix: "Knowing everything you know now, scrap this and implement the elegant solution"

**Be specific:**
- Write detailed specs before handing off work
- Reduce ambiguity -- the more specific, the better the output
- Include file paths, function names, and expected behavior in requests

**Bug fixing:**
- Paste the error/log directly and say "fix"
- "Go fix the failing CI tests" -- don't micromanage how
- Point Claude at logs for distributed system debugging

### Learned Rules (Updated Per Session)

_Add rules here as they are discovered. Each rule should reference a specific mistake or pattern._

- **Always use `--legacy-peer-deps`** with npm install (peer dependency conflicts with vite 6, date-fns 3)
- **Never add package-lock.json** to the repo (breaks Cloudflare CI)
- **Timezone is always Europe/Madrid** for all date operations
- **UI text is in Spanish** -- don't introduce English strings in user-facing components
- **date-fns must stay at ^3.6.0** -- react-day-picker breaks on v4
- **Supabase types are auto-generated** -- don't manually edit `src/integrations/supabase/types.ts`
- **Tour assignments cascade** -- removing a tour assignment must remove related job assignments and timesheets
- **Flex folder hierarchy must exist** before creating work elements or crew calls
- **Don't import lovable-tagger** in vite.config.ts (causes build failures)
- **Edge functions use Deno runtime** — don't use Node.js APIs or npm imports in `supabase/functions/`; use `https://esm.sh/` or `jsr:` for deps
- **Lint edge functions separately** — `npm run lint:functions` uses different ESLint config with Deno globals
- **Never commit .env files** — all dotenv files are gitignored; secrets go in Cloudflare Pages dashboard or Supabase secrets
- **Staging uses a separate Supabase project** — don't point staging at production; use `.env.staging.local` and `npm run dev:staging`
- **Staffing campaign state machine** — don't bypass status transitions in the staffing orchestrator flow
- **CI requires Node 20** — GitHub Actions workflow uses Node 20; match locally for consistency
- **Playwright needs Chromium** — `npm run test:e2e` requires Playwright browsers installed (`npx playwright install chromium`)
- **100 SQL migrations exist** — the initial `00000000000000_production_schema.sql` is 10,500+ lines; new migrations use timestamp naming (`YYYYMMDDHHMMSS_description.sql`)
- **Don't manually edit archive/ or src/legacy/** — these are retained for reference only, no new runtime imports
