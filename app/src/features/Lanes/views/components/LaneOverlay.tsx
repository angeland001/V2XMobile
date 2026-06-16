// app/src/features/Lanes/views/components/LaneOverlay.tsx

import React from 'react';
import { Polyline } from 'react-native-maps';
import { observer } from 'mobx-react-lite';
import { LanesViewModel } from '../../viewmodels/LanesViewModel';
import { LaneRenderingService } from '../../services/LaneRenderingService';
import { toGooglePath } from '../../../../core/maps/coordinates';

interface LaneOverlayProps {
  lanesViewModel: LanesViewModel;
}

export const LaneOverlay: React.FC<LaneOverlayProps> = observer(({ lanesViewModel }) => {
  // Don't render anything if lanes are not globally visible or no visible lanes
  if (!lanesViewModel.hasVisibleLanes) {
    return null;
  }

  const visibleLanes = lanesViewModel.visibleLanes;

  const lineStyle = LaneRenderingService.createLineStyle();

  return (
    <>
      {visibleLanes.map((lane) => {
        const feature = LaneRenderingService.createLaneFeature(lane);
        const coordinates = toGooglePath(feature.geometry.coordinates);
        if (coordinates.length < 2) return null;

        return (
          <Polyline
            key={lane.id}
            coordinates={coordinates}
            strokeColor={lineStyle.lineColor}
            strokeWidth={lineStyle.lineWidth}
          />
        );
      })}
    </>
  );
});

LaneOverlay.displayName = 'LaneOverlay';
