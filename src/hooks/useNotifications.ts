import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContextNew';
import { useUserEntitlements } from './useUserEntitlements';
import { supabase } from '@/integrations/supabase/client';

export interface Notification {
  id: string;
  type: 'storage' | 'workspace_limit' | 'post_expiration' | 'support_response' | 'trial_expiration';
  priority: 'info' | 'warning' | 'urgent';
  title: string;
  message: string;
  createdAt: Date;
}

// Helper functions for managing seen notifications
const getSeenNotifications = (): Set<string> => {
  try {
    const seen = localStorage.getItem('dismissedNotifications');
    return seen ? new Set(JSON.parse(seen)) : new Set();
  } catch {
    return new Set();
  }
};

const markNotificationAsSeen = (notificationId: string) => {
  try {
    const seen = getSeenNotifications();
    seen.add(notificationId);
    localStorage.setItem('dismissedNotifications', JSON.stringify([...seen]));
  } catch {
    // Ignore localStorage errors
  }
};

export const useNotifications = () => {
  const { profile, user } = useAuth();
  const { workspaces, posts, currentWorkspace } = useWorkspace();
  const { entitlements } = useUserEntitlements();
  const [lastCheck, setLastCheck] = useState<Date>(new Date());
  const [seenNotifications, setSeenNotifications] = useState<Set<string>>(getSeenNotifications);
  const [supportTickets, setSupportTickets] = useState<any[]>([]);

  // Fetch support tickets with responses
  useEffect(() => {
    const fetchSupportTickets = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('support_tickets')
          .select('*')
          .eq('user_id', user.id)
          .not('admin_response', 'is', null)
          .order('responded_at', { ascending: false });

        if (!error && data) {
          setSupportTickets(data);
        }
      } catch (error) {
        console.error('Error fetching support tickets:', error);
      }
    };

    fetchSupportTickets();
  }, [user]);

  const notifications = useMemo(() => {
    if (!profile || !currentWorkspace || !entitlements) return [];

    const notifs: Notification[] = [];
    const now = new Date();

    // Get user entitlements from the actual database function
    const storageUsed = entitlements.storage_used_mb || 0;
    const storageTotal = entitlements.storage_total_mb || 1024;
    const maxWorkspaces = entitlements.max_owned_workspaces || 1;
    const ownedWorkspaces = workspaces.filter(w => w.owner_id === profile.user_id).length;

    // Storage warning (80% threshold)
    const storagePercentage = (storageUsed / storageTotal) * 100;
    if (storagePercentage >= 80) {
      notifs.push({
        id: 'storage-warning',
        type: 'storage',
        priority: storagePercentage >= 95 ? 'urgent' : 'warning',
        title: 'Storage Limit Warning',
        message: `Using ${Math.round(storagePercentage)}% of storage (${storageUsed}MB / ${storageTotal}MB)`,
        createdAt: now
      });
    }

    // Workspace limit warning (only when limit is reached)
    if (ownedWorkspaces >= maxWorkspaces && !seenNotifications.has('workspace-limit')) {
      notifs.push({
        id: 'workspace-limit',
        type: 'workspace_limit',
        priority: 'urgent',
        title: 'Workspace Limit Reached',
        message: `You have reached your workspace limit (${ownedWorkspaces}/${maxWorkspaces})`,
        createdAt: now
      });
    }

    // Posts expiring soon
    const currentWorkspacePosts = posts.filter(p => p.workspace_id === currentWorkspace.id);
    
    currentWorkspacePosts.forEach(post => {
      if (post.expire_at) {
        const expireDate = new Date(post.expire_at);
        const daysUntilExpiration = Math.ceil((expireDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysUntilExpiration <= 7 && daysUntilExpiration > 0) {
          const priority = daysUntilExpiration <= 1 ? 'urgent' : 'warning';
          
          notifs.push({
            id: `post-expiry-${post.id}`,
            type: 'post_expiration',
            priority,
            title: daysUntilExpiration === 1 ? 'Post expires tomorrow!' : 'Post expiring soon',
            message: `"${post.title}" expires in ${daysUntilExpiration} day${daysUntilExpiration > 1 ? 's' : ''}`,
            createdAt: now
          });
        }
      }
    });

    // Trial expiration warnings
    if (profile.subscription_status === 'trialing' && profile.trial_ends_at) {
      const trialEndsAt = new Date(profile.trial_ends_at);
      const daysRemaining = Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysRemaining <= 7 && daysRemaining > 0) {
        const notifId = `trial-warning-${daysRemaining}`;
        
        if (!seenNotifications.has(notifId)) {
          notifs.push({
            id: notifId,
            type: 'trial_expiration',
            priority: daysRemaining <= 3 ? 'urgent' : 'warning',
            title: daysRemaining === 1 ? 'Last day of trial!' : 'Trial expiring soon',
            message: daysRemaining === 1 
              ? '⚠️ Last day of trial! Upgrade now to keep PRO benefits.'
              : `⏰ Your trial ends in ${daysRemaining} days. Check out the Early Adopter offer!`,
            createdAt: now
          });
        }
      }
    }

    // Support ticket responses
    supportTickets.forEach(ticket => {
      if (ticket.admin_response && ticket.responded_at) {
        const respondedDate = new Date(ticket.responded_at);
        const daysSinceResponse = Math.floor((now.getTime() - respondedDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // Show notification for responses in the last 7 days
        if (daysSinceResponse <= 7) {
          notifs.push({
            id: `support-response-${ticket.id}`,
            type: 'support_response',
            priority: 'info',
            title: 'Support ticket response received',
            message: `Your ticket "${ticket.subject}" has been answered`,
            createdAt: respondedDate
          });
        }
      }
    });

    // Filter out seen/dismissed notifications
    const filteredNotifs = notifs.filter(notif => !seenNotifications.has(notif.id));

    // Sort by priority and creation date
    return filteredNotifs.sort((a, b) => {
      const priorityOrder = { urgent: 3, warning: 2, info: 1 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
  }, [profile, workspaces, posts, currentWorkspace, entitlements, lastCheck, seenNotifications, supportTickets]);

  // Update check timestamp periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setLastCheck(new Date());
    }, 5 * 60 * 1000); // Check every 5 minutes

    return () => clearInterval(interval);
  }, []);

  // Reset seen notifications when workspace count goes below limit
  useEffect(() => {
    if (entitlements && profile) {
      const ownedWorkspaces = workspaces.filter(w => w.owner_id === profile.user_id).length;
      const maxWorkspaces = entitlements.max_owned_workspaces || 1;
      
      if (ownedWorkspaces < maxWorkspaces && seenNotifications.has('workspace-limit')) {
        const newSeen = new Set(seenNotifications);
        newSeen.delete('workspace-limit');
        setSeenNotifications(newSeen);
        
        // Update localStorage
        try {
          localStorage.setItem('dismissedNotifications', JSON.stringify([...newSeen]));
        } catch {
          // Ignore localStorage errors
        }
      }
    }
  }, [workspaces, entitlements, profile, seenNotifications]);

  const dismissNotification = useCallback((notificationId: string) => {
    markNotificationAsSeen(notificationId);
    setSeenNotifications(prev => new Set([...prev, notificationId]));
  }, []);

  const urgentCount = notifications.filter(n => n.priority === 'urgent').length;
  const totalCount = notifications.length;

  return {
    notifications,
    urgentCount,
    totalCount,
    hasNotifications: totalCount > 0,
    dismissNotification
  };
};