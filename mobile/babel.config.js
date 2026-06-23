// Babel config — transform-time aliases for the SHARED pure domain (which lives
// at <repo>/src/domain, OUTSIDE this project; not copied/moved).
//   "@core"  -> mobile/.shared/domain   (junction -> ../src/domain)
//   "@/..."  -> mobile/.shared/src       (junction -> ../src; the alias the web
//                                         app uses internally, so transitive
//                                         imports that use it resolve too)
// Targets point at the in-project .shared junctions (created by
// scripts/link-shared.js) so the files live under the project root, which Metro
// indexes reliably. Mirrors the resolver in metro.config.js. babel-preset-expo
// is required for Expo SDK 56.
const path = require("path");
const sharedRoot = path.resolve(__dirname, ".shared");

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      [
        "module-resolver",
        {
          alias: {
            "@core": path.join(sharedRoot, "domain"),
            "@": path.join(sharedRoot, "src"),
          },
        },
      ],
    ],
  };
};
