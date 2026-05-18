# Phase 4 Performance Baseline

Generated: 2026-05-18T18:46:33.309Z
Git commit: `9373dd93793ce7476d2434f036d0fe06ca7c3592`

## Bundle Baseline

| Kind | Files | Raw | Gzip |
| --- | ---: | ---: | ---: |
| css | 3 | 234.1 kB | 36.1 kB |
| font | 3 | 4.43 MB | 2.60 MB |
| image | 82 | 8.46 MB | 6.99 MB |
| js | 376 | 8.73 MB | 2.65 MB |
| other | 11 | 111.9 kB | 27.9 kB |

### Largest Assets

| Asset | Kind | Raw | Gzip |
| --- | --- | ---: | ---: |
| `dist/fonts/NotoSans-Italic-VariableFont_wdth,wght.ttf` | font | 2.19 MB | 1.33 MB |
| `dist/fonts/NotoSans-VariableFont_wdth,wght.ttf` | font | 1.95 MB | 1.15 MB |
| `dist/assets/maps-lib-Ce1ARJmz.js` | js | 1.60 MB | 452.4 kB |
| `dist/assets/pdf-libs-CmwCtmNR.js` | js | 925.9 kB | 338.4 kB |
| `dist/assets/spreadsheet-libs-C15GPh2f.js` | js | 917.2 kB | 264.6 kB |
| `dist/stamps/sector-pro-stamp.png` | image | 708.9 kB | 706.5 kB |
| `dist/lovable-uploads/IMG_7835.jpeg` | image | 699.6 kB | 672.6 kB |
| `dist/assets/index-BgSU4hlO.js` | js | 619.8 kB | 185.7 kB |
| `dist/lovable-uploads/IMG_7834.jpeg` | image | 517.6 kB | 489.3 kB |
| `dist/lovable-uploads/IMG_7836.jpeg` | image | 426.6 kB | 388.2 kB |
| `dist/lovable-uploads/assignmentMatrix.jpg` | image | 406.8 kB | 236.5 kB |
| `dist/8067C0A4-0C71-4CDF-952B-0E699DA25A74.png` | image | 307.7 kB | 297.6 kB |
| `dist/og-image.png` | image | 307.7 kB | 297.6 kB |
| `dist/lovable-uploads/festivalManagement3.jpg` | image | 292.0 kB | 221.7 kB |
| `dist/fonts/NotoEmoji-Regular.ttf` | font | 289.6 kB | 119.7 kB |

### Large JS Chunks

| Asset | Raw | Gzip |
| --- | ---: | ---: |
| `dist/assets/maps-lib-Ce1ARJmz.js` | 1.60 MB | 452.4 kB |
| `dist/assets/pdf-libs-CmwCtmNR.js` | 925.9 kB | 338.4 kB |
| `dist/assets/spreadsheet-libs-C15GPh2f.js` | 917.2 kB | 264.6 kB |
| `dist/assets/index-BgSU4hlO.js` | 619.8 kB | 185.7 kB |

## Route Timing Baseline

| Route | Viewport | Visible ready | FCP | Network idle | JS encoded | CSS encoded |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| `/dashboard` | 390x664 | 181 ms | 80 ms | >5004 ms | 307.4 kB | 27.1 kB |
| `/auth` | 1280x720 | 69 ms | 44 ms | 556 ms | 214.9 kB | 27.1 kB |
| `/job-assignment-matrix` | 390x664 | 222 ms | 44 ms | >5001 ms | 381.1 kB | 27.1 kB |
| `/dashboard` | 1280x720 | 229 ms | 40 ms | >5001 ms | 984.6 kB | 27.1 kB |
| `/project-management` | 1280x720 | 224 ms | 44 ms | >5001 ms | 945.6 kB | 27.1 kB |
| `/job-assignment-matrix` | 1280x720 | 226 ms | 40 ms | >5000 ms | 381.1 kB | 27.1 kB |
| `/tech-app` | 390x664 | 252 ms | 44 ms | 654 ms | 797.6 kB | 27.1 kB |
| `/festival/artist-form/blank?jobId=festival-job-1&date=2026-07-10&lang=en` | 390x664 | 120 ms | 44 ms | 609 ms | 245.0 kB | 27.1 kB |
| `/wallboard/public/perf-token/default` | 390x664 | 8899 ms | 40 ms | 8899 ms | 214.4 kB | 27.1 kB |

## React Profiler Baseline

Captured from a local Vite dev server with `VITE_REACT_PROFILER_BASELINE=true`; production React disables `Profiler` callback timing.

| Route | Viewport | Samples | Total actual | Max actual | P95 actual |
| --- | --- | ---: | ---: | ---: | ---: |
| `/dashboard` | 390x664 | 39 | 36.1 ms | 8.4 ms | 6.1 ms |
| `/auth` | 1280x720 | 8 | 11.3 ms | 8.4 ms | 8.4 ms |
| `/job-assignment-matrix` | 390x664 | 184 | 212.3 ms | 11 ms | 5.3 ms |
| `/dashboard` | 1280x720 | 45 | 47.4 ms | 8.5 ms | 6.5 ms |
| `/project-management` | 1280x720 | 65 | 72.3 ms | 11.6 ms | 6.7 ms |
| `/job-assignment-matrix` | 1280x720 | 183 | 253.3 ms | 12.5 ms | 5.9 ms |
| `/tech-app` | 390x664 | 18 | 19.9 ms | 8.5 ms | 8.5 ms |
| `/festival/artist-form/blank?jobId=festival-job-1&date=2026-07-10&lang=en` | 390x664 | 20 | 46.8 ms | 13.1 ms | 7.9 ms |
| `/wallboard/public/perf-token/default` | 390x664 | 20 | 15.1 ms | 8.5 ms | 1.4 ms |

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
