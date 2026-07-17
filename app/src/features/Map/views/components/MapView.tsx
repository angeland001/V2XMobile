// app/src/features/Map/views/components/MapView.tsx

import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { reaction } from "mobx";
import MapboxGL from "@rnmapbox/maps";
import { Ionicons } from '@expo/vector-icons';
import { observer } from "mobx-react-lite";
import * as Location from "expo-location";
import { MapViewModel } from "../../viewmodels/MapViewModel";
import { PedestrianDetectorViewModel } from "../../../PedestrianDetector/viewmodels/PedestrianDetectorViewModel";
import { TestingPedestrianDetectorViewModel } from "../../../../testingFeatures/testingPedestrianDetectorFeatureTest/viewmodels/TestingPedestrianDetectorViewModel";
import { VehicleDisplayViewModel } from "../../../SDSM/viewmodels/VehicleDisplayViewModel";
import { DirectionGuideViewModel } from "../../../DirectionGuide/viewModels/DirectionGuideViewModel";
import { SpatViewModel } from "../../../SpatService/viewModels/SpatViewModel";
import { VehicleMarkers } from "../../../SDSM/views/VehicleMarkers";
import { VRUMarkers } from "../../../SDSM/views/VRUMarkers";
import { TestingModeOverlay } from "../../../../testingFeatures/testingUI";
import { LaneOverlay } from "../../../Lanes/views/components/LaneOverlay";
import { TrafficLightPanel } from "../../../preemption/components/TrafficLightPanel";
import { LanesViewModel } from "../../../Lanes/viewmodels/LanesViewModel";
import { CROSSWALK_POLYGONS } from "../../../Crosswalk/constants/CrosswalkCoordinates";
import { CrosswalkDetectionService } from "../../../PedestrianDetector/services/CrosswalkDetectionService";
import { TESTING_CONFIG } from "../../../../testingFeatures/TestingConfig";
import { MainViewModel } from "../../../../Main/viewmodels/MainViewModel";

import { MapLegend } from "./MapLegend";
import { MapOverlayMenu } from "./MapOverlayMenu";
import { ZoomControls } from "./mapoverlay/ZoomControls";
import { PreemptionToggle } from "../../../preemption/components/PreemptionToggle";
import { PreemptionViewModel } from "../../../preemption/viewModels/PreemptionViewModel";
import { SpatZone, SpatZoneService } from "../../../SpatService/services/SpatZoneService";
import { SignalState } from "../../../SpatService/models/SpatModels";
import { closeRing, normalizeToLngLat, type LngLat } from "../../../../core/maps/coordinates";
import { NavigationBanner } from "../../../Route/components/NavigationBanner";
import { NavigationSummaryBar } from "../../../Route/components/NavigationSummaryBar";

MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '');

// ---------------------------------------------------------------------------
// TIMLayer — renders active TIM zones, colored by category
// ---------------------------------------------------------------------------

const TIM_CATEGORY_STYLES = {
  safety:        { fill: 'rgba(239, 68, 68, 0.25)',  stroke: '#EF4444', icon: 'warning' as const,            iconColor: '#EF4444', label: 'Safety' },
  regulatory:    { fill: 'rgba(245, 158, 11, 0.25)', stroke: '#F59E0B', icon: 'ban' as const,                iconColor: '#F59E0B', label: 'Regulatory' },
  informational: { fill: 'rgba(59, 130, 246, 0.25)', stroke: '#3B82F6', icon: 'information-circle' as const, iconColor: '#3B82F6', label: 'Info' },
} as const;

const lngLatCentroid = (coords: LngLat[]): [number, number] => [
  coords.reduce((s, c) => s + c[0], 0) / coords.length,
  coords.reduce((s, c) => s + c[1], 0) / coords.length,
];

interface TIMLayerProps {
  mainViewModel: MainViewModel | null | undefined;
}

const TIMLayer: React.FC<TIMLayerProps> = observer(({ mainViewModel }) => {
  const tims = mainViewModel?.timService.activeTims;
  const settings = mainViewModel?.settingsViewModel;
  if (!tims || tims.length === 0) return null;

  const visibleTims = tims.filter((tim) => {
    if (tim.category === 'safety') return settings?.safetyAlerts ?? true;
    if (tim.category === 'regulatory') return settings?.regulatoryAlerts ?? true;
    if (tim.category === 'informational') return settings?.informationalAlerts ?? true;
    return true;
  });

  if (visibleTims.length === 0) return null;

  return (
    <>
      {visibleTims.map((tim) => {
        const style = TIM_CATEGORY_STYLES[tim.category] ?? TIM_CATEGORY_STYLES.informational;
        const rawOuter = tim.geometry.coordinates[0] as [number, number][];
        const outerCoords = rawOuter.map(normalizeToLngLat);
        if (outerCoords.length < 3) return null;

        const outerRing = closeRing(outerCoords);
        const holes = tim.geometry.coordinates
          .slice(1)
          .map((ring) => closeRing((ring as [number, number][]).map(normalizeToLngLat)))
          .filter((ring) => ring.length >= 3);

        const centroid = lngLatCentroid(outerCoords);

        const shape: GeoJSON.Feature<GeoJSON.Polygon> = {
          type: 'Feature',
          properties: {},
          geometry: { type: 'Polygon', coordinates: [outerRing, ...holes] },
        };

        return (
          <React.Fragment key={`tim-${tim.id}`}>
            <MapboxGL.ShapeSource id={`tim-source-${tim.id}`} shape={shape}>
              <MapboxGL.FillLayer
                id={`tim-fill-${tim.id}`}
                style={{ fillColor: style.fill }}
              />
              <MapboxGL.LineLayer
                id={`tim-line-${tim.id}`}
                style={{ lineColor: style.stroke, lineWidth: 2.5 }}
              />
            </MapboxGL.ShapeSource>
            <MapboxGL.MarkerView key={`tim-marker-${tim.id}`} coordinate={centroid}>
              <View style={[styles.timMarker, { borderColor: style.stroke }]}>
                <Ionicons name={style.icon} size={14} color={style.iconColor} />
                <Text style={[styles.timMarkerLabel, { color: style.iconColor }]}>{style.label}</Text>
              </View>
            </MapboxGL.MarkerView>
          </React.Fragment>
        );
      })}
    </>
  );
});

// ---------------------------------------------------------------------------
// CrosswalkLayer — own observer so it only re-renders when VRUs change (1Hz)
// ---------------------------------------------------------------------------

interface CrosswalkLayerProps {
  vehicleDisplayVM: VehicleDisplayViewModel | null;
  testingPedestrianVM: TestingPedestrianDetectorViewModel | null;
  show: boolean;
}

const CrosswalkLayer: React.FC<CrosswalkLayerProps> = observer(
  ({ vehicleDisplayVM, testingPedestrianVM, show }) => {
    if (!show) return null;

    const vrus: { coordinates: [number, number] }[] = [];
    if (TESTING_CONFIG.ENABLE_SDSM_API && vehicleDisplayVM?.vrus) {
      vrus.push(...vehicleDisplayVM.vrus);
    }
    if (TESTING_CONFIG.SHOW_FIXED_PEDESTRIAN && testingPedestrianVM?.vrus) {
      vrus.push(...testingPedestrianVM.vrus);
    }

    return (
      <>
        {CROSSWALK_POLYGONS.map((polygonCoords, index) => {
          const count = CrosswalkDetectionService.countPedestriansInSpecificCrosswalk(vrus, index);
          const ring = closeRing(polygonCoords);
          if (ring.length < 3) return null;

          const shape: GeoJSON.Feature<GeoJSON.Polygon> = {
            type: 'Feature',
            properties: {},
            geometry: { type: 'Polygon', coordinates: [ring] },
          };

          return (
            <MapboxGL.ShapeSource key={`crosswalk-source-${index}`} id={`crosswalk-source-${index}`} shape={shape}>
              <MapboxGL.FillLayer
                id={`crosswalk-fill-${index}`}
                style={{
                  fillColor: count > 0 ? 'rgba(255, 59, 48, 0.4)' : 'rgba(255, 255, 0, 0.4)',
                }}
              />
              <MapboxGL.LineLayer
                id={`crosswalk-line-${index}`}
                style={{ lineColor: '#FFCC00', lineWidth: 2 }}
              />
            </MapboxGL.ShapeSource>
          );
        })}
      </>
    );
  },
);

// ---------------------------------------------------------------------------
// PedestrianWarning — own observer so it only re-renders when detector state
// changes, not on every heading/position update
// ---------------------------------------------------------------------------

type AnyDetector =
  | PedestrianDetectorViewModel
  | TestingPedestrianDetectorViewModel;

interface PedestrianWarningProps {
  activeDetector: AnyDetector | null;
}

const PedestrianWarning: React.FC<PedestrianWarningProps> = observer(
  ({ activeDetector }) => {
    if (!activeDetector?.isVehicleNearPedestrianInCrosswalk) return null;
    return (
      <View style={styles.warningContainer}>
        <Text style={styles.warningText}>
          ⚠️ Pedestrian crossing detected ahead!
        </Text>
      </View>
    );
  },
);

// ---------------------------------------------------------------------------
// SpatZoneLayer — renders zone polygons on the map, colored by signal state
// ---------------------------------------------------------------------------

interface SpatZoneLayerProps {
  zones: SpatZone[];
  activeSpatZoneId: string | null;
  spatViewModel: SpatViewModel;
}

const SpatZoneLayer: React.FC<SpatZoneLayerProps> = observer(({ zones, activeSpatZoneId, spatViewModel }) => {
  return (
    <>
      {zones.map((zone) => {
        const isActive = zone.id === activeSpatZoneId;

        let fillColor: string;
        let lineColor: string;
        let lineWidth: number;

        if (isActive) {
          switch (spatViewModel.signalState) {
            case SignalState.GREEN:
              fillColor = 'rgba(34, 197, 94, 0.22)';
              lineColor = '#22c55e';
              break;
            case SignalState.RED:
              fillColor = 'rgba(239, 68, 68, 0.22)';
              lineColor = '#ef4444';
              break;
            case SignalState.YELLOW:
              fillColor = 'rgba(234, 179, 8, 0.22)';
              lineColor = '#eab308';
              break;
            default:
              fillColor = 'rgba(255, 140, 0, 0.15)';
              lineColor = '#FF8C00';
          }
          lineWidth = 2.5;
        } else {
          fillColor = 'rgba(59, 130, 246, 0.08)';
          lineColor = 'rgba(59, 130, 246, 0.45)';
          lineWidth = 1.5;
        }

        // zone.polygon is already LngLat[] — close the ring for GeoJSON
        const ring = closeRing(zone.polygon as LngLat[]);
        if (ring.length < 3) return null;

        const shape: GeoJSON.Feature<GeoJSON.Polygon> = {
          type: 'Feature',
          properties: {},
          geometry: { type: 'Polygon', coordinates: [ring] },
        };

        return (
          <MapboxGL.ShapeSource key={`spat-source-${zone.id}`} id={`spat-source-${zone.id}`} shape={shape}>
            <MapboxGL.FillLayer
              id={`spat-fill-${zone.id}`}
              style={{ fillColor }}
            />
            <MapboxGL.LineLayer
              id={`spat-line-${zone.id}`}
              style={{ lineColor, lineWidth }}
            />
          </MapboxGL.ShapeSource>
        );
      })}
    </>
  );
});

// ---------------------------------------------------------------------------
// RouteLayer — renders the active route polyline above TIM zones
// ---------------------------------------------------------------------------

interface RouteLayerProps {
  mainViewModel: MainViewModel | null | undefined;
}

const RouteLayer: React.FC<RouteLayerProps> = observer(({ mainViewModel }) => {
  const routeVM = mainViewModel?.routeViewModel;
  if (!routeVM?.hasActiveRoute || routeVM.routeCoordinates.length < 2) return null;

  // While navigating, draw only the portion of the route still ahead of the
  // user — the traveled portion behind them drops off as they pass it.
  // During preview/overview (not yet navigating) show the full route.
  const displayCoordinates = routeVM.isNavigating
    ? routeVM.remainingRouteCoordinates
    : routeVM.routeCoordinates;
  if (displayCoordinates.length < 2) return null;

  const shape: GeoJSON.Feature<GeoJSON.LineString> = {
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: displayCoordinates },
  };

  return (
    <MapboxGL.ShapeSource id="route-source" shape={shape}>
      <MapboxGL.LineLayer
        id="route-casing"
        style={{ lineColor: '#1A1A2E', lineWidth: 8, lineOpacity: 0.25, lineCap: 'round', lineJoin: 'round' }}
      />
      <MapboxGL.LineLayer
        id="route-line"
        style={{ lineColor: '#FF8C00', lineWidth: 5, lineOpacity: 0.9, lineCap: 'round', lineJoin: 'round' }}
      />
    </MapboxGL.ShapeSource>
  );
});

const DestinationMarker: React.FC<{ mainViewModel: MainViewModel | null | undefined }> = observer(({ mainViewModel }) => {
  const routeVM = mainViewModel?.routeViewModel;
  if (!routeVM?.hasActiveRoute || !routeVM.toCoord) return null;
  return (
    <MapboxGL.MarkerView
      coordinate={routeVM.toCoord}
      anchor={{ x: 0.5, y: 1 }}
    >
      <View style={destPinStyles.container}>
        {!!routeVM.toLabel && (
          <View style={destPinStyles.label}>
            <Text style={destPinStyles.labelText} numberOfLines={1}>{routeVM.toLabel}</Text>
          </View>
        )}
        <View style={destPinStyles.circle}>
          <Ionicons name="flag-sharp" size={20} color="#fff" />
        </View>
        <View style={destPinStyles.pole} />
      </View>
    </MapboxGL.MarkerView>
  );
});

const destPinStyles = StyleSheet.create({
  container: { alignItems: 'center' },
  label: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 4,
    maxWidth: 150,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  labelText: {
    color: '#1A1A2E',
    fontSize: 11,
    fontWeight: '700',
  },
  circle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF8C00',
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.45,
    shadowRadius: 6,
    elevation: 8,
  },
  pole: { width: 4, height: 18, backgroundColor: '#FF8C00' },
});

// ---------------------------------------------------------------------------
// Map style URLs
// ---------------------------------------------------------------------------

const MAPBOX_STYLES = {
  outdoors: MapboxGL.StyleURL.Outdoors,
  satellite: MapboxGL.StyleURL.SatelliteStreet,
  streets: MapboxGL.StyleURL.Street,
} as const;

// How far bottom UI elements shift up to clear the NavigationSummaryBar
const NAV_SUMMARY_OFFSET = 70;

// Ease duration for the per-fix nav camera follow update. Longer than the
// 50ms throttle interval so each new setCamera call overrides the previous
// easing in flight (continuous smooth motion) instead of snapping.
const CAMERA_FOLLOW_EASE_MS = 300;

// ---------------------------------------------------------------------------
// Main MapViewComponent
// ---------------------------------------------------------------------------

interface MapViewProps {
  mapViewModel: MapViewModel;
  pedestrianDetectorViewModel?: PedestrianDetectorViewModel | null;
  testingPedestrianDetectorViewModel?: TestingPedestrianDetectorViewModel | null;
  testingVehicleDisplayViewModel: VehicleDisplayViewModel | null;
  directionGuideViewModel: DirectionGuideViewModel;
  isTestingMode: boolean;
  mainViewModel?: MainViewModel;
  spatViewModel?: SpatViewModel;
  lanesViewModel?: LanesViewModel;
  children?: React.ReactNode;
}

export const MapViewComponent: React.FC<MapViewProps> = observer(
  ({
    mapViewModel,
    pedestrianDetectorViewModel,
    testingPedestrianDetectorViewModel,
    testingVehicleDisplayViewModel,
    directionGuideViewModel,
    isTestingMode,
    mainViewModel,
    spatViewModel: providedSpatViewModel,
    lanesViewModel: providedLanesViewModel,
    children,
  }) => {
    const cameraRef = useRef<MapboxGL.Camera>(null);
    const spatViewModelRef = useRef<SpatViewModel>(new SpatViewModel());
    const lanesViewModelRef = useRef<LanesViewModel>(new LanesViewModel());
    const preemptionViewModelRef = useRef<PreemptionViewModel>(new PreemptionViewModel());

    const spatViewModel = providedSpatViewModel || spatViewModelRef.current;
    const lanesViewModel = providedLanesViewModel || lanesViewModelRef.current;
    const preemptionViewModel = preemptionViewModelRef.current;

    const [userPosition, setUserPosition] = useState<[number, number]>([
      mapViewModel.userLocation.latitude,
      mapViewModel.userLocation.longitude,
    ]);
    const userPositionRef = useRef<[number, number]>([
      mapViewModel.userLocation.latitude,
      mapViewModel.userLocation.longitude,
    ]);
    const [spatZones, setSpatZones] = useState<SpatZone[]>(() => SpatZoneService.getActiveZones());
    const [activeSpatZoneId, setActiveSpatZoneId] = useState<string | null>(null);

    const [isDarkMode, setIsDarkMode] = useState(false);
    const [navBannerHeight, setNavBannerHeight] = useState(130);
    const userHeadingRef = useRef(0);
    const userSpeedRef = useRef<number | null>(null);
    const [isNavigating, setIsNavigating] = useState(false);
    const [isUserPanningAway, setIsUserPanningAway] = useState(false);
    const zoomLevelRef = useRef(17);

    const [mapLayer, setMapLayer] = useState<"outdoors" | "satellite" | "streets">("satellite");

    const [toastMsg, setToastMsg] = useState<string | null>(null);
    const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const showToast = useCallback((msg: string) => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      setToastMsg(msg);
      toastTimeoutRef.current = setTimeout(() => setToastMsg(null), 2000);
    }, []);

    useEffect(() => () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    }, []);

    const handleZoomIn = () => {
      zoomLevelRef.current = Math.min(zoomLevelRef.current + 1, 22);
      cameraRef.current?.setCamera({ zoomLevel: zoomLevelRef.current, animationDuration: 300 });
    };

    const handleZoomOut = () => {
      zoomLevelRef.current = Math.max(zoomLevelRef.current - 1, 1);
      cameraRef.current?.setCamera({ zoomLevel: zoomLevelRef.current, animationDuration: 300 });
    };

    const handleLocateUser = () => {
      if (userPosition[0] !== 0 && userPosition[1] !== 0) {
        isFollowingUser.current = true;
        setIsUserPanningAway(false);
        mainViewModel?.routeViewModel?.isOverviewMode &&
          mainViewModel.routeViewModel.toggleOverviewMode();
        const navigating = mainViewModel?.routeViewModel?.isNavigating ?? false;
        const lngLat: [number, number] = [userPosition[1], userPosition[0]];
        const brg = navigating
          ? (mainViewModel?.routeViewModel?.getRouteBearing(lngLat) ?? userHeadingRef.current)
          : 0;
        cameraRef.current?.setCamera({
          centerCoordinate: lngLat,
          zoomLevel: 17,
          animationDuration: 600,
          ...(navigating ? { pitch: 45, heading: brg } : { pitch: 0, heading: 0 }),
        });
        zoomLevelRef.current = 17;
      }
    };

    const handleRegionIsChanging = (feature: GeoJSON.Feature) => {
      if ((feature.properties as any)?.isUserInteraction) {
        isFollowingUser.current = false;
        setIsUserPanningAway(true);
      }
    };

    const cycleMapLayer = () => {
      setMapLayer((prev) => {
        if (prev === "outdoors") return "satellite";
        if (prev === "satellite") return "streets";
        return "outdoors";
      });
    };

    const styleURL = isDarkMode ? MapboxGL.StyleURL.Dark : MAPBOX_STYLES[mapLayer];

    const lastCameraUpdate = useRef<number>(0);
    const lastStateUpdate = useRef<number>(0);
    const hasInitialFix = useRef(false);
    const isFollowingUser = useRef(false);

    const activeDetector = isTestingMode
      ? testingPedestrianDetectorViewModel
      : pedestrianDetectorViewModel;
    const SHOW_SDSM_VEHICLES = true;

    const shouldShowSDSMForViewModel = (
      viewModel: VehicleDisplayViewModel,
    ): boolean => {
      return SHOW_SDSM_VEHICLES && TESTING_CONFIG.ENABLE_SDSM_API;
    };

    const vehicleDisplayVM =
      mainViewModel?.vehicleDisplayViewModel || testingVehicleDisplayViewModel;

    const arePositionsEqual = (a: [number, number], b: [number, number]) =>
      Math.abs(a[0] - b[0]) < 0.000001 && Math.abs(a[1] - b[1]) < 0.000001;

    const updateCameraPosition = (position: [number, number]) => {
      // position is [lat, lng]; Mapbox centerCoordinate is [lng, lat]
      if (position[0] === 0 && position[1] === 0) return;

      if (!hasInitialFix.current) {
        hasInitialFix.current = true;
        isFollowingUser.current = true;
        const navigatingNow = mainViewModel?.routeViewModel?.isNavigating ?? false;
        const lngLat: [number, number] = [position[1], position[0]];
        const brg = navigatingNow
          ? (mainViewModel?.routeViewModel?.getRouteBearing(lngLat) ?? userHeadingRef.current)
          : undefined;
        cameraRef.current?.setCamera({
          centerCoordinate: lngLat,
          zoomLevel: navigatingNow ? 19 : 17,
          animationDuration: 0,
          ...(navigatingNow ? { pitch: 45, heading: brg } : {}),
        });
        return;
      }

      // Don't fight the camera while user is in overview mode
      if (mainViewModel?.routeViewModel?.isOverviewMode) return;

      if (!isFollowingUser.current) return;

      const now = Date.now();
      if (now - lastCameraUpdate.current < 50) return; // 20 Hz cap
      lastCameraUpdate.current = now;

      const navigating = mainViewModel?.routeViewModel?.isNavigating ?? false;
      const routeBearing = navigating
        ? (mainViewModel?.routeViewModel?.getRouteBearing([position[1], position[0]]) ?? userHeadingRef.current)
        : undefined;
      cameraRef.current?.setCamera({
        centerCoordinate: [position[1], position[0]],
        // Ease toward each new fix instead of snapping — a zero duration here
        // was the main cause of the following camera looking jittery/uncentered,
        // since position, pitch, and heading all teleported on every GPS update.
        animationDuration: CAMERA_FOLLOW_EASE_MS,
        ...(navigating ? { pitch: 45, heading: routeBearing } : {}),
      });
    };

    const handlePositionUpdate = (
      latitude: number,
      longitude: number,
      heading?: number | null,
      speed?: number | null,
    ) => {
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

      const newPosition: [number, number] = [latitude, longitude];

      if (speed != null && speed >= 0) {
        userSpeedRef.current = speed;
      }

      // Camera: full 20 Hz, never triggers a React re-render
      updateCameraPosition(newPosition);

      // ViewModels: only on meaningful movement
      if (!arePositionsEqual(userPositionRef.current, newPosition)) {
        userPositionRef.current = newPosition;
        updateAllViewModels(newPosition);
      }

      // React state (re-render): throttled to 5 Hz
      const now = Date.now();
      if (now - lastStateUpdate.current >= 200) {
        lastStateUpdate.current = now;
        setUserPosition(newPosition);
      }

      if (heading != null && heading >= 0) {
        userHeadingRef.current = heading;
      }
    };

    const handleLocationUpdate = (location: Location.LocationObject) => {
      const { latitude, longitude, heading, speed } = location.coords;
      handlePositionUpdate(latitude, longitude, heading, speed);
    };

    // Mapbox UserLocation callback — serves the same role as onUserLocationChange
    // in react-native-maps (fallback for Android emulator GPS updates)
    const handleMapboxLocationUpdate = (location: MapboxGL.Location) => {
      const { latitude, longitude, heading, speed } = location.coords;
      if (!latitude || !longitude) return;
      handlePositionUpdate(latitude, longitude, heading ?? null, speed ?? null);
    };

    const updateAllViewModels = (position: [number, number]) => {
      directionGuideViewModel.setVehiclePosition(position);
      spatViewModel.setUserPosition(position);

      if (activeDetector && "setVehiclePosition" in activeDetector) {
        activeDetector.setVehiclePosition(position);
      }

      mapViewModel.setUserLocation({
        latitude: position[0],
        longitude: position[1],
        heading: undefined,
        speed: userSpeedRef.current ?? undefined,
      });

      // Off-route detection + step progress on every meaningful GPS update
      const lngLat: [number, number] = [position[1], position[0]];
      mainViewModel?.routeViewModel?.checkOffRoute(lngLat);
      mainViewModel?.routeViewModel?.updateProgress(lngLat);
    };

    // Poll for active spat zones every second
    useEffect(() => {
      const syncZones = () => setSpatZones(SpatZoneService.getActiveZones());
      syncZones();
      const intervalId = setInterval(syncZones, 1000);
      return () => clearInterval(intervalId);
    }, []);

    // React to navigation mode changes
    useEffect(() => {
      const routeVM = mainViewModel?.routeViewModel;
      if (!routeVM) return;

      const applyNavCamera = () => {
        isFollowingUser.current = true;
        setIsUserPanningAway(false);
        const lngLat: [number, number] = [userPositionRef.current[1], userPositionRef.current[0]];
        if (lngLat[0] === 0 && lngLat[1] === 0) return;
        const brg = routeVM.getRouteBearing(lngLat) ?? userHeadingRef.current;
        cameraRef.current?.setCamera({
          centerCoordinate: lngLat,
          zoomLevel: 19,
          pitch: 45,
          heading: brg,
          animationDuration: 800,
        });
      };

      // Apply immediately if navigation was already active when this effect runs
      // (e.g. map tab opened after startNavigation() was called from Route tab)
      if (routeVM.isNavigating) {
        setIsNavigating(true);
        applyNavCamera();
      }

      return reaction(
        () => routeVM.isNavigating,
        (navigating) => {
          setIsNavigating(navigating);
          if (navigating) {
            applyNavCamera();
          } else {
            isFollowingUser.current = false;
            cameraRef.current?.setCamera({ pitch: 0, heading: 0, animationDuration: 600 });
          }
        },
      );
    }, [mainViewModel]);

    // React to overview mode toggle
    useEffect(() => {
      const routeVM = mainViewModel?.routeViewModel;
      if (!routeVM) return;
      return reaction(
        () => routeVM.isOverviewMode,
        (overview) => {
          if (overview) {
            const coords = routeVM.routeCoordinates;
            if (coords.length < 2) return;
            const lngs = coords.map(c => c[0]);
            const lats = coords.map(c => c[1]);
            cameraRef.current?.fitBounds(
              [Math.max(...lngs), Math.max(...lats)],
              [Math.min(...lngs), Math.min(...lats)],
              [80, 50, 80, 50],
              900,
            );
          } else {
            isFollowingUser.current = true;
            const lngLat: [number, number] = [userPositionRef.current[1], userPositionRef.current[0]];
            const brg = routeVM.getRouteBearing(lngLat) ?? userHeadingRef.current;
            cameraRef.current?.setCamera({
              centerCoordinate: lngLat,
              zoomLevel: 19,
              pitch: 45,
              heading: brg,
              animationDuration: 900,
            });
          }
        },
      );
    }, [mainViewModel]);

    // Auto-zoom: smoothly adjust zoom as distance to next maneuver changes
    useEffect(() => {
      const routeVM = mainViewModel?.routeViewModel;
      if (!routeVM) return;
      let lastAutoZoom = 17;
      return reaction(
        () => ({
          dist: routeVM.distanceToNextManeuver,
          navigating: routeVM.isNavigating,
          overview: routeVM.isOverviewMode,
        }),
        ({ dist, navigating, overview }) => {
          if (!navigating || overview || !isFollowingUser.current) return;
          const target = dist < 80 ? 20.5 : dist < 200 ? 20 : dist < 400 ? 19.5 : 19;
          if (target !== lastAutoZoom) {
            lastAutoZoom = target;
            zoomLevelRef.current = target;
            cameraRef.current?.setCamera({ zoomLevel: target, animationDuration: 400 });
          }
        },
      );
    }, [mainViewModel]);

    // React to arrival
    useEffect(() => {
      const routeVM = mainViewModel?.routeViewModel;
      if (!routeVM) return;
      return reaction(
        () => routeVM.hasArrived,
        (arrived) => {
          if (arrived) {
            cameraRef.current?.setCamera({ pitch: 0, heading: 0, animationDuration: 800 });
          }
        },
      );
    }, [mainViewModel]);

    // Cleanup preemption view model on unmount
    useEffect(() => {
      return () => {
        preemptionViewModel.destroy();
      };
    }, [preemptionViewModel]);

    // Keep preemption view model in sync with position and zones
    useEffect(() => {
      preemptionViewModel.syncPosition(userPosition, spatZones);
    }, [preemptionViewModel, userPosition, spatZones]);

    // Bias zone detection toward zones the planned route actually passes through
    const routePreemptionHits = mainViewModel?.routeViewModel?.preemptionHits;
    const routeHasActiveRoute = mainViewModel?.routeViewModel?.hasActiveRoute;
    useEffect(() => {
      const preferredZoneIds =
        routeHasActiveRoute && routePreemptionHits && routePreemptionHits.length > 0
          ? routePreemptionHits.map((h) => h.zoneId)
          : [];
      spatViewModel.setPreferredZoneIds(preferredZoneIds);
    }, [spatViewModel, routeHasActiveRoute, routePreemptionHits]);

    // Track which spat zone the user is currently in
    useEffect(() => {
      if (userPosition[0] === 0 || userPosition[1] === 0) return;
      const preferredZoneIds =
        routeHasActiveRoute && routePreemptionHits && routePreemptionHits.length > 0
          ? routePreemptionHits.map((h) => h.zoneId)
          : undefined;
      const activeZone = SpatZoneService.findZoneForPosition(userPosition, preferredZoneIds);
      setActiveSpatZoneId(activeZone?.id || null);
    }, [userPosition, routeHasActiveRoute, routePreemptionHits]);

    // Location tracking via expo-location (primary)
    useEffect(() => {
      let locationSubscription: Location.LocationSubscription;

      const setupLocationTracking = async () => {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== "granted") {
            return;
          }
          const servicesEnabled = await Location.hasServicesEnabledAsync();
          if (!servicesEnabled) {
            return;
          }
          mapViewModel.startHeadingTracking();

          try {
            const currentLocation = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.BestForNavigation,
            });
            handleLocationUpdate(currentLocation);
          } catch {
            // Continue with watch/poll fallback.
          }

          locationSubscription = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.BestForNavigation,
              distanceInterval: 0,
              timeInterval: 50,
            },
            handleLocationUpdate,
          );

          if (activeDetector && "startMonitoring" in activeDetector) {
            activeDetector.startMonitoring();
          }
        } catch {
          // Silent
        }
      };

      setupLocationTracking();

      return () => {
        if (locationSubscription) {
          locationSubscription.remove();
        }
        mapViewModel.stopHeadingTracking();
        if (activeDetector && "stopMonitoring" in activeDetector) {
          activeDetector.stopMonitoring();
        }
      };
    }, [
      directionGuideViewModel,
      activeDetector,
      mapViewModel,
      isTestingMode,
      spatViewModel,
    ]);

    // Feed combined VRU data into the active detector whenever it changes
    useEffect(() => {
      if (!activeDetector) return;

      const vrus: any[] = [];

      if (TESTING_CONFIG.ENABLE_SDSM_API && vehicleDisplayVM?.vrus) {
        vrus.push(...vehicleDisplayVM.vrus);
      }

      if (
        TESTING_CONFIG.SHOW_FIXED_PEDESTRIAN &&
        testingPedestrianDetectorViewModel?.vrus
      ) {
        vrus.push(...testingPedestrianDetectorViewModel.vrus);
      }

      activeDetector.updateVRUData(vrus);
    }, [
      activeDetector,
      vehicleDisplayVM?.vrus,
      testingPedestrianDetectorViewModel?.vrus,
    ]);

    const routeVM = mainViewModel?.routeViewModel;

    return (
      <View style={styles.container}>
        {/* Navigation overlays — rendered outside the MapboxGL.MapView so they sit on top */}
        {routeVM && (
          <NavigationBanner
            routeViewModel={routeVM}
            onBannerLayout={(height) => {
              setNavBannerHeight(height);
              routeVM.setNavBannerHeightPx(height);
            }}
          />
        )}

        <MapLegend navOffset={isNavigating ? navBannerHeight : 0} />
        <ZoomControls
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onLocateUser={handleLocateUser}
          navOffset={isNavigating ? NAV_SUMMARY_OFFSET : 0}
        />

        <PreemptionToggle
          enabled={preemptionViewModel.isEnabled}
          onToggle={(enabled) => { preemptionViewModel.toggleEnabled(enabled); }}
          navOffset={isNavigating ? navBannerHeight : 0}
        />
        <MapOverlayMenu
          isDarkMode={isDarkMode}
          onToggleDarkMode={() => setIsDarkMode((prev) => !prev)}
          onCycleLayer={cycleMapLayer}
          navOffset={isNavigating ? navBannerHeight : 0}
        />

        {toastMsg !== null && (
          <View style={styles.toast} pointerEvents="none">
            <Text style={styles.toastText}>{toastMsg}</Text>
          </View>
        )}

        {/* Recenter button — appears when user pans away during navigation */}
        {isNavigating && isUserPanningAway && (
          <TouchableOpacity
            style={styles.recenterBtn}
            onPress={handleLocateUser}
            activeOpacity={0.85}
          >
            <Ionicons name="locate" size={18} color="#fff" />
            <Text style={styles.recenterText}>Recenter</Text>
          </TouchableOpacity>
        )}

        <MapboxGL.MapView
          style={styles.map}
          styleURL={styleURL}
          rotateEnabled={true}
          scrollEnabled={true}
          pitchEnabled={true}
          zoomEnabled={true}
          compassEnabled={false}
          logoEnabled={false}
          attributionEnabled={false}
          onRegionIsChanging={handleRegionIsChanging}
        >
          <MapboxGL.Camera
            ref={cameraRef}
            defaultSettings={{
              centerCoordinate: [-85.3075, 35.0454],
              zoomLevel: 17,
            }}
          />

          {/* Built-in user location puck; onUpdate fires on every GPS update
              (fallback for Android emulator Extended Controls changes) */}
          <MapboxGL.UserLocation
            visible={true}
            onUpdate={handleMapboxLocationUpdate}
          />

          {/* Crosswalk polygons — isolated observer, re-renders only when VRUs change */}
          <CrosswalkLayer
            vehicleDisplayVM={vehicleDisplayVM ?? null}
            testingPedestrianVM={testingPedestrianDetectorViewModel ?? null}
            show={mapViewModel.showCrosswalkPolygon}
          />

          <SpatZoneLayer
            zones={spatZones}
            activeSpatZoneId={activeSpatZoneId}
            spatViewModel={spatViewModel}
          />

          <TIMLayer mainViewModel={mainViewModel} />

          <RouteLayer mainViewModel={mainViewModel} />
          <DestinationMarker mainViewModel={mainViewModel} />

          {(mainViewModel?.settingsViewModel?.showLanes ?? true) && (
            <LaneOverlay lanesViewModel={lanesViewModel} />
          )}

          {(mainViewModel?.settingsViewModel?.showVehicles ?? true) && mainViewModel?.vehicleDisplayViewModel &&
            shouldShowSDSMForViewModel(mainViewModel.vehicleDisplayViewModel) && (
              <VehicleMarkers
                viewModel={mainViewModel.vehicleDisplayViewModel}
              />
            )}

          {(mainViewModel?.settingsViewModel?.showVehicles ?? true) && testingVehicleDisplayViewModel &&
            shouldShowSDSMForViewModel(testingVehicleDisplayViewModel) && (
              <VehicleMarkers viewModel={testingVehicleDisplayViewModel} />
            )}

          {(mainViewModel?.settingsViewModel?.showVehicles ?? true) && mainViewModel?.vehicleDisplayViewModel &&
            shouldShowSDSMForViewModel(mainViewModel.vehicleDisplayViewModel) && (
              <VRUMarkers
                vrus={mainViewModel.vehicleDisplayViewModel.vrus}
                isActive={mainViewModel.vehicleDisplayViewModel.isActive}
                getMapCoordinates={mainViewModel.vehicleDisplayViewModel.getMapCoordinates.bind(
                  mainViewModel.vehicleDisplayViewModel,
                )}
              />
            )}

          {(mainViewModel?.settingsViewModel?.showVehicles ?? true) && testingVehicleDisplayViewModel &&
            shouldShowSDSMForViewModel(testingVehicleDisplayViewModel) && (
              <VRUMarkers
                vrus={testingVehicleDisplayViewModel.vrus}
                isActive={testingVehicleDisplayViewModel.isActive}
                getMapCoordinates={testingVehicleDisplayViewModel.getMapCoordinates.bind(
                  testingVehicleDisplayViewModel,
                )}
              />
            )}

          {TESTING_CONFIG.SHOW_FIXED_PEDESTRIAN &&
            testingPedestrianDetectorViewModel && (
              <VRUMarkers
                vrus={testingPedestrianDetectorViewModel.vrus}
                isActive={true}
                getMapCoordinates={(vru) => [
                  vru.coordinates[1],
                  vru.coordinates[0],
                ]}
              />
            )}

          {children}
        </MapboxGL.MapView>

        <TestingModeOverlay
          isTestingMode={isTestingMode}
          testingVehicleDisplayViewModel={testingVehicleDisplayViewModel}
        />

        <TrafficLightPanel
          ssmStatus={preemptionViewModel.displaySsmStatus}
          intersectionName={preemptionViewModel.displayActiveZoneName ?? undefined}
          heartbeatPulse={preemptionViewModel.heartbeatProgress}
          durationLabel={spatViewModel.displayPhaseDurationLabel}
          // Suppress the "unavailable" alert whenever the controller-light
          // fallback below has something to show instead — a colored light
          // next to an "unavailable" label would be a contradiction.
          spatUnavailable={spatViewModel.displaySpatUnavailable && preemptionViewModel.controllerLight === null}
          phaseMismatch={preemptionViewModel.phaseMismatch}
          requestedSignalGroup={preemptionViewModel.displayRequestedSignalGroup}
          controllerSignalState={preemptionViewModel.displayControllerSignalState}
          activeLight={
            spatViewModel.displaySignalState === SignalState.GREEN ? 'green' :
            spatViewModel.displaySignalState === SignalState.RED ? 'red' :
            spatViewModel.displaySignalState === SignalState.YELLOW ? 'yellow' :
            // No live CUIP color right now — whether that's because this
            // intersection has no CUIP coverage at all (e.g. Lab_Device data
            // that hasn't arrived) or a transient corridor gap, the preempt
            // bridge's own live controller reading is a legitimate signal any
            // time a preemption session has one. Prefer it over showing nothing.
            preemptionViewModel.controllerLight
          }
          navOffset={isNavigating ? NAV_SUMMARY_OFFSET : 0}
        />

        <PedestrianWarning activeDetector={activeDetector ?? null} />

        {routeVM && (
          <NavigationSummaryBar
            routeViewModel={routeVM}
            onOverviewToggle={() => routeVM.toggleOverviewMode()}
          />
        )}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  timMarker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'white',
    borderRadius: 12,
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderWidth: 1.5,
  },
  timMarkerLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  toast: {
    position: 'absolute',
    bottom: 180,
    alignSelf: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 999,
    zIndex: 2000,
  },
  toastText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  recenterBtn: {
    position: 'absolute',
    bottom: 160,
    alignSelf: 'center',
    backgroundColor: '#FF8C00',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    zIndex: 2500,
    shadowColor: '#FF8C00',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 6,
  },
  recenterText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  warningContainer: {
    position: "absolute",
    top: 110,  // below NavigationBanner when navigating
    left: 20,
    right: 20,
    backgroundColor: "rgba(255, 59, 48, 0.9)",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  warningText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
    textAlign: "center",
  },
});

export default MapViewComponent;
