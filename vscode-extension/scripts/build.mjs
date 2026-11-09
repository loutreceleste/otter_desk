// Bundle de l'extension (le code partagé ../src/shared est inclus) → dist/extension.js
import { build } from "esbuild";

await build({
  entryPoints: ["src/extension.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  external: ["vscode"],
  outfile: "dist/extension.js",
  sourcemap: false,
  minify: false,
  legalComments: "none",
  logLevel: "info",
});
