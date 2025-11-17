# ensure you're logged into EAS
eas login

# start a production build for Android
eas build -p android --profile production

# in app.json

{
  "expo": {
    "version": "1.0.1",
    "android": {
      "versionCode": 2
    }
  }
}