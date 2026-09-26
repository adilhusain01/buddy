# Buddy

A todo app with reminders and push notifications, built with Expo (SDK 54) and React Native 0.81. It runs on Android, iOS and the web.

## Getting started

### Prerequisites

- Node.js 20+ and npm
- Android: Android Studio with an SDK and emulator, and JDK 17
- iOS (macOS only): Xcode with a simulator
- The Expo CLI runs through `npx`, so you don't need a global install
- For cloud builds: an [Expo account](https://expo.dev) and `npm install -g eas-cli`

### Install

```bash
git clone https://github.com/adilhusain01/buddy.git BuddyTodo
cd BuddyTodo
npm install
```

The app doesn't need any environment variables.

### Run in development

```bash
npm start          # Expo dev server (press a / i / w for Android / iOS / web)
npm run android    # build and run the native Android app (expo run:android)
npm run ios        # build and run the native iOS app (expo run:ios)
npm run web        # run in the browser
npm run lint
```

The native `ios/` and `android/` folders are generated and gitignored. `npm run android` / `npm run ios` create them (via prebuild) on first run.

Push notifications need a physical device and a development build, not Expo Go. See `expo-push-docs/` for the setup notes.

## Building a release (EAS)

```bash
# ensure you're logged into EAS
eas login

# start a production build for Android (outputs an .apk, see eas.json)
eas build -p android --profile production

# or build locally
eas build --local --platform android --profile production
```

For local Android builds, point Java at JDK 17:

```bash
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
export PATH="$JAVA_HOME/bin:$PATH"
```

Before each release, bump the version in `app.json`:

```json
{
  "expo": {
    "version": "1.0.1",
    "android": {
      "versionCode": 2
    }
  }
}
```

The `production` profile has `autoIncrement` turned on and reads app versions from EAS (`appVersionSource: remote`).
