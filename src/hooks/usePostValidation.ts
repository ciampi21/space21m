import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface ValidationResult {
  allowed: boolean;
  reason?: string;
  current_usage?: number;
  limit?: number;
}

export const usePostValidation = () => {
  const [isValidating, setIsValidating] = useState(false);
  const { profile } = useAuth();
  const { toast } = useToast();

  const validatePostLimits = useCallback(async (
    workspaceId: string,
    scheduledDate?: Date,
    mediaCount?: number
  ): Promise<ValidationResult> => {
    if (!profile?.user_id) {
      return { allowed: false, reason: 'Usuário não autenticado' };
    }

    // If no scheduled date is provided, allow the validation to pass
    // The form validation will catch the missing date
    if (!scheduledDate) {
      return { allowed: true };
    }

    setIsValidating(true);

    try {
      const { data, error } = await supabase.functions.invoke('validate-post-limits', {
        body: {
          workspace_id: workspaceId,
          user_id: profile.user_id,
          scheduled_date: scheduledDate.toISOString(),
          media_count: mediaCount || 0
        }
      });

      if (error) {
        console.error('Validation error:', error);
        return { allowed: false, reason: 'Erro ao validar limites' };
      }

      return data as ValidationResult;

    } catch (error) {
      console.error('Validation exception:', error);
      return { allowed: false, reason: 'Erro interno' };
    } finally {
      setIsValidating(false);
    }
  }, [profile?.user_id]);

  const showValidationError = useCallback((result: ValidationResult) => {
    if (!result.allowed && result.reason) {
      toast({
        title: 'Limite atingido',
        description: result.reason,
        variant: 'destructive',
        duration: 5000,
      });
    }
  }, [toast]);

  const checkMediaLimits = useCallback((fileCount: number, planTier: string = 'free'): boolean => {
    // Media per post limits removed - users can attach unlimited files per post
    return true;
  }, [toast]);

  const checkSchedulingLimits = useCallback((scheduledDate: Date, planTier: string = 'free'): boolean => {
    // Scheduling limits removed - all users can schedule posts for any future date
    return true;
  }, [toast]);

  return {
    validatePostLimits,
    showValidationError,
    checkMediaLimits,
    checkSchedulingLimits,
    isValidating
  };
};