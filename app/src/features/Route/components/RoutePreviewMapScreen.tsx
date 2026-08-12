import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import { Ionicons } from '@expo/vector-icons';
import { observer } from 'mobx-react-lite';
import { RouteViewModel, TimHit, PreemptionHit } from '../viewmodels/RouteViewModel';
import { RoutePreviewSheet } from './RoutePreviewSheet';
import { ROUTE_COLORS, ROUTE_FONTS, TIM_CATEGORY_STYLE } from '../../UI/appTheme';
import { MarkerPin, MARKER_PIN_TIP_ANCHOR } from '../../UI/components/icons/MarkerPin';
import { closeRing, normalizeToLngLat, type LngLat } from '../../../core/maps/coordinates';

// Same averaging MapView.tsx's TIMLayer uses to place its zone badge —
// duplicated locally rather than shared since MapView.tsx's own copy is
// part of the live-nav HUD, out of scope for this pass.
const lngLatCentroid = (coords: LngLat[]): [number, number] => [
  coords.reduce((s, c) => s + c[0], 0) / coords.length,
  coords.reduce((s, c) => s + c[1], 0) / coords.length,
];

MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '');

// Extra breathing room below the sheet's own measured height, so the route
// doesn't hug the edge of the visible (non-covered) map area.
const SHEET_PADDING_MARGIN = 32;

// Route line is yellow and the destination pin is the app's orange accent —
// deliberately different hues so the endpoint pops against the route color
// instead of blending into it.
const ROUTE_COLOR = '#FFC107';
const DESTINATION_COLOR = '#FF8C00';

// ---------------------------------------------------------------------------
// Zone layers — only the TIM/preemption zones this specific route crosses
// (routeVM.timHits / preemptionHits), not every active zone app-wide.
//
// Explicitly anchored above the route's topmost line layer (same
// belowLayerID/aboveLayerID technique used for route-vs-route stacking
// below) so zone fills/outlines are never hidden under the route line where
// they overlap — relying on JSX mount order alone isn't a reliable way to
// control Mapbox GL paint order.
// ---------------------------------------------------------------------------

const ZONE_ABOVE_LAYER_ID = 'preview-route-active-line';

const RouteTimZonesLayer: React.FC<{ hits: TimHit[] }> = ({ hits }) => (
  <>
    {hits.map((hit) => {
      const style = TIM_CATEGORY_STYLE[hit.category] ?? TIM_CATEGORY_STYLE.informational;
      const outerCoords = (hit.geometry.coordinates[0] as [number, number][]).map(normalizeToLngLat);
      const outerRing = closeRing(outerCoords);
      if (outerRing.length < 3) return null;

      const shape: GeoJSON.Feature<GeoJSON.Polygon> = {
        type: 'Feature',
        properties: {},
        geometry: { type: 'Polygon', coordinates: [outerRing] },
      };
      const centroid = lngLatCentroid(outerCoords);

      return (
        <React.Fragment key={`preview-tim-${hit.timId}`}>
          <MapboxGL.ShapeSource id={`preview-tim-${hit.timId}`} shape={shape}>
            <MapboxGL.FillLayer id={`preview-tim-fill-${hit.timId}`} aboveLayerID={ZONE_ABOVE_LAYER_ID} style={{ fillColor: style.dimColor }} />
            <MapboxGL.LineLayer id={`preview-tim-line-${hit.timId}`} aboveLayerID={`preview-tim-fill-${hit.timId}`} style={{ lineColor: style.color, lineWidth: 2.5 }} />
          </MapboxGL.ShapeSource>
          {/* Same category badge (icon + Safety/Regulatory/Info label) as
              MapView.tsx's TIMLayer, so a zone reads identically whether
              you're previewing the route or already navigating it. */}
          <MapboxGL.MarkerView coordinate={centroid} allowOverlap={true}>
            <View style={[timMarkerStyles.badge, { borderColor: style.color }]}>
              <Ionicons name={style.icon} size={14} color={style.color} />
              <Text style={[timMarkerStyles.label, { color: style.color }]}>{style.label}</Text>
            </View>
          </MapboxGL.MarkerView>
        </React.Fragment>
      );
    })}
  </>
);

// Same MarkerPin + flash icon MapView.tsx's SpatZoneLayer uses in its
// "icon" display mode — the preemption icon itself is what tells the driver
// this route passes through a signal-preemption zone, so it's the marker
// (not a filled polygon) that carries the meaning here.
const RoutePreemptionZonesLayer: React.FC<{ hits: PreemptionHit[] }> = ({ hits }) => (
  <>
    {hits.map((hit) => {
      const ring = closeRing(hit.polygon as LngLat[]);
      if (ring.length < 3) return null;
      const centroid = lngLatCentroid(ring);

      return (
        <MapboxGL.MarkerView
          key={`preview-spat-${hit.zoneId}`}
          coordinate={centroid}
          anchor={{ x: 0.5, y: MARKER_PIN_TIP_ANCHOR }}
          allowOverlap={true}
        >
          <MarkerPin size={30} iconSize={14} color={ROUTE_COLORS.preempt}>
            <Ionicons name="flash" size={14} color="#FFFFFF" />
          </MarkerPin>
        </MapboxGL.MarkerView>
      );
    })}
  </>
);

// ---------------------------------------------------------------------------
// Route lines — non-selected alternates are still fully opaque and tappable
// (a low-opacity/desaturated treatment reads as "disabled" rather than "an
// alternative you can pick"), just a solid neutral gray with a thin dark
// casing for definition against the basemap, so the active route's yellow
// still reads as primary without the alternates looking washed out.
//
// Where two options share the same road before splitting off, both lines
// occupy the same pixels — whichever one Mapbox happens to paint last wins.
// Declaring the active route first in JSX doesn't reliably guarantee it
// paints on top, so its layers are anchored explicitly with belowLayerID
// pointing at each alternate: added first (so the reference target exists),
// then every alternate is explicitly inserted below it, making the active
// route the top layer on any shared segment regardless of mount order.
// ---------------------------------------------------------------------------

const RouteLinesLayer: React.FC<{ routeVM: RouteViewModel }> = observer(({ routeVM }) => (
  <>
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
          style={{ lineColor: '#1A1A2E', lineWidth: 3.5, lineOpacity: 0.25, lineCap: 'round', lineJoin: 'round' }}
        />
        <MapboxGL.LineLayer
          id="preview-route-active-line"
          style={{ lineColor: ROUTE_COLOR, lineWidth: 2, lineOpacity: 0.9, lineCap: 'round', lineJoin: 'round' }}
        />
      </MapboxGL.ShapeSource>
    )}

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
            id={`preview-route-alt-casing-${index}`}
            belowLayerID="preview-route-active-casing"
            style={{ lineColor: '#1A1A2E', lineWidth: 2.5, lineOpacity: 0.15, lineCap: 'round', lineJoin: 'round' }}
          />
          <MapboxGL.LineLayer
            id={`preview-route-alt-line-${index}`}
            aboveLayerID={`preview-route-alt-casing-${index}`}
            style={{ lineColor: '#9CA3AF', lineWidth: 1.5, lineOpacity: 1, lineCap: 'round', lineJoin: 'round' }}
          />
        </MapboxGL.ShapeSource>
      );
    })}
  </>
));

const DestinationFlag: React.FC<{ routeVM: RouteViewModel }> = observer(({ routeVM }) => {
  if (!routeVM.toCoord) return null;
  return (
    // allowOverlap defaults to false on MarkerView — "adjacent markers will
    // collapse and only one will be shown." Zoomed out, the destination
    // flag ends up close on-screen to a TIM/preemption zone marker and
    // loses that collapse, which is why it was disappearing.
    <MapboxGL.MarkerView coordinate={routeVM.toCoord} anchor={{ x: 0.5, y: 1 }} allowOverlap={true}>
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

const timMarkerStyles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: ROUTE_COLORS.panel,
    borderRadius: 12,
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderWidth: 1.5,
  },
  label: {
    fontFamily: ROUTE_FONTS.bodySemiBold,
    fontSize: 10,
  },
});

const destStyles = StyleSheet.create({
  container: { alignItems: 'center' },
  label: {
    backgroundColor: ROUTE_COLORS.panel,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: DESTINATION_COLOR,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 4,
    maxWidth: 150,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  labelText: { fontFamily: ROUTE_FONTS.bodySemiBold, color: ROUTE_COLORS.ink, fontSize: 11 },
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

          <RouteLinesLayer routeVM={routeVM} />
          <RouteTimZonesLayer hits={routeVM.timHits} />
          <RoutePreemptionZonesLayer hits={routeVM.preemptionHits} />
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
