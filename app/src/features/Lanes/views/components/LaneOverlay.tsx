// app/src/features/Lanes/views/components/LaneOverlay.tsx

import React from 'react';
import MapboxGL from '@rnmapbox/maps';
import { observer } from 'mobx-react-lite';
import { LanesViewModel } from '../../viewmodels/LanesViewModel';
import { LaneRenderingService } from '../../services/LaneRenderingService';

interface LaneOverlayProps {
  lanesViewModel: LanesViewModel;
}

export const LaneOverlay: React.FC<LaneOverlayProps> = observer(({ lanesViewModel }) => {
  if (!lanesViewModel.hasVisibleLanes) {
    return null;
  }

  const visibleLanes = lanesViewModel.visibleLanes;
  const lineStyle = LaneRenderingService.createLineStyle();

  const featureCollection: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: visibleLanes
      .map((lane) => LaneRenderingService.createLaneFeature(lane))
      .filter((f) => f.geometry.coordinates.length >= 2),
  };

  return (
    <MapboxGL.ShapeSource id="lanes-source" shape={featureCollection}>
      <MapboxGL.LineLayer
        id="lanes-line"
        style={{
          lineColor: lineStyle.lineColor,
          lineWidth: lineStyle.lineWidth,
          lineOpacity: lineStyle.lineOpacity,
          lineCap: 'round',
          lineJoin: 'round',
        }}
      />
    </MapboxGL.ShapeSource>
  );
});

LaneOverlay.displayName = 'LaneOverlay';

export default LaneOverlay;
