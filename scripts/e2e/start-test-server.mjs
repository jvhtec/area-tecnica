import { spawn, spawnSync } from "node:child_process";

const port = process.env.PLAYWRIGHT_TEST_PORT || "4173";
const baseUrl = `http://127.0.0.1:${port}`;
const production = process.env.PLAYWRIGHT_PRODUCTION === "1";
const environment = {
  ...process.env,
  VITE_SUPABASE_URL: `${baseUrl}/supabase`,
  VITE_SUPABASE_ANON_KEY: "test-anon-key",
};
if (production) {
  const build = spawnSync(process.execPath, ["node_modules/vite/bin/vite.js", "build"], {
    env: environment,
    stdio: "inherit",
  });
  if (build.error || build.status !== 0) {
    console.error("Failed to build production Playwright fixture", build.error ?? build.status);
    process.exit(build.status || 1);
  }
  const postBuild = spawnSync(process.execPath, ['scripts/inject-sw-version.mjs', '--minify-service-worker'], {
    env: environment,
    stdio: 'inherit',
  });
  if (postBuild.error || postBuild.status !== 0) {
    console.error('Failed to finalize production Playwright fixture', postBuild.error ?? postBuild.status);
    process.exit(postBuild.status || 1);
  }
}
const child = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", ...(production ? ["preview"] : []), "--host", "127.0.0.1", "--port", port, "--strictPort"],
  {
    env: environment,
    stdio: "inherit",
  },
);

const forwardSignal = (signal) => {
  if (!child.killed) child.kill(signal);
};

process.on("SIGINT", () => forwardSignal("SIGINT"));
process.on("SIGTERM", () => forwardSignal("SIGTERM"));

child.on("error", (error) => {
  console.error("Failed to start Playwright test server", error);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exitCode = code ?? 1;
});
