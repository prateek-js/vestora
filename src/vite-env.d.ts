/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** PostHog project token; analytics stays disabled when unset. */
  readonly VITE_POSTHOG_TOKEN?: string;
  /** PostHog host (defaults to US cloud). */
  readonly VITE_POSTHOG_HOST?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
