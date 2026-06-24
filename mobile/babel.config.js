// Babel config for the Expo app. The shared domain is consumed as the workspace
// package "@lifeplanner/core" (symlinked into node_modules), so Metro resolves
// it natively — no transform-time alias needed. babel-preset-expo is required
// for Expo SDK 56.
//
// react-native-worklets/plugin powers Reanimated 4 worklets (smooth gesture/
// drag animations). It MUST be the last plugin.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: ["react-native-worklets/plugin"],
  };
};
