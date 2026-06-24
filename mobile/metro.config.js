// Metro config for the Expo app inside an npm workspaces monorepo.
//
// The shared pure domain lives at <repo>/packages/core and is published in the
// workspace as the package "@lifeplanner/core". npm install symlinks it into
// node_modules, so Metro resolves it like any normal dependency — no junctions,
// no custom resolver, no .shared hack.
//
// Two monorepo essentials:
//   1. watchFolders includes the repo root so Metro crawls/watches the linked
//      package's real source under packages/core.
//   2. nodeModulesPaths includes the root node_modules so hoisted deps resolve.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

// Follow the workspace symlink (@lifeplanner/core) to its real target.
config.resolver.unstable_enableSymlinks = true;

// Watch the whole monorepo so edits to packages/core are picked up.
config.watchFolders = [workspaceRoot];

// Resolve modules from the app's own node_modules first, then the hoisted root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

module.exports = config;
