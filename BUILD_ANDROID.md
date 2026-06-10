# Building VistaTV APK for Android Phone & TV

## Prerequisites

Install these on your local machine:
- [Android Studio](https://developer.android.com/studio) (includes Java JDK + Android SDK)
- [Node.js 20+](https://nodejs.org/)
- Git (to clone/download this project)

---

## Step 1 — Download this project

Download/clone the project to your local machine.

---

## Step 2 — Install dependencies & build the web app

Open a terminal in the project root:

```bash
npm install
npm run build:android
```

This builds the React app into `dist/public/` and syncs it into the Android project.

---

## Step 3 — Open in Android Studio

```bash
npx cap open android
```

Android Studio will open the `android/` folder as a Gradle project.
Wait for it to finish syncing Gradle (bottom progress bar).

---

## Step 4 — Build the APK

### Option A — Debug APK (quickest, for testing)

In Android Studio:
- Menu: **Build → Build Bundle(s) / APK(s) → Build APK(s)**
- APK will be at: `android/app/build/outputs/apk/debug/app-debug.apk`

Or via terminal (inside the `android/` folder):

```bash
cd android
./gradlew assembleDebug
```

### Option B — Release APK (for distribution)

```bash
cd android
./gradlew assembleRelease
```

APK at: `android/app/build/outputs/apk/release/app-release-unsigned.apk`

To sign it, follow: https://developer.android.com/studio/publish/app-signing

---

## Step 5 — Install on your device

### Phone / Tablet:
1. Enable **Developer Options** → **USB Debugging** on your phone
2. Connect via USB and run:
   ```bash
   adb install android/app/build/outputs/apk/debug/app-debug.apk
   ```

### Android TV:
1. Enable **Developer Options** on your TV (Settings → About → click Build # 7 times)
2. Enable **ADB over Network** (Settings → Developer Options)
3. Find your TV's IP address (Settings → Network)
4. Run:
   ```bash
   adb connect YOUR_TV_IP:5555
   adb install android/app/build/outputs/apk/debug/app-debug.apk
   ```

---

## Using Firebase App Distribution (optional)

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com)
2. Add Android app with package name: `com.vistatv.app`
3. Download `google-services.json` and place it in `android/app/`
4. In Firebase console → **App Distribution** → upload your APK
5. Share with testers via email

---

## App Details

| Property       | Value              |
|----------------|--------------------|
| App Name       | VistaTV            |
| Package ID     | com.vistatv.app    |
| Min Android    | 5.0 (API 21)       |
| Target Android | 15 (API 35)        |
| TV Support     | Yes (Leanback)     |
| Phone Support  | Yes                |
| Tablet Support | Yes                |

---

## After Changing the Web App

Whenever you update the web app, run this to sync changes into the Android project:

```bash
npm run build:android
```

Then rebuild the APK in Android Studio.
