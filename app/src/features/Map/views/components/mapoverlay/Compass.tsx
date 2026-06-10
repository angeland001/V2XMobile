import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Polygon } from "react-native-svg";

interface CompassProps {
  heading: number; // degrees from true north, clockwise
}

// SVG canvas for the needle pair
const SVG_W = 8;
const SVG_H = 25;
const GAP = 5;
const HALF = (SVG_H - GAP) / 2; // 13.5

// North triangle: tip at top-center, base at bottom
// "6,0" = tip,  "1,13.5" and "11,13.5" = base corners
const NORTH_PTS = `${SVG_W / 2},0 1,${HALF} ${SVG_W - 1},${HALF}`;

// South triangle: tip at bottom-center, base at top (starts after gap)
const S_TOP = HALF + GAP;
const SOUTH_PTS = `1,${S_TOP} ${SVG_W - 1},${S_TOP} ${SVG_W / 2},${SVG_H}`;

export const Compass: React.FC<CompassProps> = ({ heading }) => {
  return (
    <View style={styles.outer}>
      {/* N label — fixed at top, never rotates */}
      <Text style={styles.labelNorth}>N</Text>

      {/* Only the needle rotates */}
      <View style={{ transform: [{ rotate: `${-heading}deg` }] }}>
        <Svg width={SVG_W} height={SVG_H}>
          <Polygon
            points={NORTH_PTS}
            fill="#fff16f"
            strokeLinejoin="round"
            stroke="#fff16f"
            strokeWidth={2}
          />
          <Polygon
            points={SOUTH_PTS}
            fill="#FFFFFF"
            strokeLinejoin="round"
            stroke="#FFFFFF"
            strokeWidth={2}
          />
        </Svg>
      </View>
    </View>
  );
};

const COMPASS_SIZE = 46;

const styles = StyleSheet.create({
  outer: {
    width: COMPASS_SIZE,
    height: COMPASS_SIZE,
    borderRadius: COMPASS_SIZE / 2,
    backgroundColor: "#47515c",
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
  },
  labelNorth: {
    position: "absolute",
    top: 2,
    alignSelf: "center",
    fontSize: 9,
    fontWeight: "800",
    color: "#fff16f",
    lineHeight: 10,
  },
});
