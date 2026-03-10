# Capacitor Mobile App Wrapper Design

**Date:** 2026-01-02
**Status:** Approved
**Goal:** Wrap existing web app with Capacitor for iOS and Android App Store distribution

## Context

Area Tecnica is a Vite + React + TypeScript app using Supabase for backend. It already has PWA support with service worker, manifest, and push notifications. The goal is App Store presence for discoverability and credibility.

## Decisions

- **Bundle ID:** `com.sectorpro.areatecnica`
- **App Store Name:** "Area Tecnica - Sector Pro"
- **Target Platforms:** iOS and Android
- **Scope:** Wrapper only (no native plugins initially)
- **Build Environment:** Mac available for iOS builds

## Technical Approach

### Project Structure After Setup

```
area-tecnica/
├── src/                    # Existing React code
├── dist/                   # Vite build output (web assets)
├── android/                # Android Studio project (generated)
├── ios/                    # Xcode project (generated)
├── capacitor.config.ts     # Capacitor configuration
└── package.json            # Updated with Capacitor deps
```

### Build Flow

1. `npm run build` - Creates `dist/`
2. `npx cap sync` - Copies `dist/` to native projects
3. Open in Xcode/Android Studio - Build native app

### Dependencies

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
```

### Capacitor Configuration

```typescript
// capacitor.config.ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sectorpro.areatecnica',
  appName: 'Area Tecnica - Sector Pro',
  webDir: 'dist',
  server: {
    allowNavigation: ['*.supabase.co']
  }
};

export default config;
```

### Package.json Scripts

```json
{
  "scripts": {
    "cap:sync": "npm run build && npx cap sync",
    "cap:ios": "npm run build && npx cap sync ios && npx cap open ios",
    "cap:android": "npm run build && npx cap sync android && npx cap open android"
  }
}
```

## Assets Required

| Asset | Specification |
|-------|---------------|
| App Icon Source | 1024x1024 PNG, no transparency, no rounded corners |
| Splash Screen | 2732x2732 PNG |
| Store Screenshots (iOS) | 6.7" (1290x2796), 5.5" (1242x2208) |
| Store Screenshots (Android) | Phone + 7" tablet |
| Feature Graphic (Android) | 1024x500 PNG |

Use `@capacitor/assets generate` to auto-generate all required sizes from source images.

## Developer Accounts

| Platform | Cost | URL |
|----------|------|-----|
| Apple Developer Program | $99/year | developer.apple.com |
| Google Play Console | $25 one-time | play.google.com/console |

## Privacy Policy (GDPR + App Store Requirement)

Both Apple and Google require a privacy policy URL. GDPR requires it to be accessible.

### Route

- **URL:** `/privacy`
- **Auth:** None required (public page - Apple reviewers must access it)
- **Purpose:** Legal compliance, user transparency

### Placement (Required)

1. **Login page footer** - Link below login form
2. **Profile/Settings page** - Under "Data & Privacy" section

### Page Structure

```
/privacy
├── Header: "Privacy Policy" + last updated date
├── How we collect data
├── What data we store
├── How we use your data
├── Your rights (view, download, delete)
├── Contact information
└── No auth required
```

### Login Page Footer

```
┌─ Login Page ──────────────────┐
│  [Username]                   │
│  [Password]                   │
│  [Login]                      │
│  ─────────────────────        │
│  Privacy Policy | Contact     │
└───────────────────────────────┘
```

### Profile Settings Section

```
┌─ Profile Settings ────────────┐
│  Data & Privacy               │
│  → Privacy Policy             │
│  → Download My Data           │
│  → Delete Account             │
└───────────────────────────────┘
```

## Implementation Phases

### Phase 1: Setup
- Install Capacitor dependencies
- Create `capacitor.config.ts`
- Initialize native projects (`ios/` and `android/` folders)
- Add build scripts to package.json
- Test local build opens in Xcode and Android Studio

### Phase 1.5: Privacy Policy
- Create `/privacy` route (public, no auth)
- Add privacy policy content page
- Add link to login page footer
- Add "Data & Privacy" section to Profile page with link

### Phase 2: Assets
- Create 1024x1024 source icon
- Create 2732x2732 splash screen image
- Run `@capacitor/assets generate`
- Verify icons in both IDEs

### Phase 3: Developer Accounts
- Register Apple Developer Program
- Register Google Play Console
- Create app entries with bundle ID

### Phase 4: Store Submission
- Prepare app description and keywords
- Provide privacy policy URL to App Store Connect and Google Play Console
- Capture screenshots from simulators
- Build release versions and submit for review

## Notes

- Apple review: 24-48 hours (longer for first submission)
- Google review: Usually hours to 1 day
- Existing PWA service worker and web push will continue working
- Native push can be added later if needed
