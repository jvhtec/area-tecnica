# Phase 4 Performance Baseline

Generated: 2026-06-04T06:12:23.699Z
Git commit: `ad13956cfc2fd353d1152599b54402fb5c2404e0`

## Bundle Baseline

| Kind | Files | Raw | Gzip |
| --- | ---: | ---: | ---: |
| css | 3 | 237.3 kB | 36.5 kB |
| font | 3 | 4.43 MB | 2.57 MB |
| image | 82 | 8.46 MB | 6.98 MB |
| js | 412 | 9.03 MB | 2.74 MB |
| other | 11 | 111.9 kB | 27.9 kB |

### Largest Assets

| Asset | Kind | Raw | Gzip |
| --- | --- | ---: | ---: |
| `dist/fonts/NotoSans-Italic-VariableFont_wdth,wght.ttf` | font | 2.19 MB | 1.32 MB |
| `dist/fonts/NotoSans-VariableFont_wdth,wght.ttf` | font | 1.95 MB | 1.14 MB |
| `dist/assets/maps-lib-DdH6LNk6.js` | js | 1.72 MB | 484.2 kB |
| `dist/assets/pdf-libs-BvqGlGrx.js` | js | 926.6 kB | 337.1 kB |
| `dist/assets/spreadsheet-libs-C15GPh2f.js` | js | 917.2 kB | 263.3 kB |
| `dist/stamps/sector-pro-stamp.png` | image | 708.9 kB | 706.1 kB |
| `dist/lovable-uploads/IMG_7835.jpeg` | image | 699.6 kB | 672.7 kB |
| `dist/assets/index-CN6BNoGK.js` | js | 549.6 kB | 160.1 kB |
| `dist/lovable-uploads/IMG_7834.jpeg` | image | 517.6 kB | 489.3 kB |
| `dist/lovable-uploads/IMG_7836.jpeg` | image | 426.6 kB | 388.0 kB |
| `dist/lovable-uploads/assignmentMatrix.jpg` | image | 406.8 kB | 236.4 kB |
| `dist/8067C0A4-0C71-4CDF-952B-0E699DA25A74.png` | image | 307.7 kB | 294.3 kB |
| `dist/og-image.png` | image | 307.7 kB | 294.3 kB |
| `dist/lovable-uploads/festivalManagement3.jpg` | image | 292.0 kB | 221.6 kB |
| `dist/fonts/NotoEmoji-Regular.ttf` | font | 289.6 kB | 120.3 kB |

### Large JS Chunks

| Asset | Raw | Gzip |
| --- | ---: | ---: |
| `dist/assets/maps-lib-DdH6LNk6.js` | 1.72 MB | 484.2 kB |
| `dist/assets/pdf-libs-BvqGlGrx.js` | 926.6 kB | 337.1 kB |
| `dist/assets/spreadsheet-libs-C15GPh2f.js` | 917.2 kB | 263.3 kB |
| `dist/assets/index-CN6BNoGK.js` | 549.6 kB | 160.1 kB |

## Route Timing Baseline

| Route | Viewport | Visible ready | FCP | Network idle | JS encoded | CSS encoded |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| `/dashboard` | 390x664 | 262 ms | 72 ms | >5003 ms | 332.6 kB | 27.3 kB |
| `/auth` | 1280x720 | 62 ms | 32 ms | 560 ms | 212.5 kB | 27.3 kB |
| `/job-assignment-matrix` | 390x664 | 212 ms | 32 ms | >5003 ms | 408.2 kB | 27.3 kB |
| `/dashboard` | 1280x720 | 234 ms | 32 ms | >5003 ms | 677.8 kB | 27.3 kB |
| `/project-management` | 1280x720 | 219 ms | 40 ms | >5002 ms | 995.8 kB | 27.3 kB |
| `/job-assignment-matrix` | 1280x720 | 214 ms | 36 ms | >5002 ms | 408.2 kB | 27.3 kB |
| `/tech-app` | 390x664 | 214 ms | 32 ms | 671 ms | 823.3 kB | 27.3 kB |
| `/festival/artist-form/blank?jobId=festival-job-1&date=2026-07-10&lang=en` | 390x664 | 114 ms | 36 ms | 600 ms | 241.5 kB | 27.3 kB |
| `/wallboard/public/perf-token/default` | 390x664 | 8898 ms | 36 ms | 8898 ms | 206.8 kB | 27.3 kB |

## React Profiler Baseline

Captured from a local Vite dev server with `VITE_REACT_PROFILER_BASELINE=true`; production React disables `Profiler` callback timing.

| Route | Viewport | Samples | Total actual | Max actual | P95 actual |
| --- | --- | ---: | ---: | ---: | ---: |
| `/dashboard` | 390x664 | 41 | 36.4 ms | 5.9 ms | 3.3 ms |
| `/auth` | 1280x720 | 10 | 10.5 ms | 5.6 ms | 5.6 ms |
| `/job-assignment-matrix` | 390x664 | 185 | 197 ms | 8.2 ms | 5 ms |
| `/dashboard` | 1280x720 | 45 | 47.9 ms | 7.9 ms | 5.5 ms |
| `/project-management` | 1280x720 | 60 | 65.1 ms | 11 ms | 5.5 ms |
| `/job-assignment-matrix` | 1280x720 | 183 | 245.3 ms | 10 ms | 5.6 ms |
| `/tech-app` | 390x664 | 19 | 18 ms | 5.3 ms | 5.3 ms |
| `/festival/artist-form/blank?jobId=festival-job-1&date=2026-07-10&lang=en` | 390x664 | 21 | 44.3 ms | 12.7 ms | 7.5 ms |
| `/wallboard/public/perf-token/default` | 390x664 | 22 | 14.2 ms | 5.6 ms | 2.6 ms |

## Mobile Workflow Screenshots

| Route | Viewport | Screenshot |
| --- | --- | --- |
| `/dashboard` | 390x664 | [dashboard-mobile.png](screenshots/dashboard-mobile.png) |
| `/job-assignment-matrix` | 390x664 | [assignment-matrix-mobile.png](screenshots/assignment-matrix-mobile.png) |
| `/tech-app` | 390x664 | [technician-app-mobile.png](screenshots/technician-app-mobile.png) |
| `/festival/artist-form/blank?jobId=festival-job-1&date=2026-07-10&lang=en` | 390x664 | [public-artist-form-mobile.png](screenshots/public-artist-form-mobile.png) |
| `/wallboard/public/perf-token/default` | 390x664 | [wallboard-public-mobile.png](screenshots/wallboard-public-mobile.png) |

## Lighthouse

| Run | Performance | Accessibility | Best practices | SEO | FCP | LCP | TBT | CLS | Artifact |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Auth desktop | 99 | 100 | 96 | 92 | 0.6 s | 0.9 s | 0 ms | 0 | [JSON](lighthouse-auth-desktop.json) |
| Auth mobile | 82 | 100 | 96 | 92 | 2.9 s | 4.1 s | 0 ms | 0 | [JSON](lighthouse-auth-mobile.json) |

Re-run commands:

```sh
npx lighthouse http://127.0.0.1:4174/auth --preset=desktop --chrome-flags="--headless=new --no-sandbox" --output=json --output-path=docs/performance/phase-4-baseline/lighthouse-auth-desktop.json
npx lighthouse http://127.0.0.1:4174/auth --chrome-flags="--headless=new --no-sandbox" --output=json --output-path=docs/performance/phase-4-baseline/lighthouse-auth-mobile.json
```
