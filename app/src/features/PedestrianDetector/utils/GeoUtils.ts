
 
export function distanceBetweenPoints(
    lat1: number, lon1: number,
    lat2: number, lon2: number
  ): number {
    return Math.sqrt(
      Math.pow(lat2 - lat1, 2) +
      Math.pow(lon2 - lon1, 2)
    );
  }

export default distanceBetweenPoints;