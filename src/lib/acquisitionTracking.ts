// Acquisition tracking utilities
export interface AcquisitionData {
  source?: string;
  medium?: string;
  campaign?: string;
  referrer_url?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  utm_id?: string;
  page_url?: string;
  user_agent?: string;
  session_id?: string;
}

export type TrackingEventType = 'page_view' | 'signup_started' | 'signup_completed' | 'signup' | 'payment_completed';

const ACQUISITION_STORAGE_KEY = '21m_acquisition_data';
const SESSION_STORAGE_KEY = '21m_session_id';

export function getUTMParams(): Record<string, string> {
  const urlParams = new URLSearchParams(window.location.search);
  const utmParams: Record<string, string> = {};
  
  const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id'];
  utmKeys.forEach(key => {
    const value = urlParams.get(key);
    if (value) {
      utmParams[key] = value;
    }
  });
  
  return utmParams;
}

export function detectAcquisitionSource(referrer: string, utmSource?: string): string {
  if (utmSource) return utmSource;
  
  if (!referrer || referrer === window.location.origin) return 'direct';
  
  const referrerLower = referrer.toLowerCase();
  
  if (referrerLower.includes('google.com')) return 'google';
  if (referrerLower.includes('facebook.com') || referrerLower.includes('fb.com')) return 'facebook';
  if (referrerLower.includes('instagram.com')) return 'instagram';
  if (referrerLower.includes('linkedin.com')) return 'linkedin';
  if (referrerLower.includes('twitter.com') || referrerLower.includes('x.com')) return 'twitter';
  if (referrerLower.includes('producthunt.com')) return 'product_hunt';
  if (referrerLower.includes('lovable.dev') || referrerLower.includes('lovable.app')) return 'lovable';
  if (referrerLower.includes('discord.com') || referrerLower.includes('discord.gg')) return 'discord';
  if (referrerLower.includes('bing.com')) return 'bing';
  if (referrerLower.includes('yahoo.com')) return 'yahoo';
  if (referrerLower.includes('duckduckgo.com')) return 'duckduckgo';
  
  return 'referral';
}

/**
 * Checks if a URL is a Lovable preview/development URL that should not be tracked
 */
export function isLovablePreviewUrl(url: string): boolean {
  if (!url) return false;
  
  // Check for Lovable preview patterns
  return url.includes('sandbox.lovable.dev') || 
         url.includes('id-preview-') ||
         /https?:\/\/id-preview-.*\.sandbox\.lovable\.dev/.test(url);
}

/**
 * Checks if the current page is an email confirmation page
 */
export function isEmailConfirmationPage(): boolean {
  const url = window.location.href;
  const urlParams = new URLSearchParams(window.location.search);
  
  // Check for confirmation URL patterns
  return url.includes('token_hash') ||
         url.includes('type=signup') ||
         url.includes('type=email_confirmation') ||
         urlParams.get('type') === 'signup' ||
         urlParams.get('type') === 'email_confirmation' ||
         window.location.pathname.includes('/auth/confirm');
}

export function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function getOrCreateSessionId(): string {
  try {
    let sessionId = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!sessionId) {
      sessionId = generateSessionId();
      localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
    }
    return sessionId;
  } catch (error) {
    console.warn('Failed to manage session ID:', error);
    return generateSessionId(); // Fallback to in-memory session
  }
}

export function captureAcquisitionData(): AcquisitionData {
  const utmParams = getUTMParams();
  const referrer = document.referrer;
  const currentUrl = window.location.href;
  const sessionId = getOrCreateSessionId();
  
  // Filter out Lovable preview URLs
  const filteredReferrer = (referrer && !isLovablePreviewUrl(referrer)) ? referrer : undefined;
  const filteredPageUrl = !isLovablePreviewUrl(currentUrl) ? currentUrl : undefined;
  
  // 🆕 PRIORIDADE: Capturar código de referral ANTES de detectar source
  const urlParams = new URLSearchParams(window.location.search);
  const referralCode = urlParams.get('ref');
  
  let source: string;
  
  if (referralCode) {
    // Se tem código de referral, classificar como "referral_offer"
    source = 'referral_offer';
    // Salvar em localStorage para usar no signup
    localStorage.setItem('21m_referral_code', referralCode);
  } else {
    // Caso contrário, detectar source normalmente
    source = detectAcquisitionSource(filteredReferrer || '', utmParams.utm_source);
  }
  
  const acquisitionData: AcquisitionData = {
    source,
    medium: utmParams.utm_medium,
    campaign: utmParams.utm_campaign,
    referrer_url: filteredReferrer,
    utm_source: utmParams.utm_source,
    utm_medium: utmParams.utm_medium,
    utm_campaign: utmParams.utm_campaign,
    utm_content: utmParams.utm_content,
    utm_term: utmParams.utm_term,
    utm_id: utmParams.utm_id,
    page_url: filteredPageUrl,
    user_agent: navigator.userAgent,
    session_id: sessionId,
  };
  
  return acquisitionData;
}

export function storeAcquisitionData(data: AcquisitionData): void {
  try {
    localStorage.setItem(ACQUISITION_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn('Failed to store acquisition data:', error);
  }
}

export function getStoredAcquisitionData(): AcquisitionData | null {
  try {
    const stored = localStorage.getItem(ACQUISITION_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.warn('Failed to retrieve acquisition data:', error);
    return null;
  }
}

export function clearAcquisitionData(): void {
  try {
    localStorage.removeItem(ACQUISITION_STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear acquisition data:', error);
  }
}

export async function getHistoricalAcquisitionData(userId: string): Promise<AcquisitionData | null> {
  try {
    // Import supabase client dynamically to avoid circular dependencies
    const { supabase } = await import('@/integrations/supabase/client');
    
    // Get historical acquisition data from user profile
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('acquisition_source, acquisition_medium, acquisition_campaign, referrer_url, utm_source, utm_medium, utm_campaign, utm_content, utm_term, utm_id')
      .eq('user_id', userId)
      .single();

    if (error || !profile) {
      console.log('No historical acquisition data found for user');
      return null;
    }

    // Check if profile has any acquisition data
    if (!profile.acquisition_source && !profile.utm_source) {
      return null;
    }

    return {
      source: profile.acquisition_source,
      medium: profile.acquisition_medium,
      campaign: profile.acquisition_campaign,
      referrer_url: profile.referrer_url,
      utm_source: profile.utm_source,
      utm_medium: profile.utm_medium,
      utm_campaign: profile.utm_campaign,
      utm_content: profile.utm_content,
      utm_term: profile.utm_term,
      utm_id: profile.utm_id,
      session_id: getOrCreateSessionId(),
      page_url: window.location.href,
      user_agent: navigator.userAgent,
    };
  } catch (error) {
    console.warn('Failed to get historical acquisition data:', error);
    return null;
  }
}

export async function trackEvent(eventType: TrackingEventType, userId?: string, referralCode?: string): Promise<void> {
  try {
    let data: AcquisitionData;

    // For payment events with a user ID, try to use historical data first
    if (eventType === 'payment_completed' && userId) {
      const historicalData = await getHistoricalAcquisitionData(userId);
      if (historicalData) {
        console.log('Using historical acquisition data for payment event');
        data = historicalData;
      } else {
        console.log('No historical data found, using current session data');
        data = captureAcquisitionData();
      }
    } else {
      data = captureAcquisitionData();
    }
    
    const eventData = {
      user_id: userId || null,
      event_type: eventType,
      source: data.source,
      medium: data.medium,
      campaign: data.campaign,
      referrer_url: data.referrer_url,
      utm_source: data.utm_source,
      utm_medium: data.utm_medium,
      utm_campaign: data.utm_campaign,
      utm_content: data.utm_content,
      utm_term: data.utm_term,
      utm_id: data.utm_id,
      page_url: data.page_url,
      user_agent: data.user_agent,
      session_id: data.session_id,
      ip_address: null, // Will be determined server-side
      referralCode: referralCode || null, // Include referral code
    };

    // Import supabase client dynamically to avoid circular dependencies
    const { supabase } = await import('@/integrations/supabase/client');
    
    // Call the track-acquisition edge function
    const { error } = await supabase.functions.invoke('track-acquisition', {
      body: eventData
    });

    if (error) {
      console.error('Failed to track event:', error);
    }
  } catch (error) {
    console.error('Error tracking event:', error);
  }
}

export function clearSessionData(): void {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    clearAcquisitionData();
  } catch (error) {
    console.warn('Failed to clear session data:', error);
  }
}

export async function initAcquisitionTracking(): Promise<void> {
  // Skip tracking on Lovable preview pages
  if (isLovablePreviewUrl(window.location.href)) {
    console.log('Skipping acquisition tracking on Lovable preview page');
    return;
  }

  // Skip tracking on email confirmation pages
  if (isEmailConfirmationPage()) {
    console.log('Skipping acquisition tracking on email confirmation page');
    return;
  }

  // Skip page_view tracking on thank-you page (only payment_completed should fire there)
  if (window.location.pathname === '/thank-you') {
    console.log('Skipping page_view tracking on thank-you page');
    return;
  }

  // Check if user is authenticated using robust Supabase auth check
  let isAuthenticated = false;
  let currentUser = null;
  
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (!error && user) {
      isAuthenticated = true;
      currentUser = user;
      console.log('User is authenticated:', user.id);
    }
  } catch (error) {
    console.warn('Failed to check authentication status:', error);
  }
  
  // For authenticated users, check if they already have acquisition history
  if (isAuthenticated && currentUser) {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      
      // Check if user already has acquisition events
      const { data: existingEvents, error } = await supabase
        .from('user_acquisition_events')
        .select('id, event_type')
        .eq('user_id', currentUser.id)
        .limit(1);
      
      if (!error && existingEvents && existingEvents.length > 0) {
        console.log('User already has acquisition history, skipping page_view tracking');
        return;
      }
    } catch (error) {
      console.warn('Failed to check acquisition history:', error);
    }
  }
  
  // Only track if this appears to be an acquisition visit (has UTMs, referrer, or is first visit)
  const utmParams = getUTMParams();
  const hasUTMs = Object.values(utmParams).some(value => value);
  const hasReferrer = document.referrer && !document.referrer.includes(window.location.hostname) && !isLovablePreviewUrl(document.referrer);
  const existing = getStoredAcquisitionData();
  
  // For anonymous users or first-time authenticated users without history
  if (hasUTMs || hasReferrer || !existing) {
    console.log('Tracking page view for acquisition visitor');
    trackEvent('page_view');
    
    // Store acquisition data for first-time visitors
    if (!existing) {
      const data = captureAcquisitionData();
      storeAcquisitionData(data);
    }
  } else {
    console.log('Skipping acquisition tracking - no UTMs, referrer, or existing data');
  }
}