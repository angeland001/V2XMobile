---
name: verify
description: How to verify changes in this Expo/React Native app (V2XMobile) when no Android/iOS emulator tooling is installed on the machine.
---

# Verifying changes in V2XMobile

This is an Expo (SDK 52) + Expo Router app (`react-native`, `@rnmapbox/maps`,
`react-native-reanimated`), not a plain web app. `expo start --web` exists but
is **not a reliable verification surface** — the web platform bundle currently
fails to compile (`mapbox-gl/dist/mapbox-gl.css` cannot be resolved from
`@rnmapbox/maps/src/web/index.js`, a pre-existing/unrelated issue, not caused
by app code changes). Don't treat a web-bundle failure as a sign your change
broke something unless the error references a file you touched.

## Check for a live Metro server first

`expo start` may already be running (e.g. started manually by the developer
with a real device attached). Before starting a new one:

```bash
netstat -ano | grep ":8081"   # LISTENING + ESTABLISHED connections = a device is attached
curl -s http://localhost:8081/status   # "packager-status:running" confirms it's Metro
```

If a server is already up, don't start a second one (Expo will just prompt to
use a different port and skip). Reuse the existing one.

## No Android/iOS tooling on this machine

`adb`, `emulator`, and `xcrun` are not installed here — there is no way to
launch/control an emulator or read device logs (`adb logcat`) from this shell.
If a physical device is connected to the running Metro instance (visible as
ESTABLISHED connections on port 8081), there is still no way to see its
screen or interact with it from here.

## Best available verification without a device

Force Metro to actually compile the app for the platform a real device would
use (this exercises Babel/Hermes transform of every changed file, catching
syntax errors, unresolved imports, and reanimated worklet issues that
`tsc --noEmit` won't):

```bash
curl -s "http://localhost:8081/node_modules/expo-router/entry.bundle?platform=android&dev=true&hot=false&transform.engine=hermes&transform.routerRoot=app&unstable_transformProfile=hermes-stable" \
  -o /tmp/android_bundle.js -w "HTTP:%{http_code} SIZE:%{size_download}\n"
```

- `HTTP:200` + a multi-MB bundle = compiled cleanly.
- `HTTP:500` = compile error; the JSON body names the failing module and line.

This is real evidence the code loads, but it is **not** a substitute for
driving the actual UI — it can't confirm on-screen rendering, animation
correctness, or GPS-driven behavior (e.g. TIM zone alerts, navigation
progress). Say so explicitly in any verification report rather than
presenting a clean bundle compile as full behavioral confirmation.

## Typecheck gotcha

`tsconfig.json` currently has `"ignoreDeprecations": "6.0"`, which TypeScript
5.8.3 rejects outright (`error TS5103: Invalid value for '--ignoreDeprecations'`).
Override on the CLI rather than editing the file:

```bash
npx tsc --noEmit -p tsconfig.json --ignoreDeprecations 5.0
```

The repo also has a number of pre-existing, unrelated typecheck errors
(`React refers to a UMD global...` in `app/(tabs)/*.tsx` and `components/*`,
a few real type mismatches in DirectionGuide/PedestrianDetector/SDSM
features). Filter output to the files you actually touched before judging
pass/fail.
