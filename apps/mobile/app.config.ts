import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * APP_VARIANT=development gives the dev build its own id and name so it can sit
 * next to a store install on the same phone. Set per profile in eas.json.
 */
const IS_DEV = process.env.APP_VARIANT === 'development';

// Working id; the product name is decided after v1. Must be final before the first store upload.
const BASE_ID = 'com.rohangupta.financebro';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: IS_DEV ? 'finance-bro (dev)' : 'finance-bro',
  slug: 'finance-bro',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'financebro',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: IS_DEV ? `${BASE_ID}.dev` : BASE_ID,
    icon: './assets/expo.icon',
  },
  android: {
    package: IS_DEV ? `${BASE_ID}.dev` : BASE_ID,
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: { bundler: 'metro', output: 'single' },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#F6F6F4',
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
        dark: { backgroundColor: '#0E0F10' },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
});
