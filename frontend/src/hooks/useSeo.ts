import { useEffect } from 'react';

import { SITE } from '../config/site';

interface SeoOptions {
  /** Page title, without the site name — that is appended automatically. */
  title: string;
  description?: string;
  /** Keep a page out of search results (dashboards, anything behind auth). */
  noIndex?: boolean;
  /** Override the canonical path; defaults to the current pathname. */
  canonicalPath?: string;
}

function setMeta(selector: string, attr: 'name' | 'property', key: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(selector);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

/**
 * Give a route its own title, description and canonical URL.
 *
 * The app is a client-rendered SPA, so index.html can only carry defaults for
 * the home page — without this every route would share one title in the
 * browser tab, in bookmarks, in search results and in link previews.
 */
export function useSeo({ title, description, noIndex, canonicalPath }: SeoOptions) {
  useEffect(() => {
    const fullTitle = title === SITE.name ? title : `${title} | ${SITE.name}`;
    const desc = description ?? SITE.description;
    const path = canonicalPath ?? window.location.pathname;
    const canonical = `${SITE.url}${path}`;

    document.title = fullTitle;

    setMeta('meta[name="description"]', 'name', 'description', desc);
    setMeta('meta[property="og:title"]', 'property', 'og:title', fullTitle);
    setMeta('meta[property="og:description"]', 'property', 'og:description', desc);
    setMeta('meta[property="og:url"]', 'property', 'og:url', canonical);
    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', fullTitle);
    setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', desc);
    setMeta(
      'meta[name="robots"]',
      'name',
      'robots',
      noIndex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large',
    );

    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    link.href = canonical;
  }, [title, description, noIndex, canonicalPath]);
}

export default useSeo;
