// app/src/features/Lanes/constants/LaneData.ts

import { Lane, LaneStyle, LaneConfiguration } from '../models/LaneTypes';

// Default lane styling
export const DEFAULT_LANE_STYLE: LaneStyle = {
  color: '#0066FF',
  width: 3,
  opacity: 1.0,
  lineCap: 'round',
  lineJoin: 'round'
};

// Georgia intersection lanes
export const GEORGIA_INTERSECTION_LANES: Lane[] = [
  {
  "laneID": 1,
  "laneAttributes": {
    "directionalUse": [2, 2],
    "sharedWith": [0, 10],
    "laneType": ["vehicle", [0, 8]]
  },
  "maneuvers": [0, 12],
  "geometry": {
    "type": "LineString",
    "coordinates": [
      [-85.30825184926294, 35.045881277451016],
      [-85.30810795257204, 35.04612334710821]
    ]
  },
  "connectsTo": [
    {
      "connectingLane": { "lane": 14 },
      "signalGroup": 4
    }
  ]
},
{
  "laneID": 2,
  "laneAttributes": {
    "directionalUse": [2, 2],
    "sharedWith": [0, 10],
    "laneType": ["vehicle", [0, 8]]
  },
  "maneuvers": [0, 12],
  "geometry": {
    "type": "LineString",
    "coordinates": [
      [-85.30808694608017, 35.0461185720134],
      [-85.30822309818002, 35.04587185340938]
    ]
  },
  "connectsTo": [
    {
      "connectingLane": { "lane": 9 },
      "signalGroup": 4
    },
    {
      "connectingLane": { "lane": 6 },
      "signalGroup": 4
    }
  ]
},
{
  "laneID": 3,
  "laneAttributes": {
    "directionalUse": [1, 2],
    "sharedWith": [0, 10],
    "laneType": ["vehicle", [0, 8]]
  },
  "maneuvers": [0, 12],
  "geometry": {
    "type": "LineString",
    "coordinates": [
      [-85.3082055844504, 35.045864455943956],
      [-85.30806863905465, 35.04608226859658]
    ],
  },
  "connectsTo": []
},
  {
    "laneID": 4,
    "laneAttributes": {
      "directionalUse": [2, 2],
      "sharedWith": [0, 10],
      "laneType": ["vehicle", [0, 8]]
    },
    "maneuvers": [0, 12],
    "geometry": {
      "type": "LineString",
      "coordinates": [
        [-85.30817757834019, 35.04573944218343],
        [-85.3077788550721, 35.045593483788124]
      ]
    },
    "connectsTo": [
      {
        "connectingLane": { "lane": 14 },
        "signalGroup": 2
      }
    ]
  },
  {
    "laneID": 5,
    "laneAttributes": {
      "directionalUse": [2, 2],
      "sharedWith": [0, 10],
      "laneType": ["vehicle", [0, 8]]
    },
    "maneuvers": [0, 12],
    "geometry": {
      "type": "LineString",
      "coordinates": [
        [-85.3081833489479, 35.045727395360785],
        [-85.30779833465891, 35.045582803816814]
      ]
    },
    "connectsTo": [
      {
        "connectingLane": { "lane": 13 },
        "signalGroup": 2
      },
      {
        "connectingLane": { "lane": 9 },
        "signalGroup": 2
      }
    ]
  },
  {
  "laneID": 6,
  "laneAttributes": {
    "directionalUse": [1, 2],
    "sharedWith": [0, 10],
    "laneType": ["vehicle", [0, 8]]
  },
  "maneuvers": [0, 12],
  "geometry": {
    "type": "LineString",
    "coordinates": [
      [-85.30818934760474, 35.04571489860149],
      [-85.3078185286913, 35.04557334578071]
    ]
  },
  "connectsTo": []
},
{
  "laneID": 7,
  "laneAttributes": {
    "directionalUse": [1, 2],
    "sharedWith": [0, 10],
    "laneType": ["vehicle", [0, 8]]
  },
  "maneuvers": [0, 12],
  "geometry": {
    "type": "LineString",
    "coordinates": [
      [-85.30818934760474, 35.04571489860149],
      [-85.3078185286913, 35.04557334578071]
    ]
  }, 
  "connectsTo": []
},
{
    "laneID": 8,
    "laneAttributes": {
      "directionalUse": [2, 2],
      "sharedWith": [0, 10],
      "laneType": ["vehicle", [0, 8]]
    },
    "maneuvers": [0, 12],
    "geometry": {
      "type": "LineString",
      "coordinates": [
        [-85.30830902290128, 35.04568298238203],
        [-85.30842975787856, 35.04544796225704]
      ]
    },
    "connectsTo": [
      {
        "connectingLane": { "lane": 7 },
        "signalGroup": 4
      },
      {
        "connectingLane": { "lane": 3 },
        "signalGroup": 4
      },
      {
        "connectingLane": { "lane": 13 },
        "signalGroup": 4
      }
    ]
  },
{
  "laneID": 9,
  "laneAttributes": {
    "directionalUse": [1, 2],
    "sharedWith": [0, 10],
    "laneType": ["vehicle", [0, 8]]
  },
  "maneuvers": [0, 12],
  "geometry": {
    "type": "LineString",
    "coordinates": [
      [-85.30833282225264, 35.04569171713561],
      [-85.30846333157696, 35.04547164547776]
    ]
  }, 
  "connectsTo": []
},
{
  "laneID": 10,
  "laneAttributes": {
    "directionalUse": [2, 2],
    "sharedWith": [0, 10],
    "laneType": ["vehicle", [0, 8]]
  },
  "maneuvers": [0, 12],
  "geometry": {
    "type": "LineString",
    "coordinates": [
      [-85.30864549661894, 35.045820475631444],
      [-85.30853372833835, 35.04581701202075],
      [-85.30838998525093, 35.04579572782647]
    ]
  },
  "connectsTo": [
    {
      "connectingLane": { "lane": 9 },
      "signalGroup": 13
    },
    {
      "connectingLane": { "lane": 7 },
      "signalGroup": 13
    }
  ]
},
{
  "laneID": 11,
  "laneAttributes": {
    "directionalUse": [2, 2],
    "sharedWith": [0, 10],
    "laneType": ["vehicle", [0, 8]]
  },
  "maneuvers": [0, 12],
  "geometry": {
    "type": "LineString",
    "coordinates": [
      [-85.3087094293545, 35.04584382789007],
      [-85.30858949265765, 35.0458465062315],
      [-85.30837966501937, 35.04581473412672]
    ]
  },
  "connectsTo": [
    {
      "connectingLane": { "lane": 6 },
      "signalGroup": 2
    }
  ]
},
  
];

export const HOUSTON_INTERSECTION_LANES: Lane[] = [
  {
    "laneID": 101,
    "laneAttributes": {
      "directionalUse": [2, 2],
      "sharedWith": [0, 10],
      "laneType": ["vehicle", [0, 8]]
    },
    "maneuvers": [3584, 12],
    "geometry": {
      "type": "LineString",
      "coordinates": [
        [-85.3055256, 35.0448534],
        [-85.3051493, 35.0455305]
        
      ]
    },
    "connectsTo": [
      {
        "connectingLane": { "lane": 110 },
        "signalGroup": 4
      },
      {
        "connectingLane": { "lane": 107 },
        "signalGroup": 4
      },
      {
        "connectingLane": { "lane": 105 },
        "signalGroup": 4
      }
    ]
  },
  {
    "laneID": 102,
    "laneAttributes": {
      "directionalUse": [1, 2],
      "sharedWith": [0, 10],
      "laneType": ["vehicle", [0, 8]]
    },
    "maneuvers": [0, 12],
    "geometry": {
      "type": "LineString",
      "coordinates": [
        [-85.3054852, 35.0448328],
        [-85.3054572, 35.0448817]
      ]
    },
    "connectsTo": []
  },
  {
    "laneID": 103,
    "laneAttributes": {
      "directionalUse": [2, 2],
      "sharedWith": [0, 10],
      "laneType": ["vehicle", [0, 8]]
    },
    "maneuvers": [2560, 12],
    "geometry": {
      "type": "LineString",
      "coordinates": [
        [-85.3054417, 35.0447392],
        [-85.3049256, 35.0445453]
      ]
    },
    "connectsTo": [
      {
        "connectingLane": { "lane": 102 },
        "signalGroup": 2
      },
      {
        "connectingLane": { "lane": 110 },
        "signalGroup": 2
      }
    ]
  },
  {
    "laneID": 104,
    "laneAttributes": {
      "directionalUse": [2, 2],
      "sharedWith": [0, 10],
      "laneType": ["vehicle", [0, 8]]
    },
    "maneuvers": [1024, 12],
    "geometry": {
      "type": "LineString",
      "coordinates": [
        [-85.3054108, 35.0446962],
        [-85.3049395, 35.0445194]
      ]
    },
    "connectsTo": [
      {
        "connectingLane": { "lane": 107 },
        "signalGroup": 2
      }
    ]
  },
  {
    "laneID": 105,
    "laneAttributes": {
      "directionalUse": [1, 2],
      "sharedWith": [0, 10],
      "laneType": ["vehicle", [0, 8]]
    },
    "maneuvers": [0, 12],
    "geometry": {
      "type": "LineString",
      "coordinates": [
        [-85.3054661, 35.0446858],
        [-85.3054120, 35.0446642]
      ]
    },
    "connectsTo": []  
  },
  {
    "laneID": 106,
    "laneAttributes": {
      "directionalUse": [2, 2],
      "sharedWith": [0, 10],
      "laneType": ["vehicle", [0, 8]]
    },
    "maneuvers": [3584, 12],
    "geometry": {
      "type": "LineString",
      "coordinates": [
        [-85.3055932, 35.0446369],
        [-85.3056243, 35.0445911]
      ]
    },
    "connectsTo": [
      {
        "connectingLane": { "lane": 5 },
        "signalGroup": 4
      },
      {
        "connectingLane": { "lane": 2 },
        "signalGroup": 4
      },
      {
        "connectingLane": { "lane": 10 },
        "signalGroup": 4
      }
    ]
  },
  {
    "laneID": 107,
    "laneAttributes": {
      "directionalUse": [1, 2],
      "sharedWith": [0, 10],
      "laneType": ["vehicle", [0, 8]]
    },
    "maneuvers": [0, 12],
    "geometry": {
      "type": "LineString",
      "coordinates": [
        [-85.3056371, 35.0446554],
        
        [-85.3056660, 35.0446085]
      ]
    },
    "connectsTo": []
  },
  {
    "laneID": 108,
    "laneAttributes": {
      "directionalUse": [2, 2],
      "sharedWith": [0, 10],
      "laneType": ["vehicle", [0, 8]]
    },
    "maneuvers": [1024, 12],
    "geometry": {
      "type": "LineString",
      "coordinates": [
      [-85.305691, 35.044761],
      [-85.306085, 35.044913]
      ]
    },
    "connectsTo": [
      {
        "connectingLane": { "lane": 2 },
        "signalGroup": 2
      }
    ]
  },
  {
    "laneID": 109,
    "laneAttributes": {
      "directionalUse": [2, 2],
      "sharedWith": [0, 10],
      "laneType": ["vehicle", [0, 8]]
    },
    "maneuvers": [2560, 12],
    "geometry": {
      "type": "LineString",
      "coordinates": [
        [-85.30565737732269, 35.044790666305786],
        [-85.3057146240633, 35.0448094616373]
      ]
    },
    "connectsTo": [
      {
        "connectingLane": { "lane": 7 },
        "signalGroup": 2
      },
      {
        "connectingLane": { "lane": 5 },
        "signalGroup": 2
      }
    ]
  },
  {
    "laneID": 100,
    "laneAttributes": {
      "directionalUse": [1, 2],
      "sharedWith": [0, 10],
      "laneType": ["vehicle", [0, 8]]
    },
    "maneuvers": [0, 12],
    "geometry": {
      "type": "LineString",
      "coordinates": [
        [-85.3056341, 35.0448120],
        [-85.3056991, 35.0448372]
      ]
    },
    "connectsTo": []
  }
];

// NEW: Lindsay intersection lanes
export const LINDSAY_INTERSECTION_LANES: Lane[] = [
  {
    "laneID": 201,
    "laneAttributes": {
      "directionalUse": [2, 2],
      "sharedWith": [0, 10],
      "laneType": ["vehicle", [0, 8]]
    },
    "maneuvers": [3584, 12],
    "geometry": {
      "type": "LineString",
      "coordinates": [
        [-85.3068790, 35.0453512],
        [-85.3066849, 35.0457107]
      ]
    },
    "connectsTo": [
      {
        "connectingLane": { "lane": 5 },
        "signalGroup": 4
      },
      {
        "connectingLane": { "lane": 7 },
        "signalGroup": 4
      },
      {
        "connectingLane": { "lane": 10 },
        "signalGroup": 4
      }
    ]
  },
  {
    "laneID": 202,
  "laneAttributes": {
    "directionalUse": [1, 2],
    "sharedWith": [0, 10],
    "laneType": ["vehicle", [0, 8]]
  },
  "maneuvers": [0, 12],
  "geometry": {
    "type": "LineString",
    "coordinates": [
      [-85.3068405, 35.0453373],
      [-85.3068071, 35.0453950]
    ],
  },
  "connectsTo": []
},
{
  "laneID": 203,
  "laneAttributes": {
    "directionalUse": [2, 2],
    "sharedWith": [0, 10],
    "laneType": ["vehicle", [0, 8]]
  },
  "maneuvers": [2560, 12],
  "geometry": {
    "type": "LineString",
    "coordinates": [
      [-85.3068009, 35.0452531],
      [-85.3058514, 35.0448936]
    ]
  },
  "connectsTo": [
    {
      "connectingLane": { "lane": 2 },
      "signalGroup": 2
    },
    {
      "connectingLane": { "lane": 10 },
      "signalGroup": 2
    }
  ]
},
{
  "laneID": 204,
  "laneAttributes": {
    "directionalUse": [2, 2],
    "sharedWith": [0, 10],
    "laneType": ["vehicle", [0, 8]]
  },
  "maneuvers": [1024, 12],
  "geometry": {
    "type": "LineString",
    "coordinates": [
      [-85.3068023, 35.0452213],
      [-85.3062938, 35.0450271]
    ]
  },
  "connectsTo": [
    {
      "connectingLane": { "lane": 7 },
      "signalGroup": 2
    }
  ]
},
{
  "laneID": 205,
  "laneAttributes": {
    "directionalUse": [1, 2],
    "sharedWith": [0, 10],
    "laneType": ["vehicle", [0, 8]]
  },
  "maneuvers": [0, 12],
  "geometry": {
    "type": "LineString",
    "coordinates": [
      [-85.3068178, 35.0451952],
      [-85.3067522, 35.0451703]
    ]
  },
  "connectsTo": []  
},
{
  "laneID": 206,
  "laneAttributes": {
    "directionalUse": [2, 2],
    "sharedWith": [0, 10],
    "laneType": ["vehicle", [0, 8]]
  },
  "maneuvers": [3584, 12],
  "geometry": {
    "type": "LineString",
    "coordinates": [
      [-85.3069459, 35.0451611],
      [-85.3072848, 35.0445437]
    ]
  },
  "connectsTo": [
    {
      "connectingLane": { "lane": 5 },
      "signalGroup": 4
    },
    {
      "connectingLane": { "lane": 2 },
      "signalGroup": 4
    },
    {
      "connectingLane": { "lane": 10 },
      "signalGroup": 4
    }
  ]
},
{
  "laneID": 207,
  "laneAttributes": {
    "directionalUse": [1, 2],
    "sharedWith": [0, 10],
    "laneType": ["vehicle", [0, 8]]
  },
  "maneuvers": [0, 12],
  "geometry": {
    "type": "LineString",
    "coordinates": [
      [-85.3069790, 35.0451756],
      [-85.3070072, 35.0451243]
    ]
  }, 
  "connectsTo": []
},
{
  "laneID": 208,
  "laneAttributes": {
    "directionalUse": [2, 2],
    "sharedWith": [0, 10],
    "laneType": ["vehicle", [0, 8]]
  },
  "maneuvers": [2560, 12],
  "geometry": {
    "type": "LineString",
    "coordinates": [
      [-85.3070316, 35.0452672],
      [-85.3079039, 35.0455973]
    ]
  },
  "connectsTo": [
    {
      "connectingLane": { "lane": 5 },
      "signalGroup": 2
    },
    {
      "connectingLane": { "lane": 7 },
      "signalGroup": 2
    }
  ]
}, 
{
  "laneID": 209,
  "laneAttributes": {
    "directionalUse": [2, 2],
    "sharedWith": [0, 10],
    "laneType": ["vehicle", [0, 8]]
  },
  "maneuvers": [1024, 12],
  "geometry": {
    "type": "LineString",
    "coordinates": [
      [-85.3070257, 35.0452959],
      [-85.3072120, 35.0453663]
    ]
  },
  "connectsTo": [
    {
      "connectingLane": { "lane": 2 },
      "signalGroup": 2
    }
  ]
},
{
  "laneID": 210,
  "laneAttributes": {
    "directionalUse": [1, 2],
    "sharedWith": [0, 10],
    "laneType": ["vehicle", [0, 8]]
  },
  "maneuvers": [0, 12],
  "geometry": {
    "type": "LineString",
    "coordinates": [
      [-85.3069970, 35.0453157],
      [-85.3070740, 35.0453448]
    ]
  },
  "connectsTo": []  
},

];

// Combined lanes from all intersections (UPDATED)
export const ALL_INTERSECTION_LANES: Lane[] = [
  ...GEORGIA_INTERSECTION_LANES,
  ...HOUSTON_INTERSECTION_LANES,
  ...LINDSAY_INTERSECTION_LANES
];

// Backward compatibility - keep the original export
export const INTERSECTION_LANES = GEORGIA_INTERSECTION_LANES;

// Intersection-specific configurations
export const GEORGIA_LANE_CONFIG: LaneConfiguration = {
  lanes: GEORGIA_INTERSECTION_LANES,
  defaultStyle: DEFAULT_LANE_STYLE,
  visible: true
};

export const HOUSTON_LANE_CONFIG: LaneConfiguration = {
  lanes: HOUSTON_INTERSECTION_LANES,
  defaultStyle: DEFAULT_LANE_STYLE,
  visible: true
};

// NEW: Lindsay lane configuration
export const LINDSAY_LANE_CONFIG: LaneConfiguration = {
  lanes: LINDSAY_INTERSECTION_LANES,
  defaultStyle: DEFAULT_LANE_STYLE,
  visible: true
};

export const ALL_INTERSECTIONS_LANE_CONFIG: LaneConfiguration = {
  lanes: ALL_INTERSECTION_LANES,
  defaultStyle: DEFAULT_LANE_STYLE,
  visible: true
};

// Main lane configuration - now includes all three intersections
export const LANE_CONFIG: LaneConfiguration = ALL_INTERSECTIONS_LANE_CONFIG;

// Helper function to get lanes for a specific intersection (UPDATED)
export function getLanesForIntersection(intersection: 'georgia' | 'houston' | 'lindsay' | 'all'): Lane[] {
  switch (intersection) {
    case 'georgia':
      return GEORGIA_INTERSECTION_LANES;
    case 'houston':
      return HOUSTON_INTERSECTION_LANES;
    case 'lindsay':
      return LINDSAY_INTERSECTION_LANES;
    case 'all':
    default:
      return ALL_INTERSECTION_LANES;
  }
}

// app/src/features/Lanes/constants/LaneData.ts
// Add this function at the end of the file

/**
 * Helper function to get lane configuration for a specific intersection (UPDATED)
 */
export function getLaneConfigForIntersection(intersection: 'georgia' | 'houston' | 'lindsay' | 'all'): LaneConfiguration {
  switch (intersection) {
    case 'georgia':
      return GEORGIA_LANE_CONFIG;
    case 'houston':
      return HOUSTON_LANE_CONFIG;
    case 'lindsay':
      return LINDSAY_LANE_CONFIG;
    case 'all':
    default:
      return ALL_INTERSECTIONS_LANE_CONFIG;
  }
}

export default LANE_CONFIG;
