export type SeoViewKey = 'home' | 'overview' | 'rebalance' | 'radar' | 'tax' | 'simulator';

interface SeoMetaConfig {
  title: string;
  description: string;
}

const VIEW_SEO: Record<SeoViewKey, SeoMetaConfig> = {
  home: {
    title: 'Vestora - Unified Wealth & Reinvestment OS',
    description:
      'Rebalance Mutual Funds, FDs, NPS, RBI G-Secs, Gold & Home Loans in one unbiased portal. Live yields, tax audit & stress tests — 0% fees, 100% on-device.',
  },
  overview: {
    title: 'Portfolio Overview – Vestora Wealth',
    description:
      'Track Mutual Funds, FDs, Demat Stocks, SGBs, EPF, NPS & active loans in one private on-device dashboard with Excel/CSV import and live FX.',
  },
  rebalance: {
    title: 'Smart Rebalance & Market Explorer – Vestora Wealth',
    description:
      'Compare 40,000+ live AMFI Direct Mutual Funds, NPS Tier-I, RBI G-Secs, Gold & Home Loan prepayment math to rebalance without commissions.',
  },
  radar: {
    title: 'FD, Bond & SGB Maturity Radar – Vestora Wealth',
    description:
      'Spot matured and upcoming Fixed Deposits, Sovereign Gold Bonds, and corporate bonds across 30/60/90 days with post-tax reinvestment plans.',
  },
  tax: {
    title: 'Tax Harvesting & 80C / NPS Audit – Vestora Wealth',
    description:
      'Audit Indian Section 80C, 80CCD(1B) NPS headroom, FD tax drag, and annual ₹1.25L equity LTCG tax-free harvesting opportunities locally.',
  },
  simulator: {
    title: '5-Year Macro Stress Simulator – Vestora Wealth',
    description:
      'Stress-test your multi-asset portfolio against equity drawdowns, inflation spikes, RBI rate hikes, and gold rallies with 5-year projections.',
  },
};

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonical(href: string) {
  let link = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

/**
 * Keeps document title, meta descriptions, social tags, and canonical URL
 * dynamically synced with the active SPA view and deployment origin.
 */
export function syncDocumentSeo(view: SeoViewKey) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const cfg = VIEW_SEO[view] ?? VIEW_SEO.home;
  const canonicalUrl = `${window.location.origin}${window.location.pathname}`;

  document.title = cfg.title;
  upsertCanonical(canonicalUrl);
  upsertMeta('name', 'description', cfg.description);
  upsertMeta('property', 'og:url', canonicalUrl);
  upsertMeta('property', 'og:title', cfg.title);
  upsertMeta('property', 'og:description', cfg.description);
  upsertMeta('name', 'twitter:title', cfg.title);
  upsertMeta('name', 'twitter:description', cfg.description);
}
