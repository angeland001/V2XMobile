// app/src/features/Map/views/components/MapView.tsx

import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MapboxGL from "@rnmapbox/maps";
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
import { SearchBar } from "./SearchBar";
import { ZoomControls } from "./mapoverlay/ZoomControls";
import { TrafficLightPanel } from "../../../preemption/components/TrafficLightPanel";

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
          return (
            <MapboxGL.ShapeSource
              key={`crosswalk-${index}`}
              id={`crosswalk-polygon-source-${index}`}
              shape={shape}
            >
              <MapboxGL.FillLayer
                id={`crosswalk-polygon-fill-${index}`}
                style={{
                  fillColor:
                    count > 0
                      ? "rgba(255, 59, 48, 0.4)"
                      : "rgba(255, 255, 0, 0.4)",
                  fillOutlineColor: "#FFCC00",
                }}
              />
              <MapboxGL.LineLayer
                id={`crosswalk-polygon-outline-${index}`}
                style={{ lineColor: "#FFCC00", lineWidth: 2 }}
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

export const MapViewComponent: React.FC<MapViewProps> = observer(({
  mapViewModel,
  pedestrianDetectorViewModel,
  testingPedestrianDetectorViewModel,
  testingVehicleDisplayViewModel,
  directionGuideViewModel,
  isTestingMode,
  mainViewModel,
  spatViewModel: providedSpatViewModel,
  lanesViewModel: providedLanesViewModel,
  children
}) => {
  const mapRef = useRef<MapboxGL.MapView>(null);
  const cameraRef = useRef<MapboxGL.Camera>(null);
  const spatViewModelRef = useRef<SpatViewModel>(new SpatViewModel());
  const lanesViewModelRef = useRef<LanesViewModel>(new LanesViewModel());
  const preemptionViewModelRef = useRef<PreemptionViewModel>(new PreemptionViewModel());
  
  const spatViewModel = providedSpatViewModel || spatViewModelRef.current;
  const lanesViewModel = providedLanesViewModel || lanesViewModelRef.current;
  const preemptionViewModel = preemptionViewModelRef.current;

  const [userPosition, setUserPosition] = useState<[number, number]>([
    mapViewModel.userLocation.latitude, 
    mapViewModel.userLocation.longitude
  ]);
  const [spatZones, setSpatZones] = useState<SpatZone[]>(() => SpatZoneService.getActiveZones());
  const [activeSpatZoneId, setActiveSpatZoneId] = useState<string | null>(null);

  const lastCameraUpdate = useRef<number>(0);
  const CAMERA_UPDATE_THROTTLE = 2000;

  const activeDetector = isTestingMode ? testingPedestrianDetectorViewModel : pedestrianDetectorViewModel;
  const SHOW_SDSM_VEHICLES = true;


  const getZonesSignature = (zones: SpatZone[]): string => (
    zones
      .map((zone) => `${zone.id}:${zone.name}:${zone.signalGroup}:${zone.polygon.length}:${zone.entryLine?.length || 0}:${zone.exitLine?.length || 0}`)
      .join('|')
  );

  const toLngLatLine = (line?: [number, number][]): [number, number][] | null => {
    if (!line || line.length !== 2) return null;
    return line.map(([lat, lng]) => [lng, lat]);
  };

  const createZonePolygonFeature = (zone: SpatZone) => ({
    type: 'Feature' as const,
    properties: {
      zoneId: zone.id,
      name: zone.name,
      signalGroup: zone.signalGroup,
      laneIds: zone.laneIds.join(', '),
    },
    geometry: {
      type: 'Polygon' as const,
      coordinates: [zone.polygon],
    },
  });

  const createLineFeature = (lineCoords: [number, number][], lineType: 'entry' | 'exit') => ({
    type: 'Feature' as const,
    properties: {
      lineType,
    },
    geometry: {
      type: 'LineString' as const,
      coordinates: lineCoords,
    },
  });

  const shouldShowSDSMForViewModel = (_viewModel: VehicleDisplayViewModel): boolean => {
    if (!SHOW_SDSM_VEHICLES || !TESTING_CONFIG.ENABLE_SDSM_API) {
      return false;
    }
    return true;
  };

  const updateCameraPosition = (position: [number, number]) => {
    const now = Date.now();
    
    if (now - lastCameraUpdate.current < CAMERA_UPDATE_THROTTLE) {
      return;
    }
    
    lastCameraUpdate.current = now;
    
    if (cameraRef.current && position[0] !== 0 && position[1] !== 0) {
      cameraRef.current.setCamera({
        centerCoordinate: [position[1], position[0]],
        zoomLevel: 17,
        animationDuration: 1500,
      });
    };

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

  useEffect(() => {
    if (userPosition[0] === 0 || userPosition[1] === 0) return;

    const activeZone = SpatZoneService.findZoneForPosition(userPosition);
    const nextZoneId = activeZone?.id || null;

    const handleLocateUser = () => {
      if (userPosition[0] !== 0 && userPosition[1] !== 0) {
        cameraRef.current?.setCamera({
          centerCoordinate: [userPosition[1], userPosition[0]],
          zoomLevel: 17,
          animationDuration: 600,
        });
        zoomLevelRef.current = 17;
      }
    };
    const [mapLayer, setMapLayer] = useState<"outdoors" | "satellite" | "streets">("outdoors");

  useEffect(() => {
    preemptionViewModel.syncPosition(userPosition, spatZones);
  }, [preemptionViewModel, userPosition, spatZones]);

    const MAP_STYLE_URLS = {
      outdoors: "mapbox://styles/mapbox/outdoors-v12",
      satellite: "mapbox://styles/mapbox/satellite-streets-v12",
      streets: "mapbox://styles/mapbox/streets-v12",
      dark: "mapbox://styles/mapbox/dark-v11",
    };

    const lastCameraUpdate = useRef<number>(0);
    const CAMERA_UPDATE_THROTTLE = 2000;

        // Get initial position first
        try {
          const initialLocation = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.BestForNavigation,
          });
          const { latitude, longitude } = initialLocation.coords;
          const initialPosition: [number, number] = [latitude, longitude];
          setUserPosition(initialPosition);
          updateAllViewModels(initialPosition);
        } catch (posError) {
          console.log('[Location] Could not get initial position:', posError);
          // Fall back to MapViewModel's default location
          const defaultPosition: [number, number] = [
            mapViewModel.userLocation.latitude,
            mapViewModel.userLocation.longitude,
          ];
          setUserPosition(defaultPosition);
          updateAllViewModels(defaultPosition);
        }

    const shouldShowSDSMForViewModel = (
      viewModel: VehicleDisplayViewModel,
    ): boolean => {
      return SHOW_SDSM_VEHICLES && TESTING_CONFIG.ENABLE_SDSM_API;
    };

    const vehicleDisplayVM =
      mainViewModel?.vehicleDisplayViewModel || testingVehicleDisplayViewModel;

    const updateCameraPosition = (position: [number, number]) => {
      const now = Date.now();

      if (now - lastCameraUpdate.current < CAMERA_UPDATE_THROTTLE) {
        return;
      }

      lastCameraUpdate.current = now;

      if (cameraRef.current && position[0] !== 0 && position[1] !== 0) {
        cameraRef.current.setCamera({
          centerCoordinate: [position[1], position[0]],
          zoomLevel: 17,
          animationDuration: 1500,
        });
      }
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

    activeDetector.updateVRUData(allVRUs);
  }, [
    activeDetector,
    mainViewModel?.vehicleDisplayViewModel?.vrus,
    testingVehicleDisplayViewModel?.vrus,
    testingPedestrianDetectorViewModel?.vrus,
    TESTING_CONFIG.ENABLE_SDSM_API,
    TESTING_CONFIG.SHOW_FIXED_PEDESTRIAN
  ]);

  return (
    <View style={styles.container}>
      <MapLegend />

      <MapboxGL.MapView
        ref={mapRef}
        style={styles.map}
        styleURL="mapbox://styles/mapbox/streets-v12"
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={false}
        rotateEnabled={true}
        scrollEnabled={true}
        pitchEnabled={true}
        zoomEnabled={true}
      >
        <MapboxGL.Camera
          ref={cameraRef}
          centerCoordinate={[-85.3075, 35.0454]}
          zoomLevel={17}
          animationMode="flyTo"
          animationDuration={1500}
        />

      const setupLocationTracking = async () => {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== "granted") {
            return;
          }

          locationSubscription = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.BestForNavigation,
              distanceInterval: 2,
              timeInterval: 500,
            },
            (location) => {
              const { latitude, longitude, heading } = location.coords;
              const newPosition: [number, number] = [latitude, longitude];

              setUserPosition(newPosition);
              updateAllViewModels(newPosition);
              updateCameraPosition(newPosition);

              if (heading != null && heading >= 0) {
                setUserHeading(heading);
              }
            },
          );

          if (activeDetector && "startMonitoring" in activeDetector) {
            activeDetector.startMonitoring();
          }
        } catch (error) {
          // Silent error handling
        }
      };

      setupLocationTracking();

      return () => {
        if (locationSubscription) {
          locationSubscription.remove();
        }
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
        <SearchBar isDarkMode={isDarkMode} />
        <ZoomControls
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onLocateUser={handleLocateUser}
        />

        <View style={styles.trafficLightAnchor}>
          <TrafficLightPanel />
        </View>
        <MapOverlayMenu
          isDarkMode={isDarkMode}
          onToggleDarkMode={() => setIsDarkMode((prev) => !prev)}
          userHeading={userHeading}
          onCycleLayer={cycleMapLayer}
        />

        <MapboxGL.MapView
          ref={mapRef}
          style={styles.map}
          styleURL={isDarkMode ? MAP_STYLE_URLS.dark : MAP_STYLE_URLS[mapLayer]}
          logoEnabled={false}
          attributionEnabled={false}
          compassEnabled={false}
          rotateEnabled={true}
          scrollEnabled={true}
          pitchEnabled={true}
          zoomEnabled={true}
        >
          <MapboxGL.Camera
            ref={cameraRef}
            centerCoordinate={[-85.3075, 35.0454]}
            zoomLevel={17}
            animationMode="flyTo"
            animationDuration={1500}
          />

          {userPosition[0] !== 0 && userPosition[1] !== 0 && (
            <MapboxGL.MarkerView
              id="vehicle-position"
              coordinate={[userPosition[1], userPosition[0]]}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={styles.userMarkerWrapper}>
                <View style={styles.markerGlow}>
                  <View style={styles.markerCircle}>
                    <Ionicons
                      name="navigate"
                      size={18}
                      color="#ffffff"
                      style={{ transform: [{ rotate: `${userHeading - 45}deg` }] }}
                    />
                  </View>
                </View>
              </View>
            </MapboxGL.MarkerView>
          )}

          {/* Crosswalk polygons — isolated observer, re-renders only when VRUs change */}
          <CrosswalkLayer
            vehicleDisplayVM={vehicleDisplayVM ?? null}
            testingPedestrianVM={testingPedestrianDetectorViewModel ?? null}
            show={mapViewModel.showCrosswalkPolygon}
          />

          <LaneOverlay lanesViewModel={lanesViewModel} />

      <TestingModeOverlay
        isTestingMode={isTestingMode}
        testingVehicleDisplayViewModel={testingVehicleDisplayViewModel}
      />

      {/* SpatStatusDisplay - Hidden in favor of TurnGuideDisplay */}
      {/* <SpatStatusDisplay
        userPosition={userPosition}
        spatViewModel={spatViewModel}
      /> */}

      <TurnGuideDisplay spatViewModel={spatViewModel} />

      <PreemptionToggle
        enabled={preemptionViewModel.isEnabled}
        onToggle={(enabled) => {
          preemptionViewModel.toggleEnabled(enabled);
        }}
      />

      {(() => {
        const vehiclePos: [number, number] = [userPosition[0], userPosition[1]];

        if (userPosition[0] === 0) return null;

        let allVRUs: any[] = [];

        if (TESTING_CONFIG.ENABLE_SDSM_API) {
          const vehicleDisplayVM = mainViewModel?.vehicleDisplayViewModel || testingVehicleDisplayViewModel;
          if (vehicleDisplayVM?.vrus && shouldShowSDSMForViewModel(vehicleDisplayVM)) {
            allVRUs = [...allVRUs, ...vehicleDisplayVM.vrus];
          }
        }

        if (TESTING_CONFIG.SHOW_FIXED_PEDESTRIAN && testingPedestrianDetectorViewModel?.vrus) {
          allVRUs = [...allVRUs, ...testingPedestrianDetectorViewModel.vrus];
        }

          {children}
        </MapboxGL.MapView>

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
  userMarkerWrapper: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  markerGlow: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(255, 140, 0, 0.22)",
    justifyContent: "center",
    alignItems: "center",
  },
  markerCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#FF8C00",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2.5,
    borderColor: "#ffffff",
    shadowColor: "#FF8C00",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.75,
    shadowRadius: 10,
    elevation: 10,
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
