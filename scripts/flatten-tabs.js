// After `expo export --platform web`, Expo Router keeps route-group folders
// like `(tabs)` in the dist output — but their parens break Vercel's URL router.
// This script copies every tab HTML file up to dist/ so /pantry, /plan, etc.
// resolve correctly on Vercel.
//
// Safe to re-run; idempotent.

const fs = require("fs");
const path = require("path");

const DIST = path.resolve(__dirname, "..", "dist");
const TABS_DIR = path.join(DIST, "(tabs)");

if (!fs.existsSync(DIST)) {
  console.error("[flatten-tabs] dist/ not found — run `expo export --platform web` first.");
  process.exit(1);
}

if (!fs.existsSync(TABS_DIR)) {
  console.log("[flatten-tabs] No (tabs) folder in dist — nothing to flatten.");
  process.exit(0);
}

const entries = fs.readdirSync(TABS_DIR, { withFileTypes: true });
let copied = 0;

for (const entry of entries) {
  if (!entry.isFile() || !entry.name.endsWith(".html")) continue;
  // Skip index.html from (tabs) — top-level index.html already exists
  if (entry.name === "index.html") continue;

  const src = path.join(TABS_DIR, entry.name);
  const dst = path.join(DIST, entry.name);
  fs.copyFileSync(src, dst);
  console.log(`[flatten-tabs] ${entry.name}`);
  copied++;
}

console.log(`[flatten-tabs] Copied ${copied} tab file(s) to dist/ root.`);
