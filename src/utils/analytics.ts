/**
 * Privacy-conscious product analytics, enabled only when a PostHog token is
 * provided at build time (VITE_POSTHOG_TOKEN). Without it this module is a
 * no-op — nothing loads, nothing is tracked. PostHog is loaded from CDN
 * rather than bundled so the zero-analytics build stays lean.
 */

declare global {
  interface Window {
    posthog?: {
      capture: (event: string, properties?: Record<string, unknown>) => void;
    };
  }
}

const POSTHOG_TOKEN = import.meta.env.VITE_POSTHOG_TOKEN as string | undefined;
const POSTHOG_HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? 'https://us.i.posthog.com';

export function initAnalytics(): void {
  if (!POSTHOG_TOKEN || typeof window === 'undefined') return;

  // Trust the build-time token; inject the official posthog-js lite snippet.
  const script = document.createElement('script');
  script.src = `${POSTHOG_HOST}/static/array.js`;
  script.async = true;
  script.onload = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    w.posthog = w.posthog || [];
    w.posthog.init = w.posthog.init || ((...args: unknown[]) => w.posthog.push(args));
    w.posthog.init(POSTHOG_TOKEN, { api_host: POSTHOG_HOST, autocapture: false });
  };
  document.head.appendChild(script);
}

/** No-op unless analytics is configured. Safe to call anywhere. */
export function trackEvent(event: string, properties?: Record<string, unknown>): void {
  try {
    window.posthog?.capture(event, properties);
  } catch {
    // Analytics must never break the app.
  }
}
