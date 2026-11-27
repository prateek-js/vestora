import posthog from 'posthog-js';

const POSTHOG_TOKEN = import.meta.env.VITE_POSTHOG_TOKEN as string | undefined;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST as string | undefined;
let initialized = false;

export function initAnalytics(): void {
  if (!POSTHOG_TOKEN || !POSTHOG_HOST || typeof window === 'undefined') {
    if (import.meta.env.DEV && typeof window !== 'undefined') {
      if (!POSTHOG_TOKEN) {
        console.error(new Error('VITE_POSTHOG_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once VITE_POSTHOG_TOKEN is configured'));
      }
      if (!POSTHOG_HOST) {
        console.error(new Error('VITE_POSTHOG_HOST variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once VITE_POSTHOG_HOST is configured'));
      }
    }
    return;
  }

  posthog.init(POSTHOG_TOKEN, {
    api_host: POSTHOG_HOST,
    defaults: '2026-08-30',
    capture_exceptions: true,
    logs: {
      serviceName: 'vestora-web',
      environment: import.meta.env.MODE,
    },
  });
  initialized = true;
  logAnalytics('posthog_log_capture_initialized', {
    deployment_environment: import.meta.env.MODE,
  });
}

export function logAnalytics(message: string, attributes?: Record<string, unknown>): void {
  if (!initialized) return;
  try {
    posthog.log.info(message, attributes);
  } catch {
    // Log delivery must never break the app.
  }
}

export function trackEvent(event: string, properties?: Record<string, unknown>): void {
  if (!initialized) return;
  try {
    posthog.capture(event, properties);
  } catch {
    // Analytics must never break the app.
  }
}
