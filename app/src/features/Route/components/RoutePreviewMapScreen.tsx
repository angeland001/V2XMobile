import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import { Ionicons } from '@expo/vector-icons';
import { observer } from 'mobx-react-lite';
import { RouteViewModel, TimHit, PreemptionHit } from '../viewmodels/RouteViewModel';
import { RoutePreviewSheet } from './RoutePreviewSheet';
import { closeRing, normalizeToLngLat, type LngLat } from '../../../core/maps/coordinates';

MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '');

// Extra breathing room below the sheet's own measured height, so the route
// doesn't hug the edge of the visible (non-covered) map area.
const SHEET_PADDING_MARGIN = 32;

// Mapbox's own Street-style basemap already renders major/trunk roads in a
// light orange/tan, so the planned route and destination pin use deeper,
// more saturated shades from the same warm family as the app's orange
// accent (COLORS.orange) — on-brand, but dark/rich enough not to wash out
// against the lighter basemap roads. The marker is a gold/amber rather than
// matching the route line so the endpoint still pops against a same-family
// route color instead of blending into it.
const ROUTE_COLOR = '#C2410C';
const DESTINATION_COLOR = '#CA8A04';

const TIM_ZONE_STYLES: Record<TimHit['category'], { fill: string; stroke: string }> = {
  safety:        { fill: 'rgba(239, 68, 68, 0.28)',  stroke: '#EF4444' },
  regulatory:    { fill: 'rgba(245, 158, 11, 0.28)', stroke: '#F59E0B' },
  informational: { fill: 'rgba(59, 130, 246, 0.28)', stroke: '#3B82F6' },
};

// ---------------------------------------------------------------------------
// Zone layers — only the TIM/preemption zones this specific route crosses
// (routeVM.timHits / preemptionHits), not every active zone app-wide.
// ---------------------------------------------------------------------------

const RouteTimZonesLayer: React.FC<{ hits: TimHit[] }> = ({ hits }) => (
  <>
    {hits.map((hit) => {
      const style = TIM_ZONE_STYLES[hit.category] ?? TIM_ZONE_STYLES.informational;
      const outerRing = closeRing((hit.geometry.coordinates[0] as [number, number][]).map(normalizeToLngLat));
      if (outerRing.length < 3) return null;

      const shape: GeoJSON.Feature<GeoJSON.Polygon> = {
        type: 'Feature',
        properties: {},
        geometry: { type: 'Polygon', coordinates: [outerRing] },
      };

      return (
        <MapboxGL.ShapeSource key={`preview-tim-${hit.timId}`} id={`preview-tim-${hit.timId}`} shape={shape}>
          <MapboxGL.FillLayer id={`preview-tim-fill-${hit.timId}`} style={{ fillColor: style.fill }} />
          <MapboxGL.LineLayer id={`preview-tim-line-${hit.timId}`} style={{ lineColor: style.stroke, lineWidth: 2.5 }} />
        </MapboxGL.ShapeSource>
      );
    })}
  </>
);

const RoutePreemptionZonesLayer: React.FC<{ hits: PreemptionHit[] }> = ({ hits }) => (
  <>
    {hits.map((hit) => {
      const ring = closeRing(hit.polygon as LngLat[]);
      if (ring.length < 3) return null;

      const shape: GeoJSON.Feature<GeoJSON.Polygon> = {
        type: 'Feature',
        properties: {},
        geometry: { type: 'Polygon', coordinates: [ring] },
      };

      return (
        <MapboxGL.ShapeSource key={`preview-spat-${hit.zoneId}`} id={`preview-spat-${hit.zoneId}`} shape={shape}>
          <MapboxGL.FillLayer id={`preview-spat-fill-${hit.zoneId}`} style={{ fillColor: 'rgba(139, 92, 246, 0.2)' }} />
          <MapboxGL.LineLayer id={`preview-spat-line-${hit.zoneId}`} style={{ lineColor: '#8B5CF6', lineWidth: 2.5 }} />
        </MapboxGL.ShapeSource>
      );
    })}
  </>
);

// ---------------------------------------------------------------------------
// Route lines — non-selected alternates dimmed and tappable, active route on
// top.
// ---------------------------------------------------------------------------

const RouteLinesLayer: React.FC<{ routeVM: RouteViewModel }> = observer(({ routeVM }) => (
  <>
    {routeVM.routeOptions.map((option, index) => {
      if (index === routeVM.selectedRouteIndex) return null;
      const shape: GeoJSON.Feature<GeoJSON.LineString> = {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: option.coordinates },
      };
      return (
        <MapboxGL.ShapeSource
          key={`preview-route-alt-${index}`}
          id={`preview-route-alt-${index}`}
          shape={shape}
          onPress={() => routeVM.selectRouteOption(index)}
        >
          <MapboxGL.LineLayer
            id={`preview-route-alt-line-${index}`}
            style={{ lineColor: '#8A8FA3', lineWidth: 6, lineOpacity: 0.6, lineCap: 'round', lineJoin: 'round' }}
          />
        </MapboxGL.ShapeSource>
      );
    })}

    {routeVM.routeCoordinates.length >= 2 && (
      <MapboxGL.ShapeSource
        id="preview-route-active"
        shape={{
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: routeVM.routeCoordinates },
        }}
      >
        <MapboxGL.LineLayer
          id="preview-route-active-casing"
          style={{ lineColor: '#1A1A2E', lineWidth: 8, lineOpacity: 0.25, lineCap: 'round', lineJoin: 'round' }}
        />
        <MapboxGL.LineLayer
          id="preview-route-active-line"
          style={{ lineColor: ROUTE_COLOR, lineWidth: 5, lineOpacity: 0.9, lineCap: 'round', lineJoin: 'round' }}
        />
      </MapboxGL.ShapeSource>
    )}
  </>
));

const DestinationFlag: React.FC<{ routeVM: RouteViewModel }> = observer(({ routeVM }) => {
  if (!routeVM.toCoord) return null;
  return (
    <MapboxGL.MarkerView coordinate={routeVM.toCoord} anchor={{ x: 0.5, y: 1 }}>
      <View style={destStyles.container}>
        {!!routeVM.toLabel && (
          <View style={destStyles.label}>
            <Text style={destStyles.labelText} numberOfLines={1}>{routeVM.toLabel}</Text>
          </View>
        )}
        <View style={destStyles.circle}>
          <Ionicons name="flag-sharp" size={20} color="#fff" />
        </View>
        <View style={destStyles.pole} />
      </View>
    </MapboxGL.MarkerView>
  );
});

const destStyles = StyleSheet.create({
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
  labelText: { color: '#1A1A2E', fontSize: 11, fontWeight: '700' },
  circle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: DESTINATION_COLOR,
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
  pole: { width: 4, height: 18, backgroundColor: DESTINATION_COLOR },
});

interface RoutePreviewMapScreenProps {
  routeViewModel: RouteViewModel;
}

// Bare-bones map used only to preview a route before navigation starts —
// just the map, the route (and any alternates), the TIM/preemption zones
// that route actually crosses, the destination pin, and the summary dialog.
// None of the live-driving HUD (preemption toggle, traffic light panel,
// legend, zoom controls, pedestrian warnings, vehicle markers, lane
// overlay...) belongs here — that's MapViewComponent's job once the user
// taps Start Navigation.
export const RoutePreviewMapScreen: React.FC<RoutePreviewMapScreenProps> = observer(
  ({ routeViewModel: routeVM }) => {
    // The sheet can cover roughly half the screen (see its own maxHeight),
    // so a fixed padding guess was consistently too small — fitBounds would
    // assume far more usable vertical space than the sheet actually leaves,
    // over-zoom, and push part of the route off the top edge. Measure the
    // sheet's real rendered height instead and reserve exactly that (plus a
    // margin). Before the first layout pass, fall back to the sheet's own
    // maxHeight (55% of the window) as a reasonable estimate.
    const { height: windowHeight } = useWindowDimensions();
    const [sheetHeight, setSheetHeight] = useState(() => windowHeight * 0.55);

    // Bounds cover the union of every route option (start through
    // destination), so switching the selected alternate doesn't need to
    // recompute them.
    const bounds = useMemo(() => {
      const allCoords = [
        ...routeVM.routeCoordinates,
        ...routeVM.routeOptions.flatMap((o) => o.coordinates),
      ];
      if (allCoords.length < 2) return undefined;
      const lngs = allCoords.map((c) => c[0]);
      const lats = allCoords.map((c) => c[1]);
      return {
        ne: [Math.max(...lngs), Math.max(...lats)] as [number, number],
        sw: [Math.min(...lngs), Math.min(...lats)] as [number, number],
        paddingTop: 80,
        paddingBottom: sheetHeight + SHEET_PADDING_MARGIN,
        paddingLeft: 60,
        paddingRight: 60,
      };
    }, [routeVM.routeCoordinates, routeVM.routeOptions, sheetHeight]);

    // The `bounds` prop is declarative, but the underlying native map still
    // needs its style loaded before a fitBounds command actually takes —
    // one issued too early is silently dropped, and since `bounds` is
    // memoized to the same object reference across re-renders, it would
    // never be retried, leaving the camera stuck at defaultSettings with
    // part of the route out of frame. Withholding `bounds` until
    // onDidFinishLoadingMap fires turns that first application into a real
    // prop change (undefined → bounds) fired only once the map can act on it.
    const [mapReady, setMapReady] = useState(false);

    return (
      <View style={styles.container}>
        <MapboxGL.MapView
          style={styles.map}
          styleURL={MapboxGL.StyleURL.Street}
          compassEnabled={false}
          logoEnabled={false}
          attributionEnabled={false}
          onDidFinishLoadingMap={() => setMapReady(true)}
        >
          <MapboxGL.Camera
            bounds={mapReady ? bounds : undefined}
            defaultSettings={{ centerCoordinate: routeVM.toCoord ?? [-85.3075, 35.0454], zoomLevel: 12 }}
            animationDuration={mapReady ? 300 : 0}
          />
          <MapboxGL.UserLocation visible={true} />

          <RouteTimZonesLayer hits={routeVM.timHits} />
          <RoutePreemptionZonesLayer hits={routeVM.preemptionHits} />
          <RouteLinesLayer routeVM={routeVM} />
          <DestinationFlag routeVM={routeVM} />
        </MapboxGL.MapView>

        <RoutePreviewSheet
          routeViewModel={routeVM}
          onLayout={(e) => setSheetHeight(e.nativeEvent.layout.height)}
        />
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
});

export default RoutePreviewMapScreen;
