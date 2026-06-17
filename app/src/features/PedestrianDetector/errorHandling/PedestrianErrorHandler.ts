// app/src/features/PedestrianDetector/errorHandling/PedestrianErrorHandler.ts
// Centralized error handling for pedestrian detection operations

export class PedestrianErrorHandler {
  
  /**
   * Handle SDSM API related errors
   */
  public static handleApiError(error: unknown): Error {
    if (error instanceof Error && error.name === 'AbortError') {
      return new Error('SDSM API request timeout');
    }
    
    if (error instanceof Error) {
      return new Error(`SDSM fetch failed: ${error.message}`);
    }
    
    return new Error('SDSM fetch failed: Unknown error');
  }
  
  /**
   * Handle detection algorithm errors
   */
  public static handleDetectionError(error: unknown, context: string): Error {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Error(`Pedestrian detection failed [${context}]: ${message}`);
  }
  
  /**
   * Handle monitoring lifecycle errors
   */
  public static handleMonitoringError(error: unknown): Error {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Error(`Pedestrian monitoring failed: ${message}`);
  }
  
  /**
   * Extract error message safely
   */
  public static getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return 'Unknown error occurred';
  }
  
  /**
   * Log error with context
   */
  public static logError(context: string, error: unknown): void {
    const message = this.getErrorMessage(error);
  }
  
  /**
   * Log warning with context
   */
  public static logWarning(context: string, message: string): void {
  }
  
  /**
   * Check if error is timeout related
   */
  public static isTimeoutError(error: unknown): boolean {
    return error instanceof Error && 
           (error.name === 'AbortError' || error.message.includes('timeout'));
  }
  
  /**
   * Check if error is network related
   */
  public static isNetworkError(error: unknown): boolean {
    return error instanceof Error &&
           (error.message.includes('fetch') ||
            error.message.includes('network') ||
            error.message.includes('connection'));
  }
}

export default PedestrianErrorHandler;