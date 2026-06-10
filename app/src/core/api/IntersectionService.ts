import { API_CONFIG } from './config';

export interface Intersection {
  id: number;
  name: string;
  intersection_id: number;
  region_id: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export class IntersectionService {
  private static intersectionsCache: Intersection[] | null = null;

  static async loadIntersections(): Promise<Intersection[]> {
    if (this.intersectionsCache) {
      return this.intersectionsCache;
    }

    try {
      const endpoint = `${API_CONFIG.DASHBOARD_API_URL}/api/intersections`;
      const response = await fetch(endpoint, { method: 'GET' });

      if (!response.ok) {
        throw new Error(`Failed to load intersections (${response.status})`);
      }

      const data = (await response.json()) as Intersection[];
      this.intersectionsCache = data;
      return data;
    } catch (error) {
      console.log('[IntersectionService] Error loading intersections:', error);
      return [];
    }
  }

  static getIntersectionById(databaseId: number): Intersection | null {
    if (!this.intersectionsCache) return null;
    return this.intersectionsCache.find((i) => i.id === databaseId) || null;
  }

  static getSaeIntersectionId(databaseId: number): number | null {
    const intersection = this.getIntersectionById(databaseId);
    return intersection?.intersection_id ?? null;
  }

  static clearCache(): void {
    this.intersectionsCache = null;
  }
}
