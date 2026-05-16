type EventName =
  | 'signup_complete'
  | 'verify_complete'
  | 'job_apply'
  | 'job_post'
  | 'message_send'
  | 'connection_accept'
  | 'profile_view'
  | 'search_query';

interface EventProperties {
  userId?: string;
  [key: string]: unknown;
}

export function trackEvent(event: EventName, properties?: EventProperties): void {
  if (process.env.POSTHOG_API_KEY) {
    // PostHog integration — will wire up when POSTHOG_API_KEY is set
    // For now, log to stdout in dev for visibility
    if (process.env.NODE_ENV === 'development') {
      console.log(`[analytics] ${event}`, properties ?? {});
    }
    return;
  }

  if (process.env.NODE_ENV === 'development') {
    console.log(`[analytics:stub] ${event}`, properties ?? {});
  }
}
