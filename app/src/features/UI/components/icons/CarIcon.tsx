// app/src/features/UI/components/icons/CarIcon.tsx
import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface CarIconProps {
  size?: number;
  color?: string;
}

// Phosphor Icons "Car" (regular weight)
export const CarIcon: React.FC<CarIconProps> = ({ size = 16, color = '#0082BF' }) => (
  <Svg width={size} height={size} viewBox="0 0 256 256" fill={color}>
    <Path d="M240,104H229.2L201.42,41.5A16,16,0,0,0,186.8,32H69.2a16,16,0,0,0-14.62,9.5L26.8,104H16a8,8,0,0,0,0,16h8v80a16,16,0,0,0,16,16H64a16,16,0,0,0,16-16V184h96v16a16,16,0,0,0,16,16h24a16,16,0,0,0,16-16V120h8a8,8,0,0,0,0-16ZM69.2,48H186.8l24.89,56H44.31ZM64,200H40V184H64Zm128,0V184h24v16Zm24-32H40V120H216ZM56,144a8,8,0,0,1,8-8H80a8,8,0,0,1,0,16H64A8,8,0,0,1,56,144Zm112,0a8,8,0,0,1,8-8h16a8,8,0,0,1,0,16H176A8,8,0,0,1,168,144Z" />
  </Svg>
);

export default CarIcon;
