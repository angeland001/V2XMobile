// app/src/features/ClosestIntersection/services/IntersectionApiService.ts

export interface ApiResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export class IntersectionApiService {
  private static readonly TIMEOUT_MS = 3000;
  
  /**
   * Fetch data from an API endpoint with timeout
   */
  private static async fetchWithTimeout(url: string): Promise<ApiResponse> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` };
      }
      
      const data = await response.json();
      return { success: true, data };
      
    } catch (error) {
      if (error instanceof Error) {
        return { success: false, error: error.message };
      }
      return { success: false, error: 'Unknown error' };
    }
  }
  
  /**
   * Fetch SDSM data from the specified endpoint
   */
  static async fetchSDSMData(url: string): Promise<ApiResponse> {
    console.log(`Calling SDSM API: ${url}`);
    return this.fetchWithTimeout(url);
  }
  
  /**
   * Fetch SPaT data from the specified endpoint
   */
  static async fetchSPaTData(url: string): Promise<ApiResponse> {
    console.log(`Calling SPaT API: ${url}`);
    return this.fetchWithTimeout(url);
  }
  
  /**
   * Fetch both SDSM and SPaT data in parallel
   */
  static async fetchBothDataSets(sdsmUrl: string, spatUrl: string): Promise<{
    sdsm: ApiResponse;
    spat: ApiResponse;
  }> {
    const [sdsmResult, spatResult] = await Promise.all([
      this.fetchSDSMData(sdsmUrl),
      this.fetchSPaTData(spatUrl)
    ]);

    return {
      sdsm: sdsmResult,
      spat: spatResult
    };
  }
}

export default IntersectionApiService;