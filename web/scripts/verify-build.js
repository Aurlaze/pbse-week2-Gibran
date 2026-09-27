// Fails the build if the bundle does not contain the application.
//
// This exists because of a real failure: a `throw` at module scope on a
// missing VITE_ variable. Vite inlines import.meta.env at build time, so
// the guard became an unconditional throw, Rollup treated everything after
// it as unreachable, and the build cheerfully emitted a bundle with React
// in it and none of this application. `npm run build` said "✓ built".
//
// The check is deliberately crude: a handful of strings that only exist in
// our own source. If they are all missing, whatever was built is not this
// application.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ASSETS = "dist/assets";

// Distinctive, and spread across the layers, so this does not start
// passing because one file survived.
const MARKERS = ["If-None-Match", "Idempotency-Key", "Reconnecting"];

const bundles = readdirSync(ASSETS).filter((name) => name.endsWith(".js"));

if (bundles.length === 0) {
  console.error(`verify-build: no JavaScript emitted into ${ASSETS}`);
  process.exit(1);
}

const source = bundles
  .map((name) => readFileSync(join(ASSETS, name), "utf8"))
  .join("");

const missing = MARKERS.filter((marker) => !source.includes(marker));

if (missing.length > 0) {
  console.error(
    "verify-build: the bundle is missing application code.\n" +
      `  markers not found: ${missing.join(", ")}\n` +
      "  A module-scope throw, or a top-level side effect on a missing\n" +
      "  VITE_ variable, can make Rollup drop everything downstream of it.\n" +
      "  The build will still report success and deploy a blank page."
  );
  process.exit(1);
}

const bytes = bundles.reduce(
  (total, name) => total + statSync(join(ASSETS, name)).size,
  0
);

console.log(
  `verify-build: ${bundles.length} bundle(s), ${(bytes / 1024).toFixed(0)} kB, application code present`
);
