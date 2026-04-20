import { withRetry, isTransientError } from './retry';

// Runtime configuration
let runtimeConfig: {
  API_BASE_URL: string;
} | null = null;

// Configuration loading state
let configLoading = true;

// Default fallback configuration
const defaultConfig = {
  API_BASE_URL: 'http://127.0.0.1:8000', // Only used if runtime config fails to load
};

// Function to load runtime configuration with retry
export async function loadRuntimeConfig(): Promise<void> {
  try {
    console.log('🔧 DEBUG: Starting to load runtime config...');

    const response = await withRetry(
      async () => {
        const resp = await fetch('/api/config');
        // If the fetch itself succeeds but returns a 5xx with transient error body, retry
        if (!resp.ok && resp.status >= 500) {
          let bodyText = '';
          try {
            bodyText = await resp.clone().text();
          } catch {
            // ignore
          }
          if (isTransientError(bodyText)) {
            throw new Error(`Config endpoint error ${resp.status}: ${bodyText.slice(0, 200)}`);
          }
        }
        return resp;
      },
      { maxRetries: 2, label: 'loadRuntimeConfig' }
    );

    if (response.ok) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        runtimeConfig = await response.json();
        console.log('Runtime config loaded successfully');
      } else {
        console.log(
          'Config endpoint returned non-JSON response, skipping runtime config'
        );
      }
    } else {
      console.log(
        '🔧 DEBUG: Config fetch failed with status:',
        response.status
      );
    }
  } catch (error) {
    console.log('Failed to load runtime config, using defaults:', error);
  } finally {
    configLoading = false;
    console.log(
      '🔧 DEBUG: Config loading finished, configLoading set to false'
    );
  }
}

// Get current configuration
export function getConfig() {
  if (configLoading) {
    console.log('Config still loading, using default config');
    return defaultConfig;
  }

  if (runtimeConfig) {
    console.log('Using runtime config');
    return runtimeConfig;
  }

  if (import.meta.env.VITE_API_BASE_URL) {
    const viteConfig = {
      API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
    };
    console.log('Using Vite environment config');
    return viteConfig;
  }

  console.log('Using default config');
  return defaultConfig;
}

// Dynamic API_BASE_URL getter
export function getAPIBaseURL(): string {
  return getConfig().API_BASE_URL;
}

export const config = {
  get API_BASE_URL() {
    return getAPIBaseURL();
  },
};