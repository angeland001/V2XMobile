export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export class RetryService {
  /**
   * Determine if an error is transient (should retry) or permanent (should fail immediately)
   * Transient: network timeouts, 5xx server errors
   * Permanent: 4xx client errors, malformed requests
   */
  static isTransientError(status: number | null, error: Error): boolean {
    // Network/timeout errors
    if (
      error.message.includes('timeout') ||
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('ETIMEDOUT') ||
      error.message.includes('Network') ||
      status === null // Network error, no status code
    ) {
      return true;
    }

    // Server errors (5xx)
    if (status !== null && status >= 500 && status < 600) {
      return true;
    }

    return false;
  }

  /**
   * Retry a promise-returning function with exponential backoff
   * Only retries on transient errors
   */
  static async withRetry<T>(
    fn: () => Promise<T>,
    config: Partial<RetryConfig> = {},
  ): Promise<T> {
    const cfg: RetryConfig = {
      maxRetries: 3,
      initialDelayMs: 100,
      maxDelayMs: 400,
      backoffMultiplier: 2,
      ...config,
    };

    let lastError: Error | null = null;
    let delay = cfg.initialDelayMs;

    for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        // Check if this error should be retried
        const isTransient = this.isTransientError(null, lastError);

        if (attempt < cfg.maxRetries && isTransient) {
          console.log(
            `[Retry] Attempt ${attempt + 1}/${cfg.maxRetries} failed, retrying in ${delay}ms...`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay = Math.min(delay * cfg.backoffMultiplier, cfg.maxDelayMs);
        } else {
          // Either no more retries, or error is permanent
          if (!isTransient) {
            console.log('[Retry] Permanent error - not retrying');
          }
          throw lastError;
        }
      }
    }

    // Should not reach here, but just in case
    throw lastError || new Error('Unknown error');
  }

  /**
   * Retry a fetch call with HTTP status aware error classification
   */
  static async withFetchRetry<T>(
    fn: () => Promise<Response>,
    responseHandler: (response: Response) => Promise<T>,
    config: Partial<RetryConfig> = {},
  ): Promise<T> {
    const cfg: RetryConfig = {
      maxRetries: 3,
      initialDelayMs: 100,
      maxDelayMs: 400,
      backoffMultiplier: 2,
      ...config,
    };

    let lastError: Error | null = null;
    let delay = cfg.initialDelayMs;

    for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
      try {
        const response = await fn();

        // Check HTTP status
        if (!response.ok) {
          const isTransient = response.status >= 500;

          if (isTransient && attempt < cfg.maxRetries) {
            console.log(
              `[Retry] Attempt ${attempt + 1}/${cfg.maxRetries} failed (HTTP ${response.status}), retrying in ${delay}ms...`,
            );
            await new Promise((resolve) => setTimeout(resolve, delay));
            delay = Math.min(delay * cfg.backoffMultiplier, cfg.maxDelayMs);
            continue; // Try again
          } else {
            // Permanent error or out of retries
            const errorMsg = `HTTP ${response.status}`;
            throw new Error(errorMsg);
          }
        }

        // Response is OK, process it
        return await responseHandler(response);
      } catch (error) {
        lastError = error as Error;

        // Check if network error (should retry)
        const isTransient = this.isTransientError(null, lastError);

        if (attempt < cfg.maxRetries && isTransient) {
          console.log(
            `[Retry] Attempt ${attempt + 1}/${cfg.maxRetries} failed (${lastError.message}), retrying in ${delay}ms...`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay = Math.min(delay * cfg.backoffMultiplier, cfg.maxDelayMs);
        } else {
          // Either no more retries, or error is permanent
          if (!isTransient) {
            console.log('[Retry] Permanent error - not retrying');
          }
          throw lastError;
        }
      }
    }

    // Should not reach here
    throw lastError || new Error('Unknown error');
  }
}
