# Running the mobile app

Use **NekoStream Dev** with Expo and Metro for daily development. UI edits
appear through Fast Refresh. Build a **signed release APK** after development;
it runs without a development server.

The development app uses `org.nekostream.mobile.dev`; the release uses
`org.nekostream.mobile`. They can coexist, each with its own database and
tracker logins. The installed release's library and Nyaa filters stay intact.

Expo Go cannot run this project: it needs custom native modules and the
registered `nekostream://auth/anilist` and `nekostream://auth/mal` callbacks.
`expo-dev-client` supplies the project's own development launcher instead.

## Prerequisites

On the configured Linux workstation, load the local JDK 17, Android SDK, and Node paths:

```bash
source scripts/dev-env.sh
```

On Windows, use your installed toolchain paths:

```bash
export JAVA_HOME="C:/Users/haruhadj/scoop/apps/temurin17-jdk/current"
export ANDROID_HOME="C:/Users/haruhadj/scoop/apps/android-clt/current"
```

JDK **17**, not the shell's default `temurin-lts` (JDK 25). AGP for React
Native 0.86 wants 17, and 25 fails deep in the native build at
`:react-native-worklets:configureCMakeRelWithDebInfo`. `scripts/local-release.sh`
forces this for you and honours `NEKOSTREAM_JDK`; `npm run android` does not,
so export it yourself.

A device connected over USB or wireless ADB, with USB debugging on:

```bash
adb devices    # must list one device before either workflow
```

## Live development

### 1. Build the native development app (once)

From this standalone repository's root:

```bash
source scripts/dev-env.sh # configured Linux workstation
npm ci
npm run android:dev
```

This generates Android files for the development variant, compiles, installs,
and launches NekoStream Dev. The first native build downloads Gradle, SDK,
and native dependencies and can take around 20 minutes. Subsequent UI work
uses the same binary.

### 2. Iterate (every session after that)

```bash
source scripts/dev-env.sh # configured Linux workstation
npm run dev
adb reverse tcp:8081 tcp:8081
```

Open **NekoStream Dev**, then select the Metro development server. With Expo
Dev Client installed you can also use the terminal's `a` shortcut. Save a UI
file to see Fast Refresh on the phone; scrcpy mirrors the same native screen.
If the launcher needs an explicit connection:

```bash
adb shell am start -a android.intent.action.VIEW \
  -d 'exp+nekostream://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081' \
  org.nekostream.mobile.dev
```

Sign in to AniList once in the development app to import your watchlist.
Because both variants retain the registered `nekostream://` OAuth callback,
Android may show an app chooser after browser sign-in: select NekoStream Dev
for a development sign-in. Saved release feeds are not copied into the
separate development database.

Run `adb reverse` *after* `expo start`: the Expo CLI restarts the adb server on
launch, which silently clears existing reverses. It maps the phone's
`localhost:8081` to Metro over the ADB link, so it works regardless of what the
Wi-Fi is doing.

| In the Metro terminal | Does                                          |
| --------------------- | --------------------------------------------- |
| `r`                   | Reload the app                                 |
| `j`                   | React Native DevTools — console, network, tree |
| shaking the device    | Dev menu, Fast Refresh toggle                  |

### When a native rebuild is needed

| Change                                            | Rebuild? |
| ------------------------------------------------- | -------- |
| Anything under `src/`                             | No — save and it reloads |
| A new pure-JS dependency                          | No — restart Metro |
| `app.json` plugins, scheme, icons, permissions    | Yes |
| A dependency with native code (any `expo-*` module) | Yes |
| `metro.config.js` / `babel.config.js`             | No, but restart Metro with `--clear` |

## Release APK

### Standalone build for the existing development install

When the original production signing key is unavailable, a standalone build
can update **NekoStream Dev** while keeping the original release untouched:

```bash
source scripts/dev-env.sh
NEKOSTREAM_VARIANT=development NEKOSTREAM_BUILD_MODE=standalone npx expo prebuild --platform android --no-install
cd android
NEKOSTREAM_VARIANT=development NEKOSTREAM_BUILD_MODE=standalone ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a --max-workers=1 -Pkotlin.compiler.execution.strategy=in-process
adb install -r app/build/outputs/apk/release/app-release.apk
```

This APK excludes development tooling, shrinks code and resources, bundles
JavaScript and runs without Metro. It retains the development
package and debug signing certificate; it is for local use, not production
distribution. Confirm its certificate matches the installed development app
before installing. The architecture above targets the connected arm64 phone.
For an update to the original **NekoStream** release, use its original keystore
and the production workflow below.

### Production build

The script regenerates native files for the production package, builds a
standalone APK, and signs it. Keep the original release keystore to install
over an existing release without clearing its data.

```bash
bash scripts/local-release.sh
```

Produces `android/app/build/outputs/apk/release/nekostream-signed.apk` with the
JavaScript bundled in — no Metro, no dev server, nothing pointing at your PC.

The script deletes `app/build/generated/assets/react/release` before building.
That is deliberate: Gradle once reported that task `UP-TO-DATE` after a change
under `src/`, shipping an APK with fresh native code and one-build-old
JavaScript — which on the device looks exactly like "the fix did not work."

It then re-signs the APK with `credentials/nekostream-release.keystore` rather
than configuring signing inside `android/`, because `android/` is generated by
`expo prebuild` and gitignored, so any config written there is lost on the next
regeneration. Every local release build therefore carries the same signature,
which is what lets a new release install *over* the previous one without an
uninstall — and without taking the device database with it.

Install it:

```bash
adb install -r android/app/build/outputs/apk/release/nekostream-signed.apk
```

To prove the APK carries the code you just wrote rather than a stale bundle,
grep the bundle inside it for something only your change contains:

```bash
unzip -p nekostream-signed.apk assets/index.android.bundle | grep -c "some new string"
```

If the keystore is ever lost, generate a new one with `keytool`. The cost is
one uninstall, since the signature will no longer match what is installed.

## Legacy builds sharing the release package

The separate development variant avoids this problem. Older debug builds and release builds share the package id `org.nekostream.mobile` but carry
different signatures, so Android refuses to install one over the other. The
uninstall that unblocks it clears the app's data:

| Lost on uninstall            | Recoverable?                                  |
| ---------------------------- | --------------------------------------------- |
| Library entries              | Yes — re-syncs from AniList                    |
| AniList / MAL tokens         | Yes — sign in again                            |
| **Nyaa filters (`rss_filter`)** | **No.** The device is the only copy; nothing on a server mirrors it. |

Back the database up first — this works on a **debug** build only, since
`run-as` refuses a release build (`run-as: package not debuggable`):

```bash
adb exec-out run-as org.nekostream.mobile tar c databases > db-backup.tar
```

If you expect to bounce between the two often, give the debug variant its own
`applicationIdSuffix ".dev"` in `android/app/build.gradle` so both can be
installed at once. Two caveats: that file is prebuild-generated and gitignored,
so the edit does not survive `expo prebuild --clean`; and both apps then claim
`nekostream://`, so the OAuth callback shows an app chooser.

## Troubleshooting

**"Project is incompatible with this version of Expo Go"** — you opened Expo Go,
not the app. Tap the NekoStream icon instead. Check what is actually in front
with `adb shell dumpsys activity activities | grep topResumedActivity`.

**Stuck on the splash screen** — the app cannot reach Metro. Re-run
`adb reverse tcp:8081 tcp:8081`, then restart the app; it only fetches the
bundle at startup, so bringing an already-running instance to the front will not
retry. Confirm Metro is up with `curl http://localhost:8081/status`.

**Blank screen after the splash clears** — JavaScript loaded but something threw.
`adb logcat -s ReactNativeJS:V ReactNative:V AndroidRuntime:E`.

**The build fails in `configureCMake...`** — wrong JDK. See
[Prerequisites](#prerequisites).

**`:app:packageRelease` fails in `IncrementalSplitterRunnable`** — a stale
incremental packaging state, seen right after a debug build. It carries no
useful message. Re-run the script; if it persists, `./gradlew clean`.

**A piped build looks like it passed** — `bash scripts/local-release.sh | tail`
reports `tail`'s exit code, not the script's, so a failed build reads as
success. Redirect instead: `bash scripts/local-release.sh > build.log 2>&1`.

**`adb` reports more than one device** — this machine sometimes lists the same
phone twice over wireless ADB. Pin one:

```bash
export ANDROID_SERIAL="$(adb devices | sed -n 2p | cut -f1)"
```
# Anime links

Discover accepts pasted `https://anilist.co/anime/ID/...` and
`https://myanimelist.net/anime/ID/...` links. Open the preview and tap
**Add to library**; an existing title opens without changing its progress.
Manga, profiles, lists, foreign domains and non-anime IDs are rejected.
MAL IDs are resolved through AniList's anime catalog; entries without an
AniList mapping cannot currently be added.

Incoming Android VIEW links use the same preview, on both cold and warm launches.
This requires rebuilding and reinstalling the APK after the intent-filter
configuration change. The app does not own the tracker domains and cannot
verify them as Android App Links. On newer Android versions, enable the tracker
domains under **Settings → Apps → NekoStream Dev → Open by default → Open
supported links** if offered; browsers may otherwise open them themselves.
Paste the link in Discover when Android does not offer the app.
