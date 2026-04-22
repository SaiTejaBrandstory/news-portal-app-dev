import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface SeoOptions {
  title?: string;
  description?: string;
  /** Override canonical URL. Defaults to origin + pathname (no query params). */
  canonicalPath?: string;
  /** Set to true for private pages (admin, auth) to prevent indexing. */
  noIndex?: boolean;
}

function upsertTag(selector: string, create: () => HTMLElement): HTMLElement {
  let el = document.head.querySelector(selector) as HTMLElement | null;
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  return el;
}

function upsertMeta(name: string, content: string) {
  const el = upsertTag(
    `meta[name="${name}"]`,
    () => {
      const m = document.createElement('meta');
      m.setAttribute('name', name);
      return m;
    }
  ) as HTMLMetaElement;
  el.setAttribute('content', content);
}

function upsertLink(rel: string, href: string) {
  const el = upsertTag(
    `link[rel="${rel}"]`,
    () => {
      const l = document.createElement('link');
      l.setAttribute('rel', rel);
      return l;
    }
  ) as HTMLLinkElement;
  el.setAttribute('href', href);
}

/**
 * Sets canonical URL and robots meta tag for the current page.
 * - Canonical: window.location.origin + pathname (no query params) by default.
 * - Robots: "index, follow" for public pages, "noindex, nofollow" for private.
 */
export function useSeoHead(options: SeoOptions = {}) {
  const location = useLocation();

  useEffect(() => {
    const { canonicalPath, noIndex = false, title, description } = options;

    const canonical =
      window.location.origin +
      (canonicalPath ?? location.pathname).replace(/\/$/, '') || '/';

    // Canonical link
    upsertLink('canonical', canonical);

    // Robots
    upsertMeta('robots', noIndex ? 'noindex, nofollow' : 'index, follow');

    // Optional title/description overrides
    if (title) document.title = title;
    if (description) upsertMeta('description', description);

    return () => {
      // Reset to safe defaults on unmount
      upsertLink('canonical', window.location.origin + '/');
      upsertMeta('robots', 'index, follow');
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, options.noIndex, options.title, options.description, options.canonicalPath]);
}
