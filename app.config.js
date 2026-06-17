const IS_PROD = process.env.APP_VARIANT === "production";

module.exports = {
  expo: {
    name: IS_PROD ? "audio-example-expo-13-prod" : "audio-example-expo-13-dev",
    slug: "audio-example-expo-13",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: IS_PROD
        ? "com.vincelu299.audioexampleexpo13.prod"
        : "com.vincelu299.audioexampleexpo13.dev",
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      edgeToEdgeEnabled: true,
      package: IS_PROD
        ? "com.vincelu299.audioexampleexpo13.prod"
        : "com.vincelu299.audioexampleexpo13.dev",
      permissions: [
        "android.permission.RECORD_AUDIO",
        "android.permission.MODIFY_AUDIO_SETTINGS",
      ],
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    extra: {
      eas: {
        projectId: "3d4800ab-fc85-4191-bb0e-e778c5a0b3ba",
      },
    },
    plugins: [
      "@mykin-ai/expo-audio-stream",
      [
        "expo-audio",
        {
          enableBackgroundPlayback: true,
        },
      ],
      "expo-font",
      "expo-asset",
    ],
  },
};
