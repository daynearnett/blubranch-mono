module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Reanimated 4 (SDK 55) moved its Babel plugin into a separate package
    // `react-native-worklets`. The plugin must remain the LAST entry. With
    // expo-router using Reanimated under the hood for screen transitions
    // this is required even though we never import Reanimated directly.
    plugins: ['react-native-worklets/plugin'],
  };
};
