# V2XMobile

A Vehicle-to-Everything (V2X) mobile application built with React Native and Expo. The app provides real-time connected vehicle safety features including traffic signal awareness, pedestrian detection, and live vehicle/VRU (Vulnerable Road User) tracking on an interactive map.

This project is developed at the University of Tennessee as part of the CUIP (Chattanooga Urban Infrastructure Platform) connected vehicle research program.

## Features

- **SPaT (Signal Phase and Timing)** — Real-time traffic signal state (GO / CAUTION / STOP) for the user's current lane at instrumented intersections
- **SDSM Vehicle & VRU Tracking** — Live map markers for nearby vehicles and pedestrians sourced from the CV2X infrastructure API
- **Pedestrian Crosswalk Detection** — Alerts when VRU pedestrians are detected inside a crosswalk ahead of the vehicle
- **Signal Preemption** — Sends Signal Request Messages (SRM) to request green-light priority at supported intersections
- **Direction Guide** — Lane-level turn guidance with heading-based lane detection
- **Lane Overlay** — Visual lane geometry rendered on the Google map
- **Closest Intersection Detection** — Polygon-based detection of the nearest instrumented intersection

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native + Expo (managed/bare workflow) |
| Language | TypeScript |
| Map | Google Maps (`react-native-maps`) |
| State management | MobX (`mobx`, `mobx-react-lite`) |
| Navigation | Expo Router (file-based) |
| Local storage | Expo SQLite |
| Build target | Android (primary), iOS |

## Architecture

The app follows a **feature-based MVVM** architecture. Each feature is a self-contained vertical slice under `app/src/features/`, owning its own models, services, view models, and views. A thin `MainViewModel` at the top composes all feature view models and wires them together.

```
app/
├── (tabs)/                    # Expo Router tab screens
├── AppNavigator.tsx
├── MainNavigator.tsx
└── src/
    ├── core/                  # Shared infrastructure
    │   ├── api/               # API config, base services, Google Maps config
    │   ├── hooks/             # useLocationPermission, etc.
    │   ├── utils/             # Formatters, debug tools
    │   └── viewmodels/        # BaseViewModel
    │
    ├── Main/                  # App root composition
    │   ├── viewmodels/MainViewModel.ts   # Composes all feature VMs
    │   └── views/screens/MainScreen.tsx # Root screen
    │
    └── features/
        ├── Map/               # Google map, location, heading, UI overlays
        ├── SDSM/              # Sensor Data Sharing Messages — vehicle & VRU markers
        ├── SpatService/       # Signal Phase & Timing polling and zone logic
        ├── PedestrianDetector/# Crosswalk detection using SDSM VRU data
        ├── DirectionGuide/    # Turn guidance, lane detection, position tracking
        ├── Lanes/             # Lane geometry rendering on map
        ├── ClosestIntersection/ # Polygon-based nearest intersection detection
        ├── Crosswalk/         # Crosswalk coordinate constants and styles
        ├── preemption/        # SRM-based signal preemption requests
        ├── Settings/          # In-app settings screen
        ├── Onboarding/        # First-launch onboarding
        └── Splash/            # Splash screen
```

### Data Flow

```
CV2X Infrastructure API
  └─► SDSMService ──► VehicleDisplayViewModel ──► VehicleMarkers (map)
                  └─► PedestrianDetectorViewModel ──► crosswalk alert

SPaT API (dashboard backend)
  └─► SpatApiService ──► SpatViewModel ──► SpatStatusDisplay (HUD)
                     └─► SpatZoneService (zone/lane mapping)

Device GPS
  └─► LocationService ──► MapViewModel ──► user position on map
                      └─► SpatViewModel ──► zone entry/exit detection
                      └─► PedestrianDetectorViewModel ──► proximity checks
```

### Key Design Decisions

- **MobX observables** propagate state changes from services to views without manual subscriptions.
- **Zone-based SPaT display** — the signal HUD only appears after the user physically crosses the entry line of a zone polygon, preventing false displays from GPS jitter.
- **SDSM feeds PedestrianDetector** — pedestrian data is not fetched independently; the `PedestrianDetectorViewModel` consumes VRU objects already retrieved by the SDSM pipeline.
- **Testing mode** (`TESTING_CONFIG`) swaps live services for fixed-position simulators without touching production code paths.

## External APIs

| API | Purpose |
|---|---|
| `roadaware.cuip.research.utc.edu/cv2x` | SDSM events (vehicles & VRUs) |
| `localhost:3001` (dashboard) | SPaT zones authored in the Kepler dashboard |
| `localhost:5000` | General backend API |
| Google Maps Platform | Map tiles and rendering |

## Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- Android Studio (for the Android emulator) or a physical Android device
- A Google Maps API key with Maps SDK for Android and Maps SDK for iOS enabled

### Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file in the project root:
   ```
   EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
   ```

3. Start the development server:
   ```bash
   npx expo start
   ```

4. Open in an Android emulator or scan the QR code with Expo Go.

### Android (native build)

```bash
npx expo run:android
```

> **Note:** The API config (`app/src/core/api/config.ts`) uses `10.0.2.2` as the host address, which is the Android emulator alias for the host machine's `localhost`. Update these values if deploying to a physical device.

## Project Structure Notes

- `app/(tabs)/index.tsx` — entry point tab that renders the main map screen
- `app/src/Main/viewmodels/MainViewModel.ts` — the single composition root; start here to understand how features connect
- `app/src/core/api/config.ts` — all API base URLs in one place
- `app/src/features/SpatService/services/SpatZoneService.ts` — zone definitions and entry/exit line crossing logic
