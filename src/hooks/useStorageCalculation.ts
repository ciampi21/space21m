import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useStorageCalculation = () => {
  const [isCalculating, setIsCalculating] = useState(false);
  const { profile } = useAuth();

  const calculateAndUpdateStorageUsage = useCallback(async (): Promise<number> => {
    if (!profile?.user_id) return 0;

    setIsCalculating(true);
    
    try {
      // Get all workspaces owned by the user
      const { data: workspaces, error: workspacesError } = await supabase
        .from('workspaces')
        .select('id')
        .eq('owner_id', profile.user_id);

      if (workspacesError) {
        console.error('Error fetching workspaces:', workspacesError);
        return 0;
      }

      // Continue even if no workspaces to update profile to 0 MB
      const workspaceIds = workspaces?.map(w => w.id) || [];

      // Get total storage used across all owned workspaces from R2 media assets
      let mediaAssets = [];
      if (workspaceIds.length > 0) {
        const { data, error: mediaError } = await supabase
          .from('media_assets')
          .select('size_bytes')
          .in('workspace_id', workspaceIds)
          .is('deleted_at', null); // Only non-deleted assets

        if (mediaError) {
          console.error('Error fetching media assets:', mediaError);
          return 0;
        }
        
        mediaAssets = data || [];
      }

      // Calculate total storage in MB
      const totalBytes = mediaAssets.reduce((total, asset) => {
        return total + (asset.size_bytes || 0);
      }, 0);

      const totalMB = Math.round(totalBytes / (1024 * 1024));

      // Update user profile with the calculated storage
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ storage_used_mb: totalMB })
        .eq('user_id', profile.user_id);

      if (updateError) {
        console.error('Error updating storage usage:', updateError);
      }

      return totalMB;
    } catch (error) {
      console.error('Storage calculation error:', error);
      return 0;
    } finally {
      setIsCalculating(false);
    }
  }, [profile?.user_id]);

  return {
    calculateAndUpdateStorageUsage,
    isCalculating
  };
};