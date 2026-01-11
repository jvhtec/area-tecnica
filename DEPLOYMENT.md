# Deployment Guide

This guide covers deploying Area Tecnica to Cloudflare Pages.

## Cloudflare Pages Setup

### Prerequisites

- Cloudflare account with Pages access
- GitHub repository connected to Cloudflare Pages
- Supabase project credentials

### Initial Setup

1. **Create Cloudflare Pages Project** (if not already done)
   - Go to: https://dash.cloudflare.com/
   - Navigate to: Workers & Pages → Create application → Pages → Connect to Git
   - Select repository: `jvhtec/area-tecnica`
   - Production branch: `main` (or your production branch)

2. **Configure Build Settings**
   - Build command: `npm install --legacy-peer-deps && npm run build`
   - Build output directory: `dist`
   - Root directory: `/` (leave blank)
   - Environment: `Production (main)`

### Environment Variables Configuration

**CRITICAL**: Environment variables must be configured in Cloudflare Pages dashboard, not in git.

#### Required Variables

Navigate to: **Settings → Environment variables** and add:

| Variable | Value | Environment |
|----------|-------|-------------|
| `VITE_SUPABASE_PROJECT_ID` | Your Supabase project ID | Production + Preview |
| `VITE_SUPABASE_URL` | `https://YOUR_PROJECT_ID.supabase.co` | Production + Preview |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key (JWT token) | Production + Preview |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Same as anon key | Production + Preview |
| `VITE_VAPID_PUBLIC_KEY` | Your VAPID public key for web push | Production + Preview |

**Get Supabase credentials from**:
- Dashboard: https://supabase.com/dashboard/project/YOUR_PROJECT_ID/settings/api
- Copy the **anon/public** key (NOT the service_role key)
- Copy the **Project URL**

#### Setting Variables for Both Environments

For each variable:
1. Click **Add variable**
2. Enter variable name (e.g., `VITE_SUPABASE_URL`)
3. Enter value
4. Select environments: ✅ Production ✅ Preview
5. Click **Save**

Repeat for all 5 required variables.

### Deployment Process

#### Automatic Deployments

Cloudflare Pages automatically deploys when you push to connected branches:

- **Production**: Pushes to `main` branch → https://sector-pro.work
- **Preview**: Pushes to any other branch → `https://COMMIT_HASH.area-tecnica.pages.dev`

#### Manual Deployments

To retry a failed deployment:
1. Go to: **Deployments** tab
2. Find the failed deployment
3. Click **⋮** (three dots) → **Retry deployment**

#### Viewing Build Logs

To debug build failures:
1. Go to: **Deployments** tab
2. Click on the deployment
3. View **Build log** and **Function log**

### Common Deployment Issues

#### ❌ "Missing required environment variable: VITE_SUPABASE_URL"

**Cause**: Environment variables not configured in Cloudflare Pages  
**Fix**: Add all required environment variables (see above)

#### ❌ "ERESOLVE unable to resolve dependency tree"

**Cause**: npm tried to use `npm ci` or install without `--legacy-peer-deps`  
**Fix**: Ensure build command is: `npm install --legacy-peer-deps && npm run build`

#### ❌ Build succeeds but app shows blank page

**Causes**:
1. Missing environment variables (check browser console)
2. Runtime errors in production build
3. Service worker caching old version

**Fix**:
1. Check environment variables are set for correct environment (Production vs Preview)
2. Check deployment Function logs for runtime errors
3. Hard refresh: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)

#### ❌ "Failed to fetch" or CORS errors

**Cause**: Supabase URL or keys are incorrect  
**Fix**: 
1. Verify VITE_SUPABASE_URL matches your Supabase project
2. Verify VITE_SUPABASE_ANON_KEY is valid and not expired
3. Check Supabase dashboard → Settings → API for correct values

### Security Considerations

#### 🔒 Credential Rotation

After rotating Supabase or VAPID credentials:

1. **Update Cloudflare Pages variables**:
   - Settings → Environment variables
   - Edit each affected variable
   - Update value
   - Save

2. **Trigger new deployment**:
   - Push a commit, or
   - Retry latest deployment

3. **Verify deployment**:
   - Check preview/production URL loads correctly
   - Test authentication
   - Test push notifications (if VAPID changed)

#### 🔒 Production vs Preview Environments

- **Production**: Uses production environment variables
- **Preview**: Uses preview environment variables (can be different)

**Recommendation**: Use same credentials for both unless you have separate Supabase projects for staging/production.

### Branch Preview URLs

Each branch gets a unique preview URL:
- Main preview: `https://claude-remove-sensitive-files-bgVPi.area-tecnica.pages.dev`
- Commit-specific: `https://COMMIT_SHORT_SHA.area-tecnica.pages.dev`

Preview deployments help test changes before merging to production.

### Performance Optimization

Cloudflare Pages provides:
- **Global CDN**: Automatic edge caching
- **Automatic minification**: JavaScript, CSS, HTML
- **Brotli compression**: Smaller file sizes
- **HTTP/3**: Faster connections

No additional configuration needed.

### Monitoring

#### View Analytics

- Navigate to: **Analytics** tab
- View: Page views, bandwidth, requests

#### View Logs

- Navigate to: **Functions** tab (if using Cloudflare Functions)
- Real-time logs for serverless functions

### Rolling Back

To rollback to a previous deployment:

1. Go to: **Deployments** tab
2. Find the working deployment
3. Click **⋮** (three dots) → **Rollback to this deployment**
4. Confirm rollback

This switches production traffic to the selected deployment immediately.

### Custom Domain (Production)

The production deployment is configured to use:
- **Primary**: sector-pro.work
- **Automatic HTTPS**: Cloudflare SSL/TLS

To update custom domain settings:
1. Navigate to: **Custom domains**
2. Add/remove domains as needed
3. Update DNS records if required

### Support Resources

- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [Vite Deployment Guide](https://vitejs.dev/guide/static-deploy.html)
- [Troubleshooting Builds](https://developers.cloudflare.com/pages/platform/build-configuration/)

### Related Documentation

- [DEVELOPMENT.md](./DEVELOPMENT.md) - Local development setup
- [SECURITY.md](./SECURITY.md) - Security practices and credential management
- [CLAUDE.md](./CLAUDE.md) - Complete project documentation
