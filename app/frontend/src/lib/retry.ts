/**
 * Centralized retry utility for handling transient DNS/balancer resolve errors
 * on Lambda URLs. Provides retry-with-backoff for both fetch() and generic async functions.
 */

/** Maximum number of retry attempts */
const MAX_RETRIES = 3;

/** Base delay in ms for exponential backoff */
const BASE_DELAY_MS = 1000;

/** Error message patterns that indicate transient/retryable failures */
const RETRYABLE_PATTERNS = [
  'dns',
  'balancer resolve',
  'ECONNREFUSED',
  'ENOTFOUND',
  'ETIMEDOUT',
  'timeout',
  'network error',
  'socket hang up',
  'failed to fetch',
  'load failed',
  'networkerror',
  'callback lock',
  'node cache',
  'aborted',
  'ERR_CONNECTION',
  'ERR_NAME_NOT_RESOLVED',
];

/** HTTP status codes that are retryable */
const RETRYABLE_STATUS_CODES = new Set([500, 502, 503, 504, 0]);

/** Sleep for a given number of milliseconds */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Calculate delay with exponential backoff + jitter */
function getBackoffDelay(attempt: number): number {
  return BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 500;
}

/**
 * Check if an error message matches known transient patterns
 */
export function isTransientError(error: unknown): boolean {
  const message = extractErrorMessage(error).toLowerCase();
  return RETRYABLE_PATTERNS.some((pattern) =>
    message.includes(pattern.toLowerCase())
  );
}

/**
 * Check if an HTTP status code is retryable
 */
export function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUS_CODES.has(status);
}

/**
 * Extract a human-readable error message from various error types
 */
function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/**
 * Retry wrapper for any async function with exponential backoff.
 * Only retries on transient errors (DNS, timeout, 5xx).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: {
    maxRetries?: number;
    label?: string;
    shouldRetry?: (error: unknown) => boolean;
  }
): Promise<T> {
  const maxRetries = options?.maxRetries ?? MAX_RETRIES;
  const label = options?.label ?? 'request';
  const shouldRetry = options?.shouldRetry ?? isTransientError;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries && shouldRetry(error)) {
        const delay = getBackoffDelay(attempt);
        console.warn(
          `[Retry] ${label}: transient error on attempt ${attempt + 1}/${maxRetries + 1}, retrying in ${Math.round(delay)}ms...`,
          extractErrorMessage(error)
        );
        await sleep(delay);
        continue;
      }

      throw error;
    }
  }

  throw lastError;
}

/**
 * Enhanced fetch with automatic retry on transient errors.
 * Drop-in replacement for window.fetch().
 */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: { maxRetries?: number; label?: string }
): Promise<Response> {
  const label =
    options?.label ??
    (typeof input === 'string'
      ? input.split('?')[0].split('/').slice(-2).join('/')
      : 'fetch');

  return withRetry(
    async () => {
      const response = await fetch(input, init);

      // Retry on 5xx server errors that match transient patterns
      if (isRetryableStatus(response.status)) {
        let bodyText = '';
        try {
          bodyText = await response.clone().text();
        } catch {
          // ignore
        }
        const combined = `${response.status} ${response.statusText} ${bodyText}`;
        if (isTransientError(combined)) {
          throw new Error(
            `Server error ${response.status}: ${bodyText.slice(0, 200)}`
          );
        }
      }

      return response;
    },
    {
      maxRetries: options?.maxRetries ?? MAX_RETRIES,
      label,
      shouldRetry: (error) => isTransientError(error),
    }
  );
}