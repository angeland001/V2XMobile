// app/src/features/Map/views/components/MapView.tsx

import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import RNMapView, {
  Marker,
  Polygon,
  PROVIDER_GOOGLE,
  type MapType,
} from "react-native-maps";
import { Ionicons } from '@expo/vector-icons';
import { observer } from "mobx-react-lite";
import * as Location from "expo-location";
import { MapViewModel } from "../../viewmodels/MapViewModel";
import { PedestrianDetectorViewModel } from "../../../PedestrianDetector/viewmodels/PedestrianDetectorViewModel";
import { TestingPedestrianDetectorViewModel } from "../../../../testingFeatures/testingPedestrianDetectorFeatureTest/viewmodels/TestingPedestrianDetectorViewModel";
import { VehicleDisplayViewModel } from "../../../SDSM/viewmodels/VehicleDisplayViewModel";
import { DirectionGuideViewModel } from "../../../DirectionGuide/viewModels/DirectionGuideViewModel";
import { TurnGuideDisplay } from "../../../DirectionGuide/views/components/TurnGuideDisplay";
import { SpatViewModel } from "../../../SpatService/viewModels/SpatViewModel";
import { VehicleMarkers } from "../../../SDSM/views/VehicleMarkers";
import { VRUMarkers } from "../../../SDSM/views/VRUMarkers";
import { TestingModeOverlay } from "../../../../testingFeatures/testingUI";
import { LaneOverlay } from "../../../Lanes/views/components/LaneOverlay";
import { LanesViewModel } from "../../../Lanes/viewmodels/LanesViewModel";
import { CROSSWALK_POLYGONS } from "../../../Crosswalk/constants/CrosswalkCoordinates";
import { CrosswalkDetectionService } from "../../../PedestrianDetector/services/CrosswalkDetectionService";
import { TESTING_CONFIG } from "../../../../testingFeatures/TestingConfig";
import { MainViewModel } from "../../../../Main/viewmodels/MainViewModel";

import { MapLegend } from "./MapLegend";
import { MapOverlayMenu } from "./MapOverlayMenu";
import { ZoomControls } from "./mapoverlay/ZoomControls";
import { TrafficLightPanel } from "../../../preemption/components/TrafficLightPanel";
import { PreemptionViewModel } from "../../../preemption/viewModels/PreemptionViewModel";
import { SpatZone, SpatZoneService } from "../../../SpatService/services/SpatZoneService";
import { SignalState } from "../../../SpatService/models/SpatModels";
import { toGooglePath, toGooglePathFlexible } from "../../../../core/maps/coordinates";

// ---------------------------------------------------------------------------
// TIMLayer — renders active TIM zones, colored by category
// ---------------------------------------------------------------------------

const TIM_CATEGORY_STYLES = {
  safety:        { fill: 'rgba(239, 68, 68, 0.25)',  stroke: '#EF4444', icon: 'warning' as const,           iconColor: '#EF4444' },
  regulatory:    { fill: 'rgba(245, 158, 11, 0.25)', stroke: '#F59E0B', icon: 'ban' as const,               iconColor: '#F59E0B' },
  informational: { fill: 'rgba(59, 130, 246, 0.25)', stroke: '#3B82F6', icon: 'information-circle' as const, iconColor: '#3B82F6' },
} as const;

const polygonCentroid = (coords: { latitude: number; longitude: number }[]) => ({
  latitude:  coords.reduce((s, c) => s + c.latitude,  0) / coords.length,
  longitude: coords.reduce((s, c) => s + c.longitude, 0) / coords.length,
});

const DARK_GOOGLE_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#1f2937" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#d1d5db" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#111827" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#374151" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#f3f4f6" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f172a" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#263244" }] },
];

interface TIMLayerProps {
  mainViewModel: MainViewModel | null | undefined;
}

const TIMLayer: React.FC<TIMLayerProps> = observer(({ mainViewModel }) => {
  const tims = mainViewModel?.timService.activeTims;
  if (!tims || tims.length === 0) return null;

  return (
    <>
      {tims.map((tim) => {
        const style = TIM_CATEGORY_STYLES[tim.category] ?? TIM_CATEGORY_STYLES.informational;
        const coordinates = toGooglePathFlexible(tim.geometry.coordinates[0] as [number, number][]);
        const holes = tim.geometry.coordinates
          .slice(1)
          .map((ring) => toGooglePathFlexible(ring as [number, number][]))
          .filter((ring) => ring.length >= 3);
        if (coordinates.length < 3) return null;

        const centroid = polygonCentroid(coordinates);

        return (
          <React.Fragment key={`tim-${tim.id}`}>
            <Polygon
              coordinates={coordinates}
              holes={holes}
              fillColor={style.fill}
              strokeColor={style.stroke}
              strokeWidth={2.5}
            />
            <Marker coordinate={centroid} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
              <View style={{ backgroundColor: 'white', borderRadius: 20, padding: 4, borderWidth: 1.5, borderColor: style.stroke }}>
                <Ionicons name={style.icon} size={20} color={style.iconColor} />
              </View>
            </Marker>
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
          const count = CrosswalkDetectionService.countPedestriansInSpecificCrosswalk(
            vrus,
            index,
          );
          const shape = {
            type: "Feature" as const,
            properties: { crosswalkId: index, name: `Crosswalk ${index + 1}` },
            geometry: {
              type: "Polygon" as const,
              coordinates: [polygonCoords],
            },
          };
          const coordinates = toGooglePath(shape.geometry.coordinates[0]);
          if (coordinates.length < 3) return null;

          return (
            <Polygon
              key={`crosswalk-${index}`}
              coordinates={coordinates}
              fillColor={
                count > 0
                  ? "rgba(255, 59, 48, 0.4)"
                  : "rgba(255, 255, 0, 0.4)"
              }
              strokeColor="#FFCC00"
              strokeWidth={2}
            />
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

        const coordinates = toGooglePathFlexible(zone.polygon);
        if (coordinates.length < 3) return null;

        return (
          <Polygon
            key={`spat-zone-${zone.id}`}
            coordinates={coordinates}
            fillColor={fillColor}
            strokeColor={lineColor}
            strokeWidth={lineWidth}
          />
        );
      })}
    </>
  );
});

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
    const mapRef = useRef<RNMapView>(null);
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
    const [userHeading, setUserHeading] = useState(0);
    const zoomLevelRef = useRef(17);

    const [toastMsg, setToastMsg] = useState<string | null>(null);
    const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
      mapRef.current?.animateCamera({ zoom: zoomLevelRef.current }, { duration: 300 });
    };

    const handleZoomOut = () => {
      zoomLevelRef.current = Math.max(zoomLevelRef.current - 1, 1);
      mapRef.current?.animateCamera({ zoom: zoomLevelRef.current }, { duration: 300 });
    };

    const handleLocateUser = () => {
      if (userPosition[0] !== 0 && userPosition[1] !== 0) {
        mapRef.current?.animateCamera(
          {
            center: { latitude: userPosition[0], longitude: userPosition[1] },
            zoom: 17,
          },
          { duration: 600 },
        );
        zoomLevelRef.current = 17;
      }
    };

    const [mapLayer, setMapLayer] = useState<"outdoors" | "satellite" | "streets">("outdoors");

    const cycleMapLayer = () => {
      setMapLayer((prev) => {
        if (prev === "outdoors") return "satellite";
        if (prev === "satellite") return "streets";
        return "outdoors";
      });
    };

    const GOOGLE_MAP_TYPES: Record<typeof mapLayer, MapType> = {
      outdoors: "terrain",
      satellite: "hybrid",
      streets: "standard",
    };

    const lastCameraUpdate = useRef<number>(0);
    const hasInitialFix = useRef(false);
    const CAMERA_UPDATE_THROTTLE = 100;

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
      const now = Date.now();
      const isFirstFix = !hasInitialFix.current;

      if (!isFirstFix && now - lastCameraUpdate.current < CAMERA_UPDATE_THROTTLE) {
        return;
      }

      lastCameraUpdate.current = now;

      if (mapRef.current && position[0] !== 0 && position[1] !== 0) {
        if (isFirstFix) {
          hasInitialFix.current = true;
          mapRef.current.animateCamera(
            { center: { latitude: position[0], longitude: position[1] }, zoom: 17 },
            { duration: 0 },
          );
        } else {
          mapRef.current.animateCamera(
            { center: { latitude: position[0], longitude: position[1] }, zoom: 17 },
            { duration: 900 },
          );
        }
      }
    };

    const handlePositionUpdate = (
      latitude: number,
      longitude: number,
      heading?: number | null,
    ) => {
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

      const newPosition: [number, number] = [latitude, longitude];

      // Compare and update outside setState to avoid mutating MobX observables
      // inside a React state updater (triggers both a MobX strict-mode violation
      // and the "Cannot update while rendering" React warning).
      if (!arePositionsEqual(userPositionRef.current, newPosition)) {
        userPositionRef.current = newPosition;
        updateAllViewModels(newPosition);
        updateCameraPosition(newPosition);
      }

      setUserPosition(newPosition);

      if (heading != null && heading >= 0) {
        setUserHeading(heading);
      }
    };

    const handleLocationUpdate = (location: Location.LocationObject) => {
      const { latitude, longitude, heading } = location.coords;
      handlePositionUpdate(latitude, longitude, heading);
    };

    // Fallback for Android emulator: watchPositionAsync doesn't always fire for
    // manual Extended Controls location changes, but the Maps SDK callback does.
    const handleMapUserLocationChange = (event: {
      nativeEvent: {
        coordinate?: {
          latitude?: number;
          longitude?: number;
          heading?: number;
        };
      };
    }) => {
      const coordinate = event.nativeEvent.coordinate;
      if (!coordinate?.latitude || !coordinate?.longitude) return;
      handlePositionUpdate(coordinate.latitude, coordinate.longitude, coordinate.heading);
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
      });
    };

    // Poll for active spat zones every second
    useEffect(() => {
      const syncZones = () => setSpatZones(SpatZoneService.getActiveZones());
      syncZones();
      const intervalId = setInterval(syncZones, 1000);
      return () => clearInterval(intervalId);
    }, []);

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

    // Track which spat zone the user is currently in
    useEffect(() => {
      if (userPosition[0] === 0 || userPosition[1] === 0) return;
      const activeZone = SpatZoneService.findZoneForPosition(userPosition);
      setActiveSpatZoneId(activeZone?.id || null);
    }, [userPosition]);

    // Location tracking
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
              timeInterval: 100,
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

    return (
      <View style={styles.container}>
        <MapLegend />
        <ZoomControls
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onLocateUser={handleLocateUser}
        />

        <View style={styles.trafficLightAnchor}>
          <TrafficLightPanel
            autoEnabled={preemptionViewModel.isEnabled}
            onToggleAuto={(enabled) => {
              preemptionViewModel.toggleEnabled(enabled);
              showToast(enabled ? 'Auto preemption armed' : 'Auto preemption disabled');
            }}
            insideZone={preemptionViewModel.insideZone}
            sessionActive={preemptionViewModel.sessionId !== null}
          />
        </View>
        <MapOverlayMenu
          isDarkMode={isDarkMode}
          onToggleDarkMode={() => setIsDarkMode((prev) => !prev)}
          userHeading={userHeading}
          onCycleLayer={cycleMapLayer}
        />

        {toastMsg !== null && (
          <View style={styles.toast} pointerEvents="none">
            <Text style={styles.toastText}>{toastMsg}</Text>
          </View>
        )}

        <RNMapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          mapType={GOOGLE_MAP_TYPES[mapLayer]}
          customMapStyle={isDarkMode ? DARK_GOOGLE_MAP_STYLE : []}
          initialRegion={{
            latitude: 35.0454,
            longitude: -85.3075,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          }}
          showsUserLocation={true}
          showsMyLocationButton={false}
          onUserLocationChange={handleMapUserLocationChange}
          showsCompass={false}
          rotateEnabled={true}
          scrollEnabled={true}
          pitchEnabled={true}
          zoomEnabled={true}
        >
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

          <LaneOverlay lanesViewModel={lanesViewModel} />

          {mainViewModel?.vehicleDisplayViewModel &&
            shouldShowSDSMForViewModel(mainViewModel.vehicleDisplayViewModel) && (
              <VehicleMarkers
                viewModel={mainViewModel.vehicleDisplayViewModel}
              />
            )}

          {testingVehicleDisplayViewModel &&
            shouldShowSDSMForViewModel(testingVehicleDisplayViewModel) && (
              <VehicleMarkers viewModel={testingVehicleDisplayViewModel} />
            )}

          {mainViewModel?.vehicleDisplayViewModel &&
            shouldShowSDSMForViewModel(mainViewModel.vehicleDisplayViewModel) && (
              <VRUMarkers
                vrus={mainViewModel.vehicleDisplayViewModel.vrus}
                isActive={mainViewModel.vehicleDisplayViewModel.isActive}
                getMapCoordinates={mainViewModel.vehicleDisplayViewModel.getMapCoordinates.bind(
                  mainViewModel.vehicleDisplayViewModel,
                )}
              />
            )}

          {testingVehicleDisplayViewModel &&
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
        </RNMapView>

        <TestingModeOverlay
          isTestingMode={isTestingMode}
          testingVehicleDisplayViewModel={testingVehicleDisplayViewModel}
        />

        <TurnGuideDisplay spatViewModel={spatViewModel} />

        {/* Pedestrian warning — isolated observer, re-renders only when
            isVehicleNearPedestrianInCrosswalk changes */}
        <PedestrianWarning activeDetector={activeDetector ?? null} />
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
  trafficLightAnchor: {
    position: 'absolute',
    left: 16,
    bottom: 110,
    zIndex: 100,
  },
  userLocationDotInSpat: {
    backgroundColor: '#F97316',
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
  warningContainer: {
    position: "absolute",
    top: 50,
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
