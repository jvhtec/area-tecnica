# PWA Service Worker Cache Control Configuration

## Overview

This document provides server-side configuration examples to prevent caching of the service worker file (`sw.js`). This is **critical** for ensuring users receive service worker updates immediately.

## Why This Matters

If your web server caches the `sw.js` file:
- Browsers will not detect new versions of the service worker
- Users will continue using the old service worker indefinitely
- App updates will not be deployed to users
- The update notification system will not work

## The Solution

Configure your web server to send cache-control headers that prevent caching of the service worker file.

---

## Configuration Examples by Server/Platform

### Nginx

Add this to your Nginx configuration file (usually in `/etc/nginx/sites-available/your-site`):

```nginx
# Prevent service worker caching
location /sw.js {
    add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0";
    add_header Pragma "no-cache";
    expires off;
}
```

After adding this configuration:
1. Test the configuration: `sudo nginx -t`
2. Reload Nginx: `sudo systemctl reload nginx`

---

### Apache

Add this to your `.htaccess` file or Apache configuration:

```apache
# Prevent service worker caching
<FilesMatch "sw\.js$">
    Header set Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
    Header set Pragma "no-cache"
    Header set Expires "0"
</FilesMatch>
```

Make sure `mod_headers` is enabled:
```bash
sudo a2enmod headers
sudo systemctl restart apache2
```

---

### Netlify

Create or update a `_headers` file in your project root (or public directory):

```
/sw.js
  Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0
  Pragma: no-cache
```

The `_headers` file will be deployed with your site and applied automatically.

---

### Vercel

Create or update `vercel.json` in your project root:

```json
{
  "headers": [
    {
      "source": "/sw.js",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
        },
        {
          "key": "Pragma",
          "value": "no-cache"
        }
      ]
    }
  ]
}
```

---

### Cloudflare Pages

Create or update a `_headers` file in your build output directory:

```
/sw.js
  Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0
  Pragma: no-cache
```

Additionally, you may want to configure Cloudflare's cache settings:
1. Go to your Cloudflare dashboard
2. Navigate to Caching → Configuration
3. Create a Page Rule for `*sw.js` with "Cache Level: Bypass"

---

### AWS S3 + CloudFront

#### S3 Metadata

When uploading `sw.js` to S3, set the metadata:
- `Cache-Control`: `no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0`
- `Pragma`: `no-cache`

#### CloudFront Behavior

Create a CloudFront behavior for `/sw.js`:
1. Go to CloudFront → Distributions → Your Distribution
2. Create a new behavior with path pattern: `/sw.js`
3. Set:
   - Cache Policy: `Managed-CachingDisabled`
   - Or create a custom cache policy with TTL = 0

---

### Express.js (Node.js)

Add this middleware before serving static files:

```javascript
// Prevent service worker caching
app.get('/sw.js', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Then serve static files
app.use(express.static('public'));
```

---

### GitHub Pages

GitHub Pages doesn't allow custom headers configuration. However, you can work around this by:

1. **Rename your service worker file** with a version hash (e.g., `sw.v2.js`, `sw.abc123.js`)
2. **Update the registration** in your app to check for the new filename
3. Use a **service worker registration script** that includes a timestamp query parameter:

```javascript
// In your main.tsx or registration script
const swUrl = `/sw.js?v=${Date.now()}`;
navigator.serviceWorker.register(swUrl);
```

Note: This is a workaround and not ideal. Consider using a different hosting platform for production PWAs.

---

## Testing Your Configuration

After deploying your cache-control configuration, verify it's working:

### Using Browser DevTools

1. Open Chrome DevTools (F12)
2. Go to Network tab
3. Reload the page
4. Find `sw.js` in the network requests
5. Click on it and check the Response Headers
6. Verify `Cache-Control` header shows: `no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0`

### Using curl

```bash
curl -I https://your-domain.com/sw.js
```

Look for the `Cache-Control` header in the response.

### Using Online Tools

- [RedBot](https://redbot.org/) - HTTP header analyzer
- [GTmetrix](https://gtmetrix.com/) - Performance and caching analysis

---

## Additional Recommendations

### Cache the App Shell Assets

While the service worker file should NOT be cached, your app shell assets (HTML, CSS, JS, images) SHOULD be cached for performance:

```nginx
# Cache app shell assets (example for Nginx)
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# But still prevent SW caching
location /sw.js {
    add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0";
    expires off;
}
```

### Service Worker Update Check Interval

The browser checks for service worker updates:
- On page load/navigation
- Every 24 hours (by default)
- When calling `registration.update()` manually

Our app calls `registration.update()` on every page load (see `src/main.tsx`), which helps ensure timely updates.

---

## Troubleshooting

### Updates Still Not Working?

1. **Clear browser cache completely**: Go to DevTools → Application → Clear storage → Clear site data
2. **Check server headers**: Use curl or DevTools Network tab to verify headers
3. **Check CDN/proxy caching**: If using a CDN, ensure it's not caching the SW
4. **Hard refresh**: Press Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
5. **Check browser compatibility**: Service workers require HTTPS (except on localhost)

### Testing Locally

When testing locally, browsers may behave differently:
- Chrome updates service workers more aggressively in development
- Use DevTools → Application → Service Workers → "Update on reload" for testing
- The "Bypass for network" checkbox can help test without cache

---

## Implementation Status

Our PWA now includes:

✅ **Phase 1: Immediate Updates**
- `skipWaiting()` in service worker install event
- `clients.claim()` in service worker activate event

✅ **Phase 2: User-Friendly Updates**
- Update detection hook (`useServiceWorkerUpdate`)
- Toast notification with update button
- Automatic reload when new SW takes control
- SKIP_WAITING message handler

⚠️ **Phase 3: Server Configuration** (Action Required)
- Configure your production server using examples above
- Test the configuration after deployment
- Monitor that users receive updates promptly

---

## References

- [Service Worker Lifecycle](https://developers.google.com/web/fundamentals/primers/service-workers/lifecycle)
- [MDN: Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Cache-Control Header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control)
