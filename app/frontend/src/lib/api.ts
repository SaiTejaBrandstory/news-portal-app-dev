import { createClient } from '@metagptx/web-sdk';
import { withRetry, isTransientError } from './retry';

const AUTH_REDIRECT_LOCK_KEY = 'auth_redirect_in_progress';

function getErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const e = error as {
    status?: number;
    response?: { status?: number };
    data?: { status?: number };
  };
  return e.response?.status ?? e.status ?? e.data?.status;
}

function handleUnauthorized(): void {
  // Prevent redirect storms when multiple concurrent requests fail at once.
  if (sessionStorage.getItem(AUTH_REDIRECT_LOCK_KEY) === '1') return;
  sessionStorage.setItem(AUTH_REDIRECT_LOCK_KEY, '1');
  window.location.href = '/';
}

/**
 * Create a resilient API client that wraps the SDK client
 * with automatic retry logic for transient DNS/network errors.
 */
function createResilientClient() {
  const rawClient = createClient();

  /**
   * Wrap any async SDK method with retry logic.
   * Returns a proxy that intercepts method calls.
   */
  function wrapWithRetry<T extends (...args: unknown[]) => Promise<unknown>>(
    fn: T,
    label: string
  ): T {
    return (async (...args: unknown[]) => {
      try {
        return await withRetry(() => fn(...args), {
          label,
          shouldRetry: isTransientError,
        });
      } catch (error) {
        if (getErrorStatus(error) === 401) {
          handleUnauthorized();
        }
        throw error;
      }
    }) as unknown as T;
  }

  /**
   * Create a proxy for an entity that wraps all methods with retry.
   */
  function createEntityProxy(entityName: string) {
    return new Proxy(
      {},
      {
        get(_target, method: string) {
          const rawEntity =
            rawClient.entities[entityName as keyof typeof rawClient.entities];
          if (!rawEntity) return undefined;
          const rawMethod = (rawEntity as Record<string, unknown>)[method];
          if (typeof rawMethod !== 'function') return rawMethod;
          return wrapWithRetry(
            rawMethod.bind(rawEntity) as (
              ...args: unknown[]
            ) => Promise<unknown>,
            `entities.${entityName}.${method}`
          );
        },
      }
    );
  }

  // Wrap apiCall.invoke
  const apiCall = {
    invoke: wrapWithRetry(
      rawClient.apiCall.invoke.bind(rawClient.apiCall) as (
        ...args: unknown[]
      ) => Promise<unknown>,
      'apiCall.invoke'
    ),
  };

  // Wrap storage methods
  const storage = new Proxy(
    {},
    {
      get(_target, method: string) {
        const rawMethod = (rawClient.storage as Record<string, unknown>)[
          method
        ];
        if (typeof rawMethod !== 'function') return rawMethod;
        return wrapWithRetry(
          rawMethod.bind(rawClient.storage) as (
            ...args: unknown[]
          ) => Promise<unknown>,
          `storage.${method}`
        );
      },
    }
  ) as typeof rawClient.storage;

  // Wrap auth methods (except toLogin which is synchronous)
  const auth = {
    login: wrapWithRetry(
      rawClient.auth.login.bind(rawClient.auth),
      'auth.login'
    ),
    me: wrapWithRetry(rawClient.auth.me.bind(rawClient.auth), 'auth.me'),
    logout: wrapWithRetry(
      rawClient.auth.logout.bind(rawClient.auth),
      'auth.logout'
    ),
    toLogin: rawClient.auth.toLogin.bind(rawClient.auth),
  };

  // Wrap AI methods
  const ai = new Proxy(
    {},
    {
      get(_target, method: string) {
        const rawMethod = (rawClient.ai as Record<string, unknown>)[method];
        if (typeof rawMethod !== 'function') return rawMethod;
        return wrapWithRetry(
          rawMethod.bind(rawClient.ai) as (
            ...args: unknown[]
          ) => Promise<unknown>,
          `ai.${method}`
        );
      },
    }
  ) as typeof rawClient.ai;

  // Entities proxy - dynamically wraps any entity access
  const entities = new Proxy(
    {},
    {
      get(_target, entityName: string) {
        return createEntityProxy(entityName);
      },
    }
  ) as typeof rawClient.entities;

  return {
    auth,
    entities,
    apiCall,
    storage,
    ai,
    integrations: rawClient.integrations,
    frame: rawClient.frame,
    utils: rawClient.utils,
  };
}

/** Singleton resilient client instance */
export const client = createResilientClient();

/**
 * Re-export createClient for backward compatibility,
 * but consumers should prefer the singleton `client` export.
 */
export { createResilientClient as createResilientClient };