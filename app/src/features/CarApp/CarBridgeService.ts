import { DeviceEventEmitter, NativeModules, Platform } from 'react-native';
import { reaction } from 'mobx';
import { TimService } from '../TIM/services/TimService';
import { RouteViewModel } from '../Route/viewmodels/RouteViewModel';
import { SettingsViewModel } from '../UI/viewmodels/SettingsViewModel';
import { TimCategory } from '../TIM/models/TimTypes';

// Well under TimZoneScreen.kt's BRIDGE_STALE_MS (8000ms), so a badge set that
// holds steady still keeps the native watchdog from flipping to
// "Status Unavailable" between real state changes.
const KEEPALIVE_INTERVAL_MS = 3000;

// Emitted by CarBridgeModule.kt when the driver taps a row on the Android
// Auto zone-alert screen — see TimZoneScreen.kt's Row.setOnClickListener.
const TAP_EVENT = 'CarBridgeTimZoneTapped';

// Fixed display order regardless of distance, so the native row order never
// jitters as zones come and go — matches the red/yellow/blue reading order
// used everywhere else in the app (TimToast's CATEGORY_STYLE, SeverityDots).
const CATEGORY_ORDER: TimCategory[] = ['safety', 'regulatory', 'informational'];

const CATEGORY_COLOR: Record<TimCategory, 'red' | 'yellow' | 'blue'> = {
  safety: 'red',
  regulatory: 'yellow',
  informational: 'blue',
};

const CATEGORY_LABEL: Record<TimCategory, string> = {
  safety: 'Safety Zone',
  regulatory: 'Regulatory Zone',
  informational: 'Info Zone',
};

interface CarBadge {
  category: TimCategory;
  // Identifies which zone this badge is for — carried through to native and
  // back on tap, so a dismiss can be scoped to this specific zone rather
  // than the whole category (see the tap listener below).
  timId: number;
  color: string;
  label: string;
  distanceText: string;
}

// The single best candidate per category, merged from whichever source is
// active (route-crossing while navigating, buffer+heading while ambient) —
// see computeCandidates. inside:true always wins over an approaching one for
// the same category ("you're in it" outranks a further-off approach).
interface CategoryCandidate {
  timId: number;
  timType: string;
  inside: boolean;
  distanceM: number; // 0 (unused) when inside
}

function formatDistanceMeters(m: number): string {
  const ft = m * 3.28084;
  if (ft < 1000) return `${Math.round(ft / 50) * 50 || Math.round(ft)} ft`;
  const mi = m / 1609.34;
  return `${mi.toFixed(1)} mi`;
}

// Builds the full display string here (native just renders it verbatim) so
// TimZoneScreen.kt stays a thin, data-driven relay instead of encoding
// "inside vs approaching" formatting rules natively.
function toBadge(category: TimCategory, candidate: CategoryCandidate): CarBadge {
  return {
    category,
    timId: candidate.timId,
    color: CATEGORY_COLOR[category],
    label: CATEGORY_LABEL[category],
    distanceText: candidate.inside ? 'In Zone' : `${formatDistanceMeters(candidate.distanceM)} ahead`,
  };
}

export function startTimCarBridge(
  timService: TimService,
  routeViewModel: RouteViewModel,
  settingsViewModel: SettingsViewModel,
): () => void {
  if (Platform.OS !== 'android') {
    return () => {};
  }

  // The zone the driver tapped away, per category — stays suppressed until
  // that specific zone drops out of candidacy (left it, or a route/ambient
  // recompute no longer surfaces it) or a different zone takes its place;
  // see selectVisibleBadges. Tapping doesn't clear the underlying condition,
  // just this display — the same badge will come back if the same zone is
  // ever re-approached later (a fresh candidacy after having dropped out).
  const dismissedByCategory = new Map<TimCategory, number>();

  const computeCandidates = (): Partial<Record<TimCategory, CategoryCandidate>> => {
    if (!settingsViewModel.carDisplayAlerts) return {};

    const result: Partial<Record<TimCategory, CategoryCandidate>> = {};

    if (routeViewModel.isNavigating) {
      // Navigating: zones the route currently has the user inside of always
      // win. RouteViewModel.approachingTimZones deliberately excludes those
      // (it's the "not there yet" list), so this is the only place that
      // surfaces them to the car display.
      for (const hit of routeViewModel.insideTimZones) {
        if (!result[hit.category]) {
          result[hit.category] = { timId: hit.timId, timType: hit.timType, inside: true, distanceM: 0 };
        }
      }
      for (const hit of routeViewModel.approachingTimZones) {
        if (result[hit.category]?.inside) continue;
        const distanceM = routeViewModel.approachingTimZoneDistancesM.get(hit.timId);
        if (distanceM == null) continue;
        const current = result[hit.category];
        if (!current || distanceM < current.distanceM) {
          result[hit.category] = { timId: hit.timId, timType: hit.timType, inside: false, distanceM };
        }
      }
    } else {
      // Ambient: TimService's buffer (0.5mi) + heading based proximity —
      // the same "prompted at 0.5mi while heading toward it" logic used
      // everywhere else in the app.
      for (const category of CATEGORY_ORDER) {
        const nearby = timService.nearbyByCategory[category];
        if (!nearby) continue;
        result[category] = {
          timId: nearby.timId,
          timType: nearby.timType,
          inside: nearby.inside,
          distanceM: nearby.distanceMi * 1609.34,
        };
      }
    }

    return result;
  };

  // Every candidate is shown persistently — no auto-expire — until either
  // the driver taps it away on the Android Auto screen (dismissedByCategory,
  // set by the tap listener below) or the zone itself drops out of
  // candidacy entirely (left the buffer, no longer heading toward it, or
  // actually exited it).
  const selectVisibleBadges = (candidates: Partial<Record<TimCategory, CategoryCandidate>>): CarBadge[] => {
    const badges: CarBadge[] = [];

    for (const category of CATEGORY_ORDER) {
      const candidate = candidates[category];
      if (!candidate) {
        dismissedByCategory.delete(category);
        continue;
      }

      if (dismissedByCategory.get(category) === candidate.timId) continue;
      // A stale dismissal for a different, earlier zone in this category —
      // clear it so it doesn't linger and (harmlessly, since the timId
      // check above already wouldn't match) confuse later reads.
      dismissedByCategory.delete(category);

      badges.push(toBadge(category, candidate));
    }

    return badges;
  };

  // Log only when the active badge set actually changes — the keepalive
  // interval below re-pushes every 3s regardless, and logging every one of
  // those would spam the console without telling the developer anything new.
  let lastLoggedKey = '';

  function push(): void {
    const badges = selectVisibleBadges(computeCandidates());
    const key = badges.map((b) => `${b.category}:${b.distanceText}`).join(',');
    if (key !== lastLoggedKey) {
      lastLoggedKey = key;
      console.log('[CarBridge] TIM zone badges changed', badges.map((b) => `${b.category}:${b.distanceText}`));
    }
    NativeModules.CarBridge?.updateTimZones(JSON.stringify(badges));
  }

  // TimZoneScreen.kt's Row.setOnClickListener → CarAppBridge.notifyBadgeTapped
  // → CarBridgeModule emits this event with the tapped badge's category and
  // timId. Recording it here and re-pushing is what actually removes the
  // badge from the native screen — that round trip already exists for every
  // other state change (see the reaction below), so nothing native-side
  // needs to force its own re-render.
  const tapSubscription = DeviceEventEmitter.addListener(
    TAP_EVENT,
    (payload: { category?: TimCategory; timId?: number }) => {
      if (!payload || typeof payload.timId !== 'number' || !payload.category) return;
      dismissedByCategory.set(payload.category, payload.timId);
      push();
    },
  );

  const disposeReaction = reaction(
    () =>
      [
        settingsViewModel.carDisplayAlerts,
        routeViewModel.isNavigating,
        routeViewModel.approachingTimZones,
        routeViewModel.approachingTimZoneDistancesM,
        routeViewModel.insideTimZones,
        timService.nearbyByCategory,
      ] as const,
    push,
    { fireImmediately: true }
  );

  // The reaction above only re-fires on a value change; without this, a
  // badge set that legitimately holds steady goes unpushed past
  // BRIDGE_STALE_MS, and the native screen wrongly reports "Status
  // Unavailable" despite the feed being alive.
  const keepaliveInterval = setInterval(push, KEEPALIVE_INTERVAL_MS);

  return () => {
    disposeReaction();
    clearInterval(keepaliveInterval);
    tapSubscription.remove();
  };
}
