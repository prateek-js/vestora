import type { SeoViewKey } from './seo.ts';

export type AppTab = 'overview' | 'rebalance' | 'radar' | 'tax' | 'simulator';

const HASH_TO_TAB: Record<string, AppTab> = {
  '#overview': 'overview',
  '#rebalance': 'rebalance',
  '#radar': 'radar',
  '#tax': 'tax',
  '#simulator': 'simulator',
};

/** Maps a location hash to a tab. Empty, legacy (#story) and unknown hashes land on Overview. */
export function tabFromHash(hash: string): AppTab {
  return HASH_TO_TAB[hash.toLowerCase()] ?? 'overview';
}

export interface UrlSync {
  seoView: SeoViewKey;
  nextHash: string | null;
}

/**
 * Decides the SEO view and any hash rewrite for the active tab.
 * Overview with no hash is the landing page: it keeps the home SEO and a clean URL.
 */
export function planUrlSync(tab: AppTab, currentHash: string): UrlSync {
  const hash = currentHash.toLowerCase();
  if (tab === 'overview' && hash === '') {
    return { seoView: 'home', nextHash: null };
  }
  const desired = `#${tab}`;
  return { seoView: tab, nextHash: hash === desired ? null : desired };
}
