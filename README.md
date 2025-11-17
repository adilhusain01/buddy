# ensure you're logged into EAS
eas login

# start a production build for Android
eas build -p android --profile production
eas build --local --platform android --profile production

export JAVA_HOME=$(/usr/libexec/java_home -v 17)
export PATH="$JAVA_HOME/bin:$PATH"

# in app.json

{
  "expo": {
    "version": "1.0.1",
    "android": {
      "versionCode": 2
    }
  }
}