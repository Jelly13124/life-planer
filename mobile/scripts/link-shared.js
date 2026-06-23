#!/usr/bin/env node
// Creates the .shared/ links that expose the repo's SHARED pure domain to this
// Expo app WITHOUT copying or moving it.
//
//   mobile/.shared/domain  ->  ../src/domain   (the @core alias target)
//   mobile/.shared/src     ->  ../src          (the @/    alias target)
//
// Why links under the project root (not Metro watchFolders pointing at ../src):
// on Windows, Metro's file crawler would not index a sibling watchFolder
// ("Failed to get the SHA-1 for ..."). Placing the shared source under the
// project root via a junction/symlink makes Metro index it reliably while
// keeping a single source of truth (the real files stay in <repo>/src).
//
// Uses a Windows "junction" (no admin needed) and a POSIX "dir" symlink
// elsewhere. .shared/ is gitignored and regenerated; it is never committed.
// Runs automatically on `npm install` (postinstall) and can be run manually:
//   node scripts/link-shared.js
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const sharedDir = path.join(projectRoot, ".shared");
const linkType = process.platform === "win32" ? "junction" : "dir";

const links = [
  { name: "domain", target: path.resolve(projectRoot, "..", "src", "domain") },
  { name: "src", target: path.resolve(projectRoot, "..", "src") },
];

fs.mkdirSync(sharedDir, { recursive: true });

for (const { name, target } of links) {
  const link = path.join(sharedDir, name);
  if (!fs.existsSync(target)) {
    console.error(`[link-shared] target missing: ${target}`);
    process.exitCode = 1;
    continue;
  }
  try {
    fs.rmSync(link, { recursive: true, force: true });
  } catch {
    // ignore
  }
  fs.symlinkSync(target, link, linkType);
  console.log(`[link-shared] ${path.relative(projectRoot, link)} -> ${target}`);
}
