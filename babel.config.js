module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    'nativewind/babel',
    [
      'module-resolver',
      {
        root: ['.'],
        alias: {
          '@': './src',
          '@assets': './assets',
        },
        extensions: ['.ios.js', '.android.js', '.js', '.ts', '.tsx', '.json', '.png', '.jpg'],
      },
    ],
    'react-native-reanimated/plugin', // Must be last
  ],
};
