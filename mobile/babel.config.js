// Babel config for the Expo app. The shared domain is consumed as the workspace
// package "@lifeplanner/core" (symlinked into node_modules), so Metro resolves
// it natively — no transform-time alias needed. babel-preset-expo is required
// for Expo SDK 56.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
  };
};
