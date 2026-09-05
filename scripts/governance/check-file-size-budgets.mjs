import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("./check-file-size-budget.mjs", import.meta.url));
for (const domainArgs of [[], ["--functions"]]) {
  const result = spawnSync(process.execPath, [script, ...domainArgs, ...process.argv.slice(2)], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
