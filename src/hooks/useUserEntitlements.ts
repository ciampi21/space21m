import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface UserEntitlements {
  user_id: string;
  email: string;
  plan_tier: string;
  is_early_adopter: boolean;
  subscription_status: string | null;
  max_owned_workspaces: number;
  max_guest_memberships: number;
  storage_total_mb: number;
  post_expiry_days: number | null;
  features: any;
  storage_used_mb: number;
  billing_banner: string | null;
  past_due_since: string | null;
  grace_until: string | null;
}

export const useUserEntitlements = () => {
  const { profile } = useAuth();
  const [entitlements, setEntitlements] = useState<UserEntitlements | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEntitlements = async () => {
      if (!profile?.user_id) return;

      setLoading(true);
      setError(null);

      try {
        const { data, error } = await supabase
          .rpc('get_user_entitlements', { user_uuid: profile.user_id });

        if (error) {
          console.error('Error fetching user entitlements:', error);
          setError(error.message);
          return;
        }

        if (data && data.length > 0) {
          setEntitlements(data[0]);
        }
      } catch (err) {
        console.error('Error in fetchEntitlements:', err);
        setError('Failed to fetch user entitlements');
      } finally {
        setLoading(false);
      }
    };

    fetchEntitlements();
  }, [profile?.user_id]);

  return {
    entitlements,
    loading,
    error,
    refetch: () => {
      if (profile?.user_id) {
        // Re-trigger the effect by changing a dependency - we can call fetchEntitlements directly
        setLoading(true);
        setError(null);
        
        const fetchEntitlements = async () => {
          try {
            const { data, error } = await supabase
              .rpc('get_user_entitlements', { user_uuid: profile.user_id });

            if (error) {
              console.error('Error fetching user entitlements:', error);
              setError(error.message);
              return;
            }

            if (data && data.length > 0) {
              setEntitlements(data[0]);
            }
          } catch (err) {
            console.error('Error in fetchEntitlements:', err);
            setError('Failed to fetch user entitlements');
          } finally {
            setLoading(false);
          }
        };
        
        fetchEntitlements();
      }
    }
  };
};