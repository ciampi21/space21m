import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Profile, AppRole } from '@/types';
import { useTranslation } from 'react-i18next';
import { EmailConfirmationModal } from '@/components/EmailConfirmationModal';
import { useToast } from '@/hooks/use-toast';
import { captureAcquisitionData, getStoredAcquisitionData } from '@/lib/acquisitionTracking';
import { useTrackingEvents } from '@/hooks/useTrackingEvents';
import { useQueryClient } from '@tanstack/react-query';
import { useProfile, useUpdateLanguage } from '@/hooks/useProfile';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, metadata?: any) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateLanguage: (language: string) => Promise<void>;
  showEmailConfirmation: boolean;
  setShowEmailConfirmation: (show: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEmailConfirmation, setShowEmailConfirmation] = useState(false);
  const [isResendingEmail, setIsResendingEmail] = useState(false);
  const { i18n } = useTranslation();
  const { toast } = useToast();
  const { trackSignupCompleted } = useTrackingEvents();
  const queryClient = useQueryClient();

  // Use React Query for profile
  const { data: profile, isLoading: profileLoading, refetch: refetchProfile } = useProfile(user?.id);
  const updateLanguageMutation = useUpdateLanguage();

  const refreshProfile = async () => {
    await refetchProfile();
  };

  useEffect(() => {
    let mounted = true;

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        
        setSession(session);
        setUser(session?.user ?? null);
        
        // Only show email confirmation modal for new signups, not existing logged users
        if (session?.user && !session.user.email_confirmed_at) {
          // Only show confirmation modal if this is likely a new signup
          // Don't show for users who are already actively using the system
          const isLikelyNewUser = !showEmailConfirmation && session.user.created_at && 
            new Date(session.user.created_at).getTime() > Date.now() - (24 * 60 * 60 * 1000); // Within last 24 hours
          
          if (isLikelyNewUser) {
            setShowEmailConfirmation(true);
          }
        } else if (session?.user?.email_confirmed_at) {
          setShowEmailConfirmation(false);
        }
        
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Set language from profile when it loads
  useEffect(() => {
    if (profile?.language && profile.language !== i18n.language) {
      i18n.changeLanguage(profile.language);
    }
  }, [profile?.language, i18n]);

  // Auto-hide email confirmation modal when email is confirmed (cross-tab detection)
  useEffect(() => {
    if (!showEmailConfirmation || !user) return;

    let intervalId: NodeJS.Timeout;
    let mounted = true;

    // Check email confirmation status every 5 seconds when modal is open
    const checkEmailConfirmation = async () => {
      if (!mounted) return;
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.email_confirmed_at && mounted) {
          setShowEmailConfirmation(false);
        }
      } catch (error) {
        console.error('Error checking email confirmation:', error);
      }
    };

    // Storage event listener for cross-tab session changes
    const handleStorageChange = (e: StorageEvent) => {
      if (!mounted) return;
      
      // Check if the auth storage key changed (indicating session update)
      if (e.key?.includes('supabase.auth.token')) {
        setTimeout(() => {
          if (mounted) {
            checkEmailConfirmation();
          }
        }, 100);
      }
    };

    // Start periodic checking
    intervalId = setInterval(checkEmailConfirmation, 5000);
    
    // Listen for storage changes across tabs
    window.addEventListener('storage', handleStorageChange);

    return () => {
      mounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [showEmailConfirmation, user]);

  // Helper function to get user's IP address
  const getUserIP = async (): Promise<string | null> => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch (error) {
      console.warn('Failed to get user IP:', error);
      return null;
    }
  };

  const signUp = async (email: string, password: string, metadata?: any) => {
    const redirectUrl = `${window.location.origin}/`;
    
    // Get acquisition data from localStorage
    const acquisitionData = localStorage.getItem('21m_acquisition_data');
    let parsedAcquisitionData = {};
    
    if (acquisitionData) {
      try {
        parsedAcquisitionData = JSON.parse(acquisitionData);
      } catch (e) {
        console.warn('Failed to parse acquisition data:', e);
      }
    }
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          ...metadata,
          ...parsedAcquisitionData,
          signup_ip: await getUserIP(),
        }
      }
    });
    
    // Track successful signup completion
    if (!error && data.user) {
      // Track referral if present (check multiple sources)
      const referralCode = localStorage.getItem('21m_referral_code') || metadata?.referralCode;
      
      // Track signup completion with referral code
      trackSignupCompleted(data.user.id, referralCode || undefined);
      
      if (referralCode) {
        console.log('[AuthContext] Attempting to track referral:', {
          referralCode,
          email,
          source: localStorage.getItem('21m_referral_code') ? 'localStorage' : 'metadata'
        });
        try {
          const { data: referralData, error: referralError } = await supabase.functions.invoke('track-referral', {
            body: {
              referralCode: referralCode,
              email: email,
              acquisitionData: parsedAcquisitionData
            }
          });
          if (referralError) {
            console.error('[AuthContext] Error tracking referral:', referralError);
          } else {
            console.log('[AuthContext] Referral tracked successfully:', referralData);
          }
          // Don't remove the code yet - it will be used in checkout
        } catch (referralError) {
          console.error('[AuthContext] Exception tracking referral:', referralError);
          // Don't fail the signup if tracking fails
        }
      } else {
        console.log('[AuthContext] No referral code found to track');
      }
    }
    
    // Send welcome email for free users if signup was successful
    if (!error && data.user && metadata?.username) {
      try {
        await supabase.functions.invoke('send-welcome-email', {
          body: {
            email,
            customerName: metadata.username,
            setupToken: data.user.id,
            trialDays: null
          }
        });
        console.log('Welcome email sent successfully');
        // Show email confirmation modal for new users
        setShowEmailConfirmation(true);
      } catch (emailError) {
        console.error('Error sending welcome email:', emailError);
        // Don't fail the signup if email fails
      }
    }
    
    return { error };
  };

  const resendConfirmationEmail = async () => {
    if (!user?.email) return;
    
    // Check if we're still in cooldown period
    const lastResendTime = localStorage.getItem('lastResendTime');
    const cooldownMinutes = 2;
    const cooldownMs = cooldownMinutes * 60 * 1000;
    
    if (lastResendTime) {
      const timeSinceLastResend = Date.now() - parseInt(lastResendTime);
      if (timeSinceLastResend < cooldownMs) {
        const remainingTime = Math.ceil((cooldownMs - timeSinceLastResend) / 1000);
        const minutes = Math.floor(remainingTime / 60);
        const seconds = remainingTime % 60;
        toast({
          title: "Too soon",
          description: `Please wait ${minutes}:${seconds.toString().padStart(2, '0')} before resending.`,
          variant: "destructive",
        });
        return;
      }
    }
    
    setIsResendingEmail(true);
    try {
      // Use the custom Edge Function instead of supabase.auth.resend
      const { error } = await supabase.functions.invoke('send-welcome-email', {
        body: {
          email: user.email,
          customerName: user.user_metadata?.display_name || user.email.split('@')[0],
          setupToken: user.id
        }
      });
      
      if (error) {
        console.error('Error from send-welcome-email:', error);
        toast({
          title: "Error",
          description: "Failed to resend confirmation email. Please try again.",
          variant: "destructive",
        });
      } else {
        // Store the timestamp for cooldown
        localStorage.setItem('lastResendTime', Date.now().toString());
        toast({
          title: "Email sent",
          description: "Confirmation email sent successfully. Please check your inbox.",
        });
      }
    } catch (error) {
      console.error('Error resending email:', error);
      toast({
        title: "Error",
        description: "Failed to resend confirmation email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsResendingEmail(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    return { error };
  };

  const forceSignOut = () => {
    console.log('Forcing logout - clearing local state and storage');
    // Clear local state
    setSession(null);
    setUser(null);
    
    // Clear React Query cache
    queryClient.clear();
    
    // Clear localStorage
    localStorage.clear();
    
    // Redirect to login
    window.location.href = '/auth';
  };

  const signOut = async () => {
    console.log('Attempting logout...');
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Logout error from Supabase:', error);
        
        // If session not found or other auth errors, force logout
        if (error.message?.includes('Session not found') || error.message?.includes('session_not_found')) {
          console.log('Session not found on server, forcing local logout');
          forceSignOut();
          return;
        }
        
        // For other errors, still try to clean up locally
        console.log('Other logout error, cleaning up locally anyway');
        forceSignOut();
        return;
      }
      
      // Clear React Query cache on successful logout
      queryClient.clear();
      console.log('Logout successful');
    } catch (error) {
      console.error('Unexpected error during logout:', error);
      // Force logout on any unexpected error
      forceSignOut();
    }
  };

  const updateLanguage = async (language: string) => {
    if (!user) return;
    
    try {
      // Update language in i18n first
      await i18n.changeLanguage(language);
      
      // Use React Query mutation to update in database
      await updateLanguageMutation.mutateAsync({ userId: user.id, language });
    } catch (error) {
      console.error('Error updating language:', error);
    }
  };

  const value = {
    user,
    session,
    profile,
    loading,
    signUp,
    signIn,
    signOut,
    refreshProfile,
    updateLanguage,
    showEmailConfirmation,
    setShowEmailConfirmation
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      <EmailConfirmationModal
        isOpen={showEmailConfirmation}
        onClose={() => setShowEmailConfirmation(false)}
        userEmail={user?.email || ''}
        onResendEmail={resendConfirmationEmail}
        isResending={isResendingEmail}
      />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}