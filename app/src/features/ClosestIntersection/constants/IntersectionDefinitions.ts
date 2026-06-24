// app/src/features/ClosestIntersection/constants/IntersectionDefinitions.ts

import { Intersection } from '../models/IntersectionTypes';

export interface IntersectionPolygon {
  id: string;
  name: string;
  polygon: [number, number][]; // [lng, lat] format (GeoJSON standard)
  sdsmApiUrl: string;
  spatApiUrl: string;
}

export const INTERSECTION_POLYGONS: IntersectionPolygon[] = [
  {
    id: 'georgia',
    name: 'Georgia',
    polygon: [
      [-85.30916371234608, 35.047488484207065],   // [lng, lat]
      [-85.30651978503738, 35.046499911950775],
      [-85.30770847213297, 35.04450407829323],
      [-85.3092489138251, 35.044966097943814],
      [-85.30916371234608, 35.047488484207065]    // Closing point
    ],
    sdsmApiUrl: 'http://roadaware.cuip.research.utc.edu/cv2x/latest/sdsm_events/MLK_Georgia',
    spatApiUrl: 'http://roadaware.cuip.research.utc.edu/cv2x/latest/mlk_spat_events/MLK_Georgia'
  },
  {
    id: 'houston',
    name: 'Houston',
    polygon: [
      [-85.30559874335327, 35.045650808090755],   // [lng, lat]
      [-85.30399847748919, 35.04502071387549],
      [-85.30472079853897, 35.04337447372539],
      [-85.30722379608633, 35.044268903999026],
      [-85.30559874335327, 35.045650808090755]    // Closing point
    ],
    sdsmApiUrl: 'http://roadaware.cuip.research.utc.edu/cv2x/latest/sdsm_events/MLK_Houston',
    spatApiUrl: 'http://roadaware.cuip.research.utc.edu/cv2x/latest/mlk_spat_events/MLK_Houston'
  }
];

export const INTERSECTIONS: Intersection[] = [
  {
    id: 'georgia',
    name: 'Georgia',
    coordinates: [-85.30816022083538, 35.04598914209872]
  },
  {
    id: 'houston',
    name: 'Houston',
    coordinates: [-85.30538545386694, 35.04457872542267]
  }
];

export default INTERSECTION_POLYGONS;