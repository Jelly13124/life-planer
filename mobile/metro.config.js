// Metro config — lets the mobile app bundle the SHARED pure domain that lives
// OUTSIDE this project at <repo>/src/domain. The domain is NOT copied/moved.
//
// How the sharing works:
//   scripts/link-shared.js creates junctions (Windows) / symlinks under
//     mobile/.shared/  ->  domain -> ../src/domain,  src -> ../src
//   so the real source is reachable from a path UNDER the project root.
//   (Metro reliably watches/indexes files under projectRoot; pointing
//   watchFolders at the sibling ../src directly failed to index on Windows —
//   "Failed to get the SHA-1 for ...". The junction sidesteps that.)
//
// This resolver just maps the aliases to the junctioned paths:
//   "@core" / "@core/x" -> mobile/.shared/domain[/x]  (= ../src/domain)
//   "@/x"               -> mobile/.shared/src/x        (= ../src/x; the alias
//                          the web app uses internally, so transitive imports
//                          that use it resolve too)
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const sharedRoot = path.resolve(projectRoot, ".shared");
const domainRoot = path.join(sharedRoot, "domain");
const srcRoot = path.join(sharedRoot, "src");

const config = getDefaultConfig(projectRoot);

// Follow symlinks/junctions to their real targets when crawling.
config.resolver.unstable_enableSymlinks = true;

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  let target = null;
  if (moduleName === "@core") {
    target = domainRoot;
  } else if (moduleName.startsWith("@core/")) {
    target = path.join(domainRoot, moduleName.slice("@core/".length));
  } else if (moduleName.startsWith("@/")) {
    target = path.join(srcRoot, moduleName.slice("@/".length));
  }

  if (target) {
    return context.resolveRequest(context, target, platform);
  }
  return (defaultResolveRequest || context.resolveRequest)(
    context,
    moduleName,
    platform,
  );
};

module.exports = config;
