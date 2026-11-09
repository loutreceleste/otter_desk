// Compile les tests TypeScript (tests/*.test.ts) avec esbuild puis les exécute avec node:test.
import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outdir = path.join(root, "out-tests");
rmSync(outdir, { recursive: true, force: true });

const entries = readdirSync(path.join(root, "tests"))
  .filter((f) => f.endsWith(".test.ts"))
  .map((f) => path.join(root, "tests", f));

await build({
  entryPoints: entries,
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  outdir,
  outExtension: { ".js": ".cjs" },
  external: ["electron", "vscode"],
  logLevel: "warning",
});

const files = readdirSync(outdir).filter((f) => f.endsWith(".test.cjs")).map((f) => path.join(outdir, f));
const r = spawnSync(process.execPath, ["--test", "--test-concurrency=1", ...files], { stdio: "inherit" });
process.exit(r.status ?? 1);
