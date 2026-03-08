import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export interface InstagramAccount {
  id: string;
  user_id: string;
  workspace_id: string;
  instagram_user_id: string;
  username: string;
  access_token: string;
  token_type: string;
  expires_at: string | null;
  account_type: string | null;
  profile_picture_url: string | null;
  instagram_business_account_id: string | null;
  page_id: string | null;
  can_publish: boolean;
  created_at: string;
  updated_at: string;
}

export const useInstagramAccounts = (workspaceId: string | null) => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['instagram-accounts', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];

      const { data, error } = await supabase
        .from('instagram_accounts')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching Instagram accounts:', error);
        throw error;
      }

      return data as InstagramAccount[];
    },
    enabled: !!workspaceId,
  });

  const connectMutation = useMutation({
    mutationFn: async (workspaceId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Not authenticated');
      }

      const { data, error } = await supabase.functions.invoke('instagram-oauth-start', {
        body: { workspaceId },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      return data.url;
    },
    onSuccess: (url) => {
      // Redirect to Instagram OAuth
      window.location.href = url;
    },
    onError: (error) => {
      console.error('Error starting Instagram OAuth:', error);
      toast.error(t('instagram.connectError', 'Failed to connect to Instagram'));
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async (accountId: string) => {
      const { error } = await supabase
        .from('instagram_accounts')
        .delete()
        .eq('id', accountId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instagram-accounts'] });
      toast.success(t('instagram.disconnected', 'Instagram account disconnected successfully'));
    },
    onError: (error) => {
      console.error('Error disconnecting Instagram account:', error);
      toast.error(t('instagram.disconnectError', 'Failed to disconnect Instagram account'));
    },
  });

  // Check if any account has publishing enabled
  const publishableAccount = accounts?.find(acc => acc.can_publish);

  return {
    accounts: accounts || [],
    isLoading,
    connect: connectMutation.mutate,
    isConnecting: connectMutation.isPending,
    disconnect: disconnectMutation.mutate,
    isDisconnecting: disconnectMutation.isPending,
    canPublish: !!publishableAccount,
    publishableAccount,
  };
};
