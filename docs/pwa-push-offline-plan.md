# Store-Free PWA Push + Offline Rollout Plan

This document captures the implementation plan for enabling a store-free progressive web application with offline support and end-to-end web push notifications across Area Técnica events.

## 1. Event Taxonomy

Track and broadcast the following event types (final taxonomy):

```
job.created
job.edited
message.availability.sent        // email or whatsapp
message.offer.sent               // email or whatsapp
decision.availability.accepted
decision.offer.accepted
flex.folder.created
doc.uploaded
doc.deleted
```

## 2. Push Payload Schema

The push service must send compact JSON payloads (≤ 4 KB) that always include who triggered the event.

```json
{
  "type": "job.created",
  "title": "Job created",
  "body": "Ana R. created “EDM Tour — Madrid” (Oct 28).",
  "url": "/jobs/12345",
  "meta": {
    "jobId": "12345",
    "actor": { "id": "u_42", "name": "Ana R.", "email": "ana@yourco.com" },
    "channel": "email|whatsapp|null",
    "scope": "availability|offer|null",
    "docId": "optional",
    "docName": "optional"
  }
}
```

## 3. Client (React PWA)

### 3.1 Manifest

Provide PWA metadata and icons to make the app installable.

```json
{
  "name": "YourApp",
  "short_name": "YourApp",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#ffffff",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

Register the service worker in the app entry point:

```js
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
```

### 3.2 Service Worker (`/public/sw.js`)

Handle offline app-shell caching and web push interactions.

```js
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open('app-shell-v1').then(c =>
      c.addAll([
        '/', '/index.html', '/manifest.json',
        '/icons/icon-192.png', '/icons/icon-512.png'
      ])
    )
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request))
  );
});

self.addEventListener('push', (e) => {
  let p = {};
  try { p = e.data ? e.data.json() : {}; } catch {}
  const title = p.title || 'Update';
  const options = {
    body: p.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: p.url || '/', type: p.type, meta: p.meta || {} },
    actions: [{ action: 'open', title: 'Open' }]
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = e.notification.data?.url || '/';
  e.waitUntil((async () => {
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const u = new URL(target, self.location.origin).toString();
    const open = windows.find(w => w.url.split('#')[0].split('?')[0] === u);
    if (open) return open.focus();
    return clients.openWindow(target);
  })());
});
```

### 3.3 Push Helpers (`src/push.js`)

Encapsulate push subscription lifecycle handling.

```js
export async function enablePush(vapidPublicKey) {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Push not supported');
  }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return null;

  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64ToUint8(vapidPublicKey)
  });

  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(sub)
  });
  return sub;
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await fetch('/api/push/unsubscribe', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ endpoint: sub.endpoint })
    });
    await sub.unsubscribe();
  }
}

function base64ToUint8(base64) {
  const padding = '='.repeat((4 - base64.length % 4) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64Safe);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}
```

## 4. Backend (Node/Express + `web-push`)

### 4.1 Dependencies & VAPID Keys

Install dependencies and provision VAPID keys:

```bash
npm i web-push express body-parser
node -e "const wp=require('web-push');console.log(wp.generateVAPIDKeys())"
```

Expose `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` via environment variables.

### 4.2 Data Model

Persist subscriptions and event audit trail:

- `subscriptions(id, userId, endpoint UNIQUE, p256dh, auth, ua, createdAt, lastSeenAt)`
- `events_audit(id, type, actorId, jobId, docId, payloadJson, createdAt)`

### 4.3 Express Endpoints

```js
import express from 'express';
import bodyParser from 'body-parser';
import webpush from 'web-push';
import { upsertSub, deleteSubByEndpoint, subsByUser, auditEvent } from './db.js';

webpush.setVapidDetails(
  'mailto:dev@yourco.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const app = express();
app.use(bodyParser.json());

const auth = (req,res,next)=>{ /* your auth here */ next(); };

app.post('/api/push/subscribe', auth, async (req,res) => {
  const userId = req.user.id;
  const s = req.body;
  await upsertSub(userId, {
    endpoint: s.endpoint,
    p256dh: s.keys?.p256dh, auth: s.keys?.auth,
    ua: req.headers['user-agent']
  });
  res.sendStatus(201);
});

app.post('/api/push/unsubscribe', auth, async (req,res) => {
  const { endpoint } = req.body;
  await deleteSubByEndpoint(endpoint);
  res.sendStatus(200);
});

app.post('/api/push/test', auth, async (req,res) => {
  const subs = await subsByUser(req.user.id);
  const payload = { title:'Test', body:'Hello!', url:'/' };
  await Promise.all(subs.map(s => sendTo(s, payload)));
  res.json({ ok:true, count:subs.length });
});

async function sendTo(sub, payload) {
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        expirationTime: null,
        keys: { p256dh: sub.p256dh, auth: sub.auth }
      },
      JSON.stringify(payload),
      { TTL: 2419200 }
    );
  } catch (err) {
    if (err.statusCode === 410) await deleteSubByEndpoint(sub.endpoint);
    else console.error('push error', err.statusCode, err.body);
  }
}

export async function notifyEvent(event) {
  const payload = renderPayload(event);
  await auditEvent(event);

  for (const userId of event.recipients) {
    const subs = await subsByUser(userId);
    await Promise.all(subs.map(s => sendTo(s, payload)));
  }
}
```

### 4.4 Payload Renderer

Ensure each event type has a friendly title/body and carries actor metadata.

```js
function renderPayload(ev) {
  const a = ev.actor || { name: 'Someone' };
  const j = ev.job   || { id: '', title: '' };
  const d = ev.doc   || { id: null, name: null };
  const base = { type: ev.type, url: ev.url || `/jobs/${j.id}` };

  switch (ev.type) {
    case 'job.created':
      return {
        ...base,
        title: 'Job created',
        body: `${a.name} created “${j.title}”${j.dateHuman ? ` (${j.dateHuman})` : ''}.`,
        meta: M(ev, j, a)
      };
    case 'job.edited':
      return {
        ...base,
        title: 'Job updated',
        body: `${a.name} updated “${j.title}”.`,
        meta: M(ev, j, a)
      };
    case 'message.availability.sent':
      return {
        ...base,
        title: 'Availability sent',
        body: `${a.name} sent availability via ${ev.channel} for “${j.title}”.`,
        meta: M(ev, j, a)
      };
    case 'message.offer.sent':
      return {
        ...base,
        title: 'Offer sent',
        body: `${a.name} sent an offer via ${ev.channel} for “${j.title}”.`,
        meta: M(ev, j, a)
      };
    case 'decision.availability.accepted':
      return {
        ...base,
        title: 'Availability accepted',
        body: `${a.name} accepted availability for “${j.title}”.`,
        meta: M(ev, j, a)
      };
    case 'decision.offer.accepted':
      return {
        ...base,
        title: 'Offer accepted',
        body: `${a.name} accepted the offer for “${j.title}”.`,
        meta: M(ev, j, a)
      };
    case 'flex.folder.created':
      return {
        ...base,
        title: 'Flex folder created',
        body: `${a.name} created Flex folder for “${j.title}”.`,
        meta: M(ev, j, a)
      };
    case 'doc.uploaded':
      return {
        ...base,
        title: 'Document uploaded',
        body: `${a.name} uploaded “${d.name ?? 'a document'}” to “${j.title}”.`,
        url: ev.url || `/jobs/${j.id}/docs/${d.id ?? ''}`,
        meta: M(ev, j, a, d)
      };
    case 'doc.deleted':
      return {
        ...base,
        title: 'Document deleted',
        body: `${a.name} deleted “${d.name ?? 'a document'}” from “${j.title}”.`,
        url: ev.url || `/jobs/${j.id}/docs`,
        meta: M(ev, j, a, d)
      };
    default:
      return {
        ...base,
        title: 'Update',
        body: `${a.name} updated “${j.title}”.`,
        meta: M(ev, j, a, d)
      };
  }
}

function M(ev, job, actor, doc = {}) {
  return {
    jobId: job.id,
    actor: { id: actor.id, name: actor.name, email: actor.email },
    channel: ev.channel || null,
    scope: ev.scope || null,
    docId: doc.id || null,
    docName: doc.name || null
  };
}
```

## 5. Event Hooks

Call `notifyEvent` in the corresponding services:

- **Jobs service**: `job.created`, `job.edited`
- **Comms service**: `message.availability.sent`, `message.offer.sent`
- **RSVP service**: `decision.availability.accepted`, `decision.offer.accepted`
- **Flex integration**: `flex.folder.created`
- **Docs subsystem**: `doc.uploaded`, `doc.deleted`

Pass a normalized event payload:

```js
{
  type: '…',
  actor: { id, name, email },
  job: { id, title, dateHuman? },
  recipients: string[],
  channel?: 'email'|'whatsapp',
  scope?: 'availability'|'offer',
  url?: string,
  doc?: { id, name }
}
```

Suggested recipients:

- `job.*` → schedulers/admins + assigned techs
- `message.*.sent` → schedulers/admins (+ account owner)
- `decision.*.accepted` → schedulers/admins + job owner
- `flex.folder.created` → ops/admins
- `doc.*` → schedulers/admins + assigned techs (respect permissions)

## 6. GDPR, Consent, and Settings

- Explicit opt-in: show an explainer and request permission after a user gesture.
- Unsubscribe toggle calls `disablePush()` and removes the server record.
- Audit log: persist every event in `events_audit` for traceability.
- Minimize payload data and require auth for deep links.

## 7. Testing Checklist

1. HTTPS on staging/production; allow `http://localhost` in development.
2. Install PWA on Android Chrome and iOS/iPadOS 16.4+ (Add to Home Screen).
3. Trigger permission prompt only after user interaction.
4. Emit each event type and verify title, body, actor, and URL.
5. Confirm delivery on lock screen and in background.
6. Remove expired endpoints (HTTP 410) automatically.
7. Keep payload size small; link to longer content via `url`.

## 8. Future Enhancements

- User topic/segment preferences.
- Batched notifications (e.g., "Marcos uploaded 4 docs…").
- Localization with i18n.
- Periodic background refresh for offline caches (Android).

