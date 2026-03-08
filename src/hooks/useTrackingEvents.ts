import { useCallback } from 'react';
import { trackEvent, clearSessionData, type TrackingEventType } from '@/lib/acquisitionTracking';

export function useTrackingEvents() {
  const trackEventWithCallback = useCallback(async (eventType: TrackingEventType, userId?: string, referralCode?: string) => {
    try {
      await trackEvent(eventType, userId, referralCode);
    } catch (error) {
      console.error('Failed to track event:', error);
    }
  }, []);

  const trackSignupStarted = useCallback(() => {
    trackEventWithCallback('signup_started');
  }, [trackEventWithCallback]);

  const trackSignupCompleted = useCallback((userId: string, referralCode?: string) => {
    trackEventWithCallback('signup_completed', userId, referralCode);
    // Clear session data after successful signup
    setTimeout(() => clearSessionData(), 1000);
  }, [trackEventWithCallback]);

  const trackPageView = useCallback(() => {
    trackEventWithCallback('page_view');
  }, [trackEventWithCallback]);

  return {
    trackSignupStarted,
    trackSignupCompleted,
    trackPageView,
    trackEvent: trackEventWithCallback,
  };
}