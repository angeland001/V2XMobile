import { NativeModules, Platform } from 'react-native';
import { reaction } from 'mobx';
import { TimService } from '../TIM/services/TimService';
import { RouteViewModel } from '../Route/viewmodels/RouteViewModel';
import { SettingsViewModel } from '../UI/viewmodels/SettingsViewModel';
import { TimCategory } from '../TIM/models/TimTypes';

// Well under TimZoneScreen.kt's BRIDGE_STALE_MS (8000ms), so a badge set that
// holds steady still keeps the native watchdog from flipping to
// "Status Unavailable" between real state changes.
const KEEPALIVE_INTERVAL_MS = 3000;

// A non-inside ("approaching") badge is a brief prompt, not a persistent
// readout: it shows for this long once a zone comes into range, then drops
// off — unless the zone is inside, or within PERSIST_DISTANCE_M of it, in
// which case it stays up until TimService's/RouteViewModel's own dismiss
// rule clears it (the user has left the zone AND is heading away from it).
const APPROACH_DISPLAY_MS = 3000;
const PERSIST_DISTANCE_M = 5;

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

  // Tracks, per category, the approaching (non-inside) zone currently being
  // flash-shown and when it started — drives the APPROACH_DISPLAY_MS window.
  const badgeState = new Map<TimCategory, { timId: number; firstSeenAt: number }>();
  // One pending re-push per category, scheduled to land exactly when that
  // category's flash window elapses — without this, a badge would only get
  // re-evaluated (and hidden) on the next unrelated state change or the next
  // KEEPALIVE_INTERVAL_MS tick, both of which can lag the 3s window.
  const expiryTimers = new Map<TimCategory, NodeJS.Timeout>();

  const clearExpiry = (category: TimCategory): void => {
    const timer = expiryTimers.get(category);
    if (timer) {
      clearTimeout(timer);
      expiryTimers.delete(category);
    }
  };

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

  // Applies the flash/persist lifecycle on top of the raw candidates: inside
  // (or within PERSIST_DISTANCE_M) zones are always shown; a merely
  // approaching zone shows for APPROACH_DISPLAY_MS from when it first
  // appears, then drops out even though the underlying condition may still
  // hold — a brief prompt, not a continuous readout.
  const selectVisibleBadges = (candidates: Partial<Record<TimCategory, CategoryCandidate>>): CarBadge[] => {
    const now = Date.now();
    const badges: CarBadge[] = [];

    for (const category of CATEGORY_ORDER) {
      const candidate = candidates[category];
      if (!candidate) {
        badgeState.delete(category);
        clearExpiry(category);
        continue;
      }

      if (candidate.inside || candidate.distanceM <= PERSIST_DISTANCE_M) {
        badgeState.delete(category);
        clearExpiry(category);
        badges.push(toBadge(category, candidate));
        continue;
      }

      let state = badgeState.get(category);
      if (!state || state.timId !== candidate.timId) {
        state = { timId: candidate.timId, firstSeenAt: now };
        badgeState.set(category, state);
        clearExpiry(category);
        expiryTimers.set(category, setTimeout(push, APPROACH_DISPLAY_MS));
      }

      if (now - state.firstSeenAt < APPROACH_DISPLAY_MS) {
        badges.push(toBadge(category, candidate));
      } else {
        badgeState.delete(category);
      }
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
    for (const category of CATEGORY_ORDER) clearExpiry(category);
  };
}
