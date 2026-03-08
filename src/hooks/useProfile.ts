import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Profile, AppRole } from '@/types';
import { toast } from 'sonner';

// Query key factory for organization
export const profileKeys = {
  all: ['profile'] as const,
  detail: (userId: string) => [...profileKeys.all, userId] as const,
};

// Hook to fetch user profile
export const useProfile = (userId: string | undefined) => {
  return useQuery({
    queryKey: profileKeys.detail(userId || ''),
    queryFn: async () => {
      if (!userId) throw new Error('No user ID');
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      
      return {
        ...data,
        role: data.role as AppRole,
        date_format: (data?.date_format as 'DD/MM/YYYY' | 'MM/DD/YYYY') || 'DD/MM/YYYY'
      } as Profile;
    },
    enabled: !!userId, // Only execute if userId exists
    staleTime: 10 * 60 * 1000, // 10 minutes (profile changes infrequently)
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
};

// Hook to update language
export const useUpdateLanguage = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userId, language }: { userId: string; language: string }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ language })
        .eq('user_id', userId);

      if (error) throw error;
      return language;
    },
    onSuccess: (language, { userId }) => {
      // Invalidate profile cache for automatic refetch
      queryClient.invalidateQueries({ queryKey: profileKeys.detail(userId) });
      toast.success('Language updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update language');
      console.error(error);
    },
  });
};
