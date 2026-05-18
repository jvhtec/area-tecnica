#!/usr/bin/env node

import { gzipSync } from "node:zlib";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join, relative } from "node:path";
import { chromium, devices } from "@playwright/test";

const repoRoot = process.cwd();
const outputDir = join(repoRoot, "docs", "performance", "phase-4-baseline");
const screenshotDir = join(outputDir, "screenshots");
const distDir = join(repoRoot, "dist");
const previewPort = Number(process.env.PERF_BASELINE_PORT ?? 4174);
const previewUrl = `http://127.0.0.1:${previewPort}`;
const profilerPort = Number(process.env.PERF_PROFILER_PORT ?? 4175);
const profilerUrl = `http://127.0.0.1:${profilerPort}`;
const generatedAt = new Date().toISOString();

const authDefaults = {
  userId: "perf-user",
  email: "perf@example.com",
  role: "management",
  department: "sound",
  assignableAsTech: false,
  soundVisionAccess: false,
};

const routes = [
  {
    id: "dashboard-mobile",
    path: "/dashboard",
    auth: { role: "management", department: "sound" },
    tables: {
      profiles: [{ role: "management", department: "sound", selected_job_statuses: ["Confirmado", "Tentativa"] }],
      jobs: [],
      job_assignments: [],
      technician_availability: [],
      tours: [],
    },
    waitForText: /dashboard|panel|agenda|trabajos/i,
    viewport: devices["iPhone 13"].viewport,
    userAgent: devices["iPhone 13"].userAgent,
    isMobile: true,
    hasTouch: true,
    screenshot: true,
  },
  {
    id: "auth",
    path: "/auth",
    auth: { guest: true },
    waitForText: /sector pro|sign in|login|acceder|email/i,
    viewport: devices["Desktop Chrome"].viewport,
  },
  {
    id: "assignment-matrix-mobile",
    path: "/job-assignment-matrix",
    auth: { role: "management", department: "sound" },
    tables: {
      jobs: [
        {
          id: "perf-matrix-job-1",
          title: "Matrix Baseline Job",
          start_time: "2026-03-10T08:00:00.000Z",
          end_time: "2026-03-10T20:00:00.000Z",
          color: "#1d4ed8",
          status: "Confirmado",
          job_type: "single",
          job_departments: [{ department: "sound" }],
          job_assignments: [],
        },
      ],
      technician_fridge: [],
      availability_schedules: [],
      technician_availability: [],
      vacation_requests: [],
      timesheets: [],
      job_assignments: [],
      profiles: [],
      skills: [],
      job_required_roles_summary: [],
    },
    rpc: {
      get_profiles_with_skills: [
        {
          id: "tech-1",
          first_name: "Pat",
          last_name: "Jones",
          email: "pat@example.com",
          department: "sound",
          role: "technician",
          skills: [],
        },
      ],
      get_job_staffing_summary: [],
      get_active_timesheet_counts_by_technician: [],
      get_assignment_matrix_staffing: [],
      get_assignment_matrix_staffing_filtered: [],
      get_staffing_requests_matrix_filtered: [],
    },
    waitForText: /matriz de asignación|matrix/i,
    viewport: devices["iPhone 13"].viewport,
    userAgent: devices["iPhone 13"].userAgent,
    isMobile: true,
    hasTouch: true,
    screenshot: true,
  },
  {
    id: "dashboard",
    path: "/dashboard",
    auth: { role: "management", department: "sound" },
    tables: {
      profiles: [{ role: "management", department: "sound", selected_job_statuses: ["Confirmado", "Tentativa"] }],
      jobs: [],
      job_assignments: [],
      technician_availability: [],
      tours: [],
    },
    waitForText: /dashboard|panel|agenda|trabajos/i,
    viewport: devices["Desktop Chrome"].viewport,
  },
  {
    id: "project-management",
    path: "/project-management",
    auth: { role: "management", department: "sound" },
    tables: {
      profiles: [{ role: "management", department: "sound", selected_job_statuses: ["Confirmado", "Tentativa"] }],
      jobs: [
        {
          id: "perf-job-1",
          title: "Performance Baseline Job",
          start_time: "2026-03-10T09:00:00.000Z",
          end_time: "2026-03-10T18:00:00.000Z",
          status: "Confirmado",
          job_type: "single",
          location: { id: "loc-1", name: "Madrid Arena", formatted_address: "Madrid Arena" },
          job_departments: [{ department: "sound" }],
          job_assignments: [],
          job_documents: [],
          flex_folders: [],
          tour_id: null,
        },
      ],
      tours: [],
    },
    waitForText: /project management|performance baseline job/i,
    viewport: devices["Desktop Chrome"].viewport,
  },
  {
    id: "assignment-matrix",
    path: "/job-assignment-matrix",
    auth: { role: "management", department: "sound" },
    tables: {
      jobs: [
        {
          id: "perf-matrix-job-1",
          title: "Matrix Baseline Job",
          start_time: "2026-03-10T08:00:00.000Z",
          end_time: "2026-03-10T20:00:00.000Z",
          color: "#1d4ed8",
          status: "Confirmado",
          job_type: "single",
          job_departments: [{ department: "sound" }],
          job_assignments: [],
        },
      ],
      technician_fridge: [],
      availability_schedules: [],
      technician_availability: [],
      vacation_requests: [],
      timesheets: [],
      job_assignments: [],
      profiles: [],
      skills: [],
      job_required_roles_summary: [],
    },
    rpc: {
      get_profiles_with_skills: [
        {
          id: "tech-1",
          first_name: "Pat",
          last_name: "Jones",
          email: "pat@example.com",
          department: "sound",
          role: "technician",
          skills: [],
        },
      ],
      get_job_staffing_summary: [],
      get_active_timesheet_counts_by_technician: [],
      get_assignment_matrix_staffing: [],
      get_assignment_matrix_staffing_filtered: [],
      get_staffing_requests_matrix_filtered: [],
    },
    waitForText: /matriz de asignación|matrix/i,
    viewport: devices["Desktop Chrome"].viewport,
  },
  {
    id: "technician-app-mobile",
    path: "/tech-app",
    auth: { userId: "tech-1", email: "tech@example.com", role: "technician", department: "sound" },
    tables: {
      profiles: [
        {
          id: "tech-1",
          first_name: "Pat",
          last_name: "Jones",
          role: "technician",
          department: "sound",
          soundvision_access_enabled: false,
          assignable_as_tech: false,
        },
      ],
      job_assignments: [],
      timesheets: [],
      technician_availability: [],
      festival_artists: [],
      tours: [],
    },
    waitForText: /panel|disponib/i,
    viewport: devices["iPhone 13"].viewport,
    userAgent: devices["iPhone 13"].userAgent,
    isMobile: true,
    hasTouch: true,
    screenshot: true,
  },
  {
    id: "public-artist-form-mobile",
    path: "/festival/artist-form/blank?jobId=festival-job-1&date=2026-07-10&lang=en",
    auth: { guest: true },
    tables: {
      festival_gear_setups: [{ job_id: "festival-job-1", max_stages: 2 }],
      festival_logos: [],
      festival_stages: [
        { job_id: "festival-job-1", number: 1, name: "Main" },
        { job_id: "festival-job-1", number: 2, name: "Club" },
      ],
    },
    waitForText: /artist technical requirements form|basic info/i,
    viewport: devices["iPhone 13"].viewport,
    userAgent: devices["iPhone 13"].userAgent,
    isMobile: true,
    hasTouch: true,
    screenshot: true,
  },
  {
    id: "wallboard-public-mobile",
    path: "/wallboard/public/perf-token/default",
    auth: { guest: true },
    functions: {
      "wallboard-auth": { token: "perf-wallboard-jwt", expiresIn: 3600, preset: "default" },
      "wallboard-feed": ({ body }) => {
        const path = body?.path ?? "/jobs-overview";
        const job = {
          id: "wallboard-job-1",
          title: "Performance Baseline Wallboard",
          start_time: "2026-07-10T10:00:00.000Z",
          end_time: "2026-07-10T18:00:00.000Z",
          location: { name: "Madrid Arena" },
          departments: ["sound"],
          crewAssigned: { sound: 1, lights: 0, video: 0 },
          crewNeeded: { sound: 2, lights: 0, video: 0 },
          docs: { sound: { have: 1, need: 2 } },
          status: "yellow",
          color: "#1d4ed8",
          job_type: "single",
        };

        if (path === "/preset-config") {
          return {
            slug: "default",
            config: {
              panel_order: ["overview"],
              panel_durations: { overview: 30 },
              rotation_fallback_seconds: 30,
              highlight_ttl_seconds: 15,
              ticker_poll_interval_seconds: 30,
            },
          };
        }

        if (path === "/crew-assignments") {
          return {
            jobs: [
              {
                id: job.id,
                title: job.title,
                job_type: job.job_type,
                start_time: job.start_time,
                end_time: job.end_time,
                color: job.color,
                crew: [{ name: "Pat Jones", role: "A1", dept: "sound", timesheetStatus: "draft" }],
              },
            ],
          };
        }

        if (path === "/doc-progress") {
          return {
            jobs: [
              {
                id: job.id,
                title: job.title,
                color: job.color,
                job_type: job.job_type,
                start_time: job.start_time,
                end_time: job.end_time,
                departments: [{ dept: "sound", have: 1, need: 2, missing: ["Rider"] }],
              },
            ],
          };
        }

        if (path === "/pending-actions") return { items: [{ severity: "yellow", text: "Confirm A2" }] };
        if (path === "/announcements") return { announcements: [] };
        if (path === "/logistics") return { items: [] };
        return { jobs: [job] };
      },
    },
    waitForText: /performance baseline wallboard/i,
    viewport: devices["iPhone 13"].viewport,
    userAgent: devices["iPhone 13"].userAgent,
    isMobile: true,
    hasTouch: true,
    screenshot: true,
  },
];

/** Runs a repository command with the mock Supabase baseline environment. */
function run(command, args, options = {}) {
  execFileSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      VITE_REACT_PROFILER_BASELINE: "false",
      VITE_SUPABASE_URL: `${previewUrl}/supabase`,
      VITE_SUPABASE_ANON_KEY: "perf-anon-key",
      VITE_SUPABASE_PUBLISHABLE_KEY: "perf-anon-key",
      VITE_SUPABASE_FUNCTIONS_URL: `${previewUrl}/supabase/functions/v1`,
      ...options.env,
    },
  });
}

/** Starts a production preview server for route and Lighthouse measurements. */
function startPreview() {
  const child = spawn(
    "npx",
    ["vite", "preview", "--host", "127.0.0.1", "--port", String(previewPort)],
    {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        VITE_SUPABASE_URL: `${previewUrl}/supabase`,
        VITE_SUPABASE_ANON_KEY: "perf-anon-key",
        VITE_SUPABASE_PUBLISHABLE_KEY: "perf-anon-key",
        VITE_SUPABASE_FUNCTIONS_URL: `${previewUrl}/supabase/functions/v1`,
      },
    },
  );

  child.stdout.on("data", (data) => process.stdout.write(`[preview] ${data}`));
  child.stderr.on("data", (data) => process.stderr.write(`[preview] ${data}`));

  return child;
}

/** Starts a Vite dev server with React Profiler instrumentation enabled. */
function startProfilerServer() {
  const child = spawn(
    "npx",
    ["vite", "--host", "127.0.0.1", "--port", String(profilerPort)],
    {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        VITE_REACT_PROFILER_BASELINE: "true",
        VITE_SUPABASE_URL: `${profilerUrl}/supabase`,
        VITE_SUPABASE_ANON_KEY: "perf-anon-key",
        VITE_SUPABASE_PUBLISHABLE_KEY: "perf-anon-key",
        VITE_SUPABASE_FUNCTIONS_URL: `${profilerUrl}/supabase/functions/v1`,
      },
    },
  );

  child.stdout.on("data", (data) => process.stdout.write(`[profiler] ${data}`));
  child.stderr.on("data", (data) => process.stderr.write(`[profiler] ${data}`));

  return child;
}

/** Waits until a local server responds before browser measurements begin. */
async function waitForServer(url) {
  const deadline = Date.now() + 60_000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Retry until the Vite server is ready.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for ${url}`);
}

/** Returns all files under a directory for bundle inventory collection. */
function walkFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walkFiles(path) : [path];
  });
}

/** Classifies a built asset into the reporting buckets used by the baseline. */
function assetKind(file) {
  const ext = extname(file).toLowerCase();
  if (ext === ".js") return "js";
  if (ext === ".css") return "css";
  if ([".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif", ".svg", ".ico"].includes(ext)) return "image";
  if ([".woff", ".woff2", ".ttf", ".otf"].includes(ext)) return "font";
  return "other";
}

/** Computes raw and gzip bundle metrics from the current production build. */
function collectBundleMetrics() {
  const files = walkFiles(distDir).map((file) => {
    const content = readFileSync(file);
    const sizeBytes = statSync(file).size;
    return {
      path: relative(repoRoot, file),
      file: basename(file),
      kind: assetKind(file),
      sizeBytes,
      gzipBytes: gzipSync(content).length,
    };
  });

  const totalsByKind = files.reduce((totals, file) => {
    const current = totals[file.kind] ?? { files: 0, sizeBytes: 0, gzipBytes: 0 };
    current.files += 1;
    current.sizeBytes += file.sizeBytes;
    current.gzipBytes += file.gzipBytes;
    totals[file.kind] = current;
    return totals;
  }, {});

  const indexHtml = readFileSync(join(distDir, "index.html"), "utf8");
  const entryScripts = Array.from(indexHtml.matchAll(/<script[^>]+src="([^"]+\.js)"/g)).map((match) => match[1]);
  const entryStyles = Array.from(indexHtml.matchAll(/<link[^>]+href="([^"]+\.css)"/g)).map((match) => match[1]);

  return {
    totalFiles: files.length,
    totalsByKind,
    entryScripts,
    entryStyles,
    largestAssets: [...files].sort((a, b) => b.sizeBytes - a.sizeBytes).slice(0, 30),
    largeJsAssets: files.filter((file) => file.kind === "js" && file.sizeBytes >= 500_000)
      .sort((a, b) => b.sizeBytes - a.sizeBytes),
  };
}

/** Builds a Supabase-compatible mocked user payload for authenticated routes. */
function buildUser(auth) {
  return {
    id: auth.userId,
    aud: "authenticated",
    role: "authenticated",
    email: auth.email,
    email_confirmed_at: new Date().toISOString(),
    confirmed_at: new Date().toISOString(),
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {
      role: auth.role,
      department: auth.department,
      assignable_as_tech: auth.assignableAsTech,
      soundvision_access_enabled: auth.soundVisionAccess,
    },
    identities: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/** Builds a Supabase-compatible mocked session payload for auth refresh flows. */
function buildSession(auth) {
  const expiresIn = 60 * 60;
  return {
    access_token: "perf-access-token",
    refresh_token: "perf-refresh-token",
    token_type: "bearer",
    expires_in: expiresIn,
    expires_at: Math.floor(Date.now() / 1000) + expiresIn,
    user: buildUser(auth),
  };
}

/** Seeds browser storage and platform stubs before a route measurement starts. */
async function seedAppState(context, authOverrides = {}) {
  await context.addInitScript((auth) => {
    window.localStorage.clear();
    window.sessionStorage.clear();

    const registrationStub = {
      waiting: null,
      installing: null,
      active: null,
      update: async () => undefined,
      unregister: async () => true,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    };

    try {
      Object.defineProperty(navigator, "serviceWorker", {
        configurable: true,
        value: {
          ready: Promise.resolve(registrationStub),
          controller: null,
          getRegistration: async () => registrationStub,
          getRegistrations: async () => [registrationStub],
          register: async () => registrationStub,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
        },
      });
    } catch {
      // Ignore when the browser disallows replacement.
    }

    try {
      Object.defineProperty(window, "Notification", {
        configurable: true,
        value: {
          permission: "denied",
          requestPermission: async () => "denied",
        },
      });
    } catch {
      // Ignore when the browser disallows replacement.
    }

    window.open = () => null;

    if (auth.guest) {
      return;
    }

    const expiresIn = 60 * 60;
    const user = {
      id: auth.userId,
      aud: "authenticated",
      role: "authenticated",
      email: auth.email,
      email_confirmed_at: new Date().toISOString(),
      confirmed_at: new Date().toISOString(),
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: {
        role: auth.role,
        department: auth.department,
        assignable_as_tech: auth.assignableAsTech,
        soundvision_access_enabled: auth.soundVisionAccess,
      },
      identities: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const session = {
      access_token: "perf-access-token",
      refresh_token: "perf-refresh-token",
      token_type: "bearer",
      expires_in: expiresIn,
      expires_at: Math.floor(Date.now() / 1000) + expiresIn,
      user,
    };

    window.localStorage.setItem("supabase.auth.token", JSON.stringify(session));
    window.localStorage.setItem("supabase_user_profile", JSON.stringify({
      role: auth.role,
      department: auth.department,
      soundVisionAccess: auth.soundVisionAccess,
      assignableAsTech: auth.assignableAsTech,
      userId: auth.userId,
      timestamp: Date.now(),
    }));
  }, { ...authDefaults, ...authOverrides });
}

/** Reads a Playwright request body as JSON when possible and raw text otherwise. */
async function readRequestBody(request) {
  const payload = request.postData();
  if (!payload) return null;

  try {
    return request.postDataJSON();
  } catch {
    return payload;
  }
}

/** Detects PostgREST single-object response requests from Accept headers. */
function wantsObjectResponse(request) {
  return (request.headers().accept ?? "").includes("application/vnd.pgrst.object+json");
}

/** Shapes mocked PostgREST responses to match list or object response modes. */
function normalizePostgrestPayload(data, request) {
  if (!wantsObjectResponse(request)) return data;
  return Array.isArray(data) ? data[0] ?? null : data;
}

/** Resolves static or function-based mock responders for Supabase routes. */
async function resolveResponder(responder, fallbackValue, context) {
  if (typeof responder === "function") return await responder(context);
  return responder ?? fallbackValue;
}

/** Installs deterministic Supabase REST, auth, function, and storage mocks. */
async function installSupabaseMocks(context, options) {
  const auth = { ...authDefaults, ...options.auth };
  const tables = options.tables ?? {};
  const rpc = options.rpc ?? {};
  const functions = options.functions ?? {};

  await context.route(/\/supabase\/(?:rest\/v1|auth\/v1|functions\/v1|storage\/v1)\//, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const body = await readRequestBody(request);
    const mockContext = { body, method, request, url };

    if (url.pathname.includes("/auth/v1/user")) {
      return route.fulfill({
        status: options.auth?.guest ? 401 : 200,
        contentType: "application/json",
        body: JSON.stringify(options.auth?.guest ? { message: "Auth session missing" } : buildUser(auth)),
      });
    }

    if (url.pathname.includes("/auth/v1/logout")) {
      return route.fulfill({ status: 204, body: "" });
    }

    if (url.pathname.includes("/auth/v1/token") || url.pathname.includes("/auth/v1/session")) {
      return route.fulfill({
        status: options.auth?.guest ? 401 : 200,
        contentType: "application/json",
        body: JSON.stringify(options.auth?.guest ? { message: "Auth session missing" } : {
          session: buildSession(auth),
          user: buildUser(auth),
        }),
      });
    }

    if (url.pathname.includes("/rest/v1/rpc/")) {
      const name = url.pathname.split("/rest/v1/rpc/")[1] ?? "";
      const data = await resolveResponder(rpc[name], [], mockContext);
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
    }

    if (url.pathname.includes("/functions/v1/")) {
      const functionPath = url.pathname.split("/functions/v1/")[1] ?? "";
      const name = functionPath.split("/")[0] ?? functionPath;
      const data = await resolveResponder(functions[functionPath] ?? functions[name], {}, mockContext);
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
    }

    if (url.pathname.includes("/storage/v1/object/sign/")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ signedURL: "/signed/perf-file.pdf" }),
      });
    }

    if (url.pathname.includes("/storage/v1/object/")) {
      return route.fulfill({
        status: 200,
        contentType: method === "GET" ? "application/octet-stream" : "application/json",
        body: method === "GET" ? "mock-file" : JSON.stringify({}),
      });
    }

    if (url.pathname.includes("/rest/v1/")) {
      const table = url.pathname.split("/rest/v1/")[1] ?? "";
      const fallbackValue = method === "GET" || method === "HEAD" ? [] : null;
      const data = await resolveResponder(tables[table], fallbackValue, mockContext);

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(normalizePostgrestPayload(data, request)),
      });
    }

    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) });
  });
}

/** Calculates a percentile from numeric samples for profiler summaries. */
function percentile(values, percent) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((percent / 100) * sorted.length) - 1);
  return sorted[index];
}

/** Summarizes React Profiler samples into stable metrics for the baseline. */
function summarizeProfiler(samples) {
  const durations = samples.map((sample) => sample.actualDuration);
  return {
    samples: samples.length,
    totalActualDurationMs: Number(durations.reduce((sum, value) => sum + value, 0).toFixed(2)),
    maxActualDurationMs: Number((durations.length ? Math.max(...durations) : 0).toFixed(2)),
    p95ActualDurationMs: Number(percentile(durations, 95).toFixed(2)),
  };
}

/** Measures one configured route and optionally captures its mobile screenshot. */
async function measureRoute(browser, routeConfig, baseUrl = previewUrl) {
  const context = await browser.newContext({
    viewport: routeConfig.viewport,
    userAgent: routeConfig.userAgent,
    isMobile: routeConfig.isMobile,
    hasTouch: routeConfig.hasTouch,
  });

  await seedAppState(context, routeConfig.auth);
  await installSupabaseMocks(context, routeConfig);

  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  const startedAt = Date.now();
  await page.goto(`${baseUrl}${routeConfig.path}`, { waitUntil: "domcontentloaded" });
  await page.getByText(routeConfig.waitForText).first().waitFor({ state: "visible", timeout: 20_000 });
  const visibleReadyMs = Date.now() - startedAt;
  const networkIdleStartedAt = Date.now();
  const reachedNetworkIdle = await page.waitForLoadState("networkidle", { timeout: 5_000 })
    .then(() => true)
    .catch(() => false);
  const networkIdleWaitMs = Date.now() - networkIdleStartedAt;
  const totalMeasuredMs = Date.now() - startedAt;

  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType("navigation")[0];
    const paints = Object.fromEntries(
      performance.getEntriesByType("paint").map((entry) => [entry.name, entry.startTime]),
    );
    const resources = performance.getEntriesByType("resource");
    const jsResources = resources.filter((entry) => entry.name.includes("/assets/") && entry.name.endsWith(".js"));
    const cssResources = resources.filter((entry) => entry.name.includes("/assets/") && entry.name.endsWith(".css"));
    const imageResources = resources.filter((entry) => /\.(png|jpe?g|webp|avif|svg)(\?|$)/i.test(entry.name));

    const sumEncoded = (entries) =>
      entries.reduce((sum, entry) => sum + (entry.encodedBodySize || entry.transferSize || 0), 0);

    return {
      navigation: navigation
        ? {
            domContentLoadedMs: navigation.domContentLoadedEventEnd,
            loadEventEndMs: navigation.loadEventEnd,
            responseEndMs: navigation.responseEnd,
          }
        : null,
      paints,
      resourceCounts: {
        total: resources.length,
        js: jsResources.length,
        css: cssResources.length,
        images: imageResources.length,
      },
      encodedBodyBytes: {
        js: sumEncoded(jsResources),
        css: sumEncoded(cssResources),
        images: sumEncoded(imageResources),
      },
      profiler: window.__sectorProReactProfiler?.samples ?? [],
    };
  });

  const screenshotPath = routeConfig.screenshot
    ? join(screenshotDir, `${routeConfig.id}.png`)
    : null;

  if (screenshotPath) {
    await page.screenshot({ path: screenshotPath, fullPage: true, animations: "disabled" });
  }

  await context.close();

  return {
    id: routeConfig.id,
    path: routeConfig.path,
    viewport: routeConfig.viewport,
    visibleReadyMs,
    reachedNetworkIdle,
    networkIdleWaitMs,
    totalMeasuredMs,
    navigation: metrics.navigation,
    paints: metrics.paints,
    resourceCounts: metrics.resourceCounts,
    encodedBodyBytes: metrics.encodedBodyBytes,
    profiler: summarizeProfiler(metrics.profiler),
    pageErrors: errors,
    screenshot: screenshotPath ? relative(repoRoot, screenshotPath) : null,
  };
}

/** Formats byte counts for the generated Markdown report. */
function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${bytes} B`;
}

/** Extracts headline Lighthouse scores from committed JSON artifacts. */
function collectLighthouseSummaries() {
  return [
    ["Auth desktop", "lighthouse-auth-desktop.json"],
    ["Auth mobile", "lighthouse-auth-mobile.json"],
  ].flatMap(([label, file]) => {
    const path = join(outputDir, file);
    if (!existsSync(path)) return [];

    const report = JSON.parse(readFileSync(path, "utf8"));
    const score = (category) => Math.round((report.categories?.[category]?.score ?? 0) * 100);

    return [{
      label,
      file: relative(repoRoot, path),
      performance: score("performance"),
      accessibility: score("accessibility"),
      bestPractices: score("best-practices"),
      seo: score("seo"),
      fcp: report.audits?.["first-contentful-paint"]?.displayValue ?? "n/a",
      lcp: report.audits?.["largest-contentful-paint"]?.displayValue ?? "n/a",
      tbt: report.audits?.["total-blocking-time"]?.displayValue ?? "n/a",
      cls: report.audits?.["cumulative-layout-shift"]?.displayValue ?? "n/a",
    }];
  });
}

/** Writes the human-readable Phase 4 baseline report. */
function writeMarkdown(results) {
  const screenshotRoutes = results.routes.filter((route) => route.screenshot);
  const lighthouseRows = collectLighthouseSummaries();

  const lines = [
    "# Phase 4 Performance Baseline",
    "",
    `Generated: ${results.generatedAt}`,
    `Git commit: \`${results.gitCommit}\``,
    "",
    "## Bundle Baseline",
    "",
    "| Kind | Files | Raw | Gzip |",
    "| --- | ---: | ---: | ---: |",
    ...Object.entries(results.bundle.totalsByKind)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([kind, total]) => `| ${kind} | ${total.files} | ${formatBytes(total.sizeBytes)} | ${formatBytes(total.gzipBytes)} |`),
    "",
    "### Largest Assets",
    "",
    "| Asset | Kind | Raw | Gzip |",
    "| --- | --- | ---: | ---: |",
    ...results.bundle.largestAssets
      .slice(0, 15)
      .map((asset) => `| \`${asset.path}\` | ${asset.kind} | ${formatBytes(asset.sizeBytes)} | ${formatBytes(asset.gzipBytes)} |`),
    "",
    "### Large JS Chunks",
    "",
    results.bundle.largeJsAssets.length
      ? "| Asset | Raw | Gzip |\n| --- | ---: | ---: |\n" +
        results.bundle.largeJsAssets
          .map((asset) => `| \`${asset.path}\` | ${formatBytes(asset.sizeBytes)} | ${formatBytes(asset.gzipBytes)} |`)
          .join("\n")
      : "No JS assets are above 500 kB raw.",
    "",
    "## Route Timing Baseline",
    "",
    "| Route | Viewport | Visible ready | FCP | Network idle | JS encoded | CSS encoded |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: |",
    ...results.routes.map((route) => {
      const viewport = `${route.viewport.width}x${route.viewport.height}`;
      return [
        `| \`${route.path}\``,
        viewport,
        `${route.visibleReadyMs} ms`,
        `${Math.round(route.paints["first-contentful-paint"] ?? 0)} ms`,
        route.reachedNetworkIdle ? `${route.totalMeasuredMs} ms` : `>${route.networkIdleWaitMs} ms`,
        formatBytes(route.encodedBodyBytes.js),
        `${formatBytes(route.encodedBodyBytes.css)} |`,
      ].join(" | ");
    }),
    "",
    "## React Profiler Baseline",
    "",
    "Captured from a local Vite dev server with `VITE_REACT_PROFILER_BASELINE=true`; production React disables `Profiler` callback timing.",
    "",
    "| Route | Viewport | Samples | Total actual | Max actual | P95 actual |",
    "| --- | --- | ---: | ---: | ---: | ---: |",
    ...results.reactProfilerRoutes.map((route) => {
      const viewport = `${route.viewport.width}x${route.viewport.height}`;
      return [
        `| \`${route.path}\``,
        viewport,
        String(route.profiler.samples),
        `${route.profiler.totalActualDurationMs} ms`,
        `${route.profiler.maxActualDurationMs} ms`,
        `${route.profiler.p95ActualDurationMs} ms |`,
      ].join(" | ");
    }),
    "",
    "## Mobile Workflow Screenshots",
    "",
    "| Route | Viewport | Screenshot |",
    "| --- | --- | --- |",
    ...screenshotRoutes.map((route) => {
      const viewport = `${route.viewport.width}x${route.viewport.height}`;
      const screenshotLink = relative(outputDir, join(repoRoot, route.screenshot));
      return `| \`${route.path}\` | ${viewport} | [${route.id}.png](${screenshotLink}) |`;
    }),
    "",
    "## Lighthouse",
    "",
    lighthouseRows.length
      ? "| Run | Performance | Accessibility | Best practices | SEO | FCP | LCP | TBT | CLS | Artifact |\n| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |\n" +
        lighthouseRows
          .map((row) => {
            const artifactLink = relative(outputDir, join(repoRoot, row.file));
            return `| ${row.label} | ${row.performance} | ${row.accessibility} | ${row.bestPractices} | ${row.seo} | ${row.fcp} | ${row.lcp} | ${row.tbt} | ${row.cls} | [JSON](${artifactLink}) |`;
          })
          .join("\n")
      : "No Lighthouse JSON artifacts found yet.",
    "",
    "Re-run commands:",
    "",
    "```sh",
    "npx lighthouse http://127.0.0.1:4174/auth --preset=desktop --chrome-flags=\"--headless=new --no-sandbox\" --output=json --output-path=docs/performance/phase-4-baseline/lighthouse-auth-desktop.json",
    "npx lighthouse http://127.0.0.1:4174/auth --chrome-flags=\"--headless=new --no-sandbox\" --output=json --output-path=docs/performance/phase-4-baseline/lighthouse-auth-mobile.json",
    "```",
  ];

  writeFileSync(join(outputDir, "README.md"), `${lines.join("\n")}\n`);
}

/** Coordinates build, preview, route measurements, and artifact writing. */
async function main() {
  mkdirSync(outputDir, { recursive: true });
  mkdirSync(screenshotDir, { recursive: true });

  console.log("Building production baseline...");
  run("npm", ["run", "build"]);

  const bundle = collectBundleMetrics();
  const gitCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();

  const preview = startPreview();
  let routeMetrics = [];
  try {
    await waitForServer(previewUrl);

    const browser = await chromium.launch();

    try {
      for (const route of routes) {
        console.log(`Measuring ${route.id} (${route.path})...`);
        routeMetrics.push(await measureRoute(browser, route));
      }
    } finally {
      await browser.close();
    }

  } finally {
    preview.kill("SIGTERM");
  }

  const profilerServer = startProfilerServer();
  const reactProfilerRoutes = [];
  try {
    await waitForServer(profilerUrl);

    const browser = await chromium.launch();

    try {
      for (const route of routes) {
        console.log(`Capturing React Profiler samples for ${route.id} (${route.path})...`);
        reactProfilerRoutes.push(await measureRoute(browser, route, profilerUrl));
      }
    } finally {
      await browser.close();
    }
  } finally {
    profilerServer.kill("SIGTERM");
  }

  const results = {
    generatedAt,
    gitCommit,
    previewUrl,
    profilerUrl,
    bundle,
    routes: routeMetrics,
    reactProfilerRoutes,
  };

  writeFileSync(join(outputDir, "baseline.json"), `${JSON.stringify(results, null, 2)}\n`);
  writeMarkdown(results);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
