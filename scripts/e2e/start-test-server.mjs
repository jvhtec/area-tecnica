import { spawn } from "node:child_process";

const port = process.env.PLAYWRIGHT_TEST_PORT || "4173";
const baseUrl = `http://127.0.0.1:${port}`;
const child = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", port, "--strictPort"],
  {
    env: {
      ...process.env,
      VITE_SUPABASE_URL: `${baseUrl}/supabase`,
      VITE_SUPABASE_ANON_KEY: "test-anon-key",
    },
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
