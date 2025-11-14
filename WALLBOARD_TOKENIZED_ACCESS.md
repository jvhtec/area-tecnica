# Wallboard Tokenized Access

This document describes the tokenized access feature for the wallboard, allowing display of wallboards without requiring user authentication.

## Features Implemented

### 1. Splash Screen Animation
- Beautiful animated splash screen that appears while wallboard data loads
- Features:
  - Animated logo with glow effects
  - Floating particles background
  - Animated grid background
  - Loading bar indicator
  - "Initializing System" text
  - Auto-dismisses after 3 seconds or on click
- Located in: `src/components/SplashScreen.tsx`

### 2. Tokenized Wallboard Access
- New public route that doesn't require user login
- URL format: `/wallboard/public/:token/:presetSlug?`
- Token-based access control for security
- Located in: `src/pages/WallboardPublic.tsx`

## Usage

### Accessing the Wallboard with Token

#### URL Format
```
/wallboard/public/{TOKEN}/{PRESET_SLUG}
```

#### Examples
```
# Access default wallboard with demo token
/wallboard/public/demo-wallboard-token/default

# Access production wallboard with demo token
/wallboard/public/demo-wallboard-token/produccion

# Access custom preset with production token
/wallboard/public/your-secure-token/custom-preset
```

### Setting Up the Access Token

The wallboard token is configured via environment variable:

1. Create or update your `.env` file:
```bash
VITE_WALLBOARD_TOKEN=your-secure-random-token-here
```

2. Generate a secure token (recommended):
```bash
# Using openssl
openssl rand -hex 32

# Or using node
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

3. Share the complete URL with authorized users:
```
https://yourdomain.com/wallboard/public/your-secure-random-token-here/default
```

### Default Token (Development Only)
For development/testing, the default token is: `demo-wallboard-token`

**⚠️ WARNING**: Change this token in production! Use a long, random string.

## Authentication Flow

### Authenticated Access (Existing)
```
User → Login → Dashboard → /wallboard/:presetSlug
                            ↓
                     Requires auth + role check
                     (admin, management, or wallboard role)
```

### Tokenized Access (New)
```
Display Device → /wallboard/public/:token/:presetSlug
                            ↓
                   Token validation (no login required)
                            ↓
                   Wallboard displays if token matches
```

## Components Modified

### 1. `src/pages/Wallboard.tsx`
- Added splash screen integration
- Refactored to support both authenticated and public access
- Created `WallboardDisplay` component (main display logic)
- Kept `Wallboard` as default export with auth guard
- Exported `WallboardDisplay` for use by public route

### 2. `src/App.tsx`
- Added new route: `/wallboard/public/:token/:presetSlug?`
- Route placed before authenticated wallboard route
- No `RequireAuth` wrapper on public route

### 3. New Files Created
- `src/components/SplashScreen.tsx` - Animated splash screen
- `src/pages/WallboardPublic.tsx` - Public wallboard access handler

## Security Considerations

1. **Token Security**
   - Use long, random tokens (32+ characters)
   - Rotate tokens periodically
   - Don't commit tokens to version control
   - Use different tokens for different environments

2. **Access Control**
   - Token grants read-only access to wallboard data
   - Uses existing RLS (Row Level Security) policies
   - Data access follows wallboard role permissions
   - No write operations possible through public route

3. **Production Recommendations**
   - Set `VITE_WALLBOARD_TOKEN` in production environment
   - Consider implementing token expiration
   - Monitor access logs for suspicious activity
   - Use HTTPS only for wallboard URLs

## Data Access

The wallboard uses the following data sources (all read-only):
- Jobs and job assignments
- Crew availability and timesheets
- Document progress
- Logistics events
- Announcements
- Wallboard presets

All data access is governed by existing RLS policies configured for the `wallboard` role.

## Troubleshooting

### "Access Denied" Error
- Verify the token matches `VITE_WALLBOARD_TOKEN` environment variable
- Check that the URL format is correct
- Ensure the environment variable is set in your deployment

### Wallboard Not Loading
- Check browser console for errors
- Verify Supabase connection is working
- Ensure RLS policies allow wallboard role access
- Check that the preset slug exists in `wallboard_presets` table

### Splash Screen Not Appearing
- The splash screen shows for 3 seconds during initial load
- Click anywhere to skip the splash screen
- Check that SplashScreen component is imported correctly

## Future Enhancements

Potential improvements for the tokenized access:
1. Token expiration/rotation system
2. Per-preset token access control
3. Access logging and analytics
4. Multiple token support (different tokens for different presets)
5. JWT-based tokens with Supabase edge function integration
6. IP whitelist restrictions
