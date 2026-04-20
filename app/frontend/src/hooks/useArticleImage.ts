import { useState, useEffect } from 'react';
import { client } from '@/lib/api';


const IMAGE_BUCKET = 'article-images';

/** Cache resolved URLs to avoid repeated API calls */
const urlCache = new Map<string, string>();

/** Track in-flight requests to deduplicate */
const pendingRequests = new Map<string, Promise<string | null>>();

/** Concurrency control: max simultaneous storage requests */
const MAX_CONCURRENT = 3;
let activeRequests = 0;
const requestQueue: Array<() => void> = [];

function acquireSlot(): Promise<void> {
  if (activeRequests < MAX_CONCURRENT) {
    activeRequests++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    requestQueue.push(() => {
      activeRequests++;
      resolve();
    });
  });
}

function releaseSlot(): void {
  activeRequests--;
  const next = requestQueue.shift();
  if (next) next();
}

/** Check if a string is a full URL (http/https) vs an object_key */
function isFullUrl(str: string): boolean {
  return str.startsWith('http://') || str.startsWith('https://');
}

/** Resolve a storage object key to a download URL with concurrency control */
async function resolveObjectKey(objectKey: string): Promise<string | null> {
  // Check cache
  const cached = urlCache.get(objectKey);
  if (cached) return cached;

  // Deduplicate in-flight requests for the same key
  const pending = pendingRequests.get(objectKey);
  if (pending) return pending;

  const promise = (async () => {
    await acquireSlot();
    try {
      const resp = await client.storage.getDownloadUrl({
        bucket_name: IMAGE_BUCKET,
        object_key: objectKey,
      });
      if (resp?.data?.download_url) {
        urlCache.set(objectKey, resp.data.download_url);
        return resp.data.download_url;
      }
      return null;
    } catch {
      // On failure (DNS timeout, network error), return null gracefully
      return null;
    } finally {
      releaseSlot();
      pendingRequests.delete(objectKey);
    }
  })();

  pendingRequests.set(objectKey, promise);
  return promise;
}

/**
 * Hook to resolve an article image URL.
 * Handles both full URLs (legacy) and object_key references (new uploads).
 * Uses concurrency-limited requests to prevent DNS resolver overload.
 */
export function useArticleImage(imageUrl: string | null | undefined, fallback?: string): string {
  const defaultFallback = fallback || '';
  const [resolvedUrl, setResolvedUrl] = useState<string>(() => {
    if (!imageUrl) return defaultFallback;
    if (isFullUrl(imageUrl)) return imageUrl;
    const cached = urlCache.get(imageUrl);
    if (cached) return cached;
    return defaultFallback;
  });

  useEffect(() => {
    if (!imageUrl) {
      setResolvedUrl(defaultFallback);
      return;
    }

    if (isFullUrl(imageUrl)) {
      setResolvedUrl(imageUrl);
      return;
    }

    // Check cache first
    const cached = urlCache.get(imageUrl);
    if (cached) {
      setResolvedUrl(cached);
      return;
    }

    // Resolve from object storage with concurrency control
    let cancelled = false;

    resolveObjectKey(imageUrl).then((url) => {
      if (!cancelled) {
        setResolvedUrl(url || defaultFallback);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [imageUrl, defaultFallback]);

  return resolvedUrl;
}

/**
 * Batch resolve multiple object keys with concurrency control.
 * Used by Admin page to resolve thumbnails without flooding DNS.
 */
export async function batchResolveImageUrls(
  items: Array<{ id: number; image_url: string | null }>
): Promise<Record<number, string>> {
  const urlMap: Record<number, string> = {};

  // First pass: resolve full URLs and cached keys immediately
  const toResolve: Array<{ id: number; objectKey: string }> = [];
  for (const item of items) {
    if (!item.image_url) continue;
    if (isFullUrl(item.image_url)) {
      urlMap[item.id] = item.image_url;
    } else {
      const cached = urlCache.get(item.image_url);
      if (cached) {
        urlMap[item.id] = cached;
      } else {
        toResolve.push({ id: item.id, objectKey: item.image_url });
      }
    }
  }

  // Second pass: resolve remaining keys with concurrency control
  if (toResolve.length > 0) {
    const results = await Promise.allSettled(
      toResolve.map(async ({ id, objectKey }) => {
        const url = await resolveObjectKey(objectKey);
        if (url) {
          urlMap[id] = url;
        }
      })
    );
    // Log failures for debugging but don't crash
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.warn(`Failed to resolve image for article ${toResolve[i].id}:`, r.reason);
      }
    });
  }

  return urlMap;
}