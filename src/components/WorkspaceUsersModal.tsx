import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { Users, UserCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface WorkspaceUser {
  id: string;
  email: string;
  username?: string;
  workspace_role: string;
  invited_at?: string;
}

interface WorkspaceUsersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  workspaceName: string;
}

const WorkspaceUsersModal = ({ open, onOpenChange, workspaceId, workspaceName }: WorkspaceUsersModalProps) => {
  const { t } = useTranslation();
  const [users, setUsers] = useState<WorkspaceUser[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && workspaceId) {
      fetchWorkspaceUsers();
    }
  }, [open, workspaceId]);

  const fetchWorkspaceUsers = async () => {
    setLoading(true);
    try {
      // Get workspace owner
      const { data: workspace, error: workspaceError } = await supabase
        .from('workspaces')
        .select('owner_id')
        .eq('id', workspaceId)
        .single();

      if (workspaceError) {
        console.error('Error fetching workspace:', workspaceError);
        return;
      }

      // Get workspace members with roles
      const { data: members, error: membersError } = await supabase
        .from('workspace_members')
        .select('user_id, workspace_role, invited_at')
        .eq('workspace_id', workspaceId);

      if (membersError) {
        console.error('Error fetching workspace members:', membersError);
        return;
      }

      // Use secure RPC function to get member profiles (only safe fields)
      const { data: memberProfiles, error: profilesError } = await supabase
        .rpc('get_workspace_members_safe', { workspace_uuid: workspaceId });

      if (profilesError) {
        console.error('Error fetching member profiles:', profilesError);
        return;
      }

      const allUsers: WorkspaceUser[] = [];

      // Find owner profile from the safe profiles list
      const ownerProfile = memberProfiles?.find(p => p.user_id === workspace.owner_id);

      // Add owner
      if (ownerProfile) {
        allUsers.push({
          id: ownerProfile.user_id,
          email: ownerProfile.email,
          username: ownerProfile.username,
          workspace_role: 'owner',
        });
      }

      // Add members (excluding owner)
      members?.forEach((member) => {
        if (member.user_id !== workspace.owner_id) {
          const profile = memberProfiles?.find(p => p.user_id === member.user_id);
          if (profile) {
            allUsers.push({
              id: profile.user_id,
              email: profile.email,
              username: profile.username,
              workspace_role: member.workspace_role,
              invited_at: member.invited_at,
            });
          }
        }
      });

      // Add pending invitations (not yet accepted)
      const { data: invitations, error: invitationsError } = await supabase
        .from('invitations')
        .select('token, email, created_at, accepted_at')
        .eq('workspace_id', workspaceId)
        .is('accepted_at', null);

      if (invitationsError) {
        console.warn('Could not fetch invitations:', invitationsError);
      } else {
        invitations?.forEach((inv) => {
          // Avoid duplicates if the email is already a member
          const alreadyMember = allUsers.some(u => u.email === inv.email);
          if (!alreadyMember) {
            allUsers.push({
              id: `invitation-${inv.token}`,
              email: inv.email,
              workspace_role: 'invited',
              invited_at: inv.created_at,
            });
          }
        });
      }

      setUsers(allUsers);
    } catch (error) {
      console.error('Error fetching workspace users:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRoleColor = (workspace_role: string) => {
    switch (workspace_role) {
      case 'owner':
        return 'bg-primary text-primary-foreground';
      case 'guest':
        return 'bg-muted text-muted-foreground';
      case 'invited':
        return 'bg-amber-100 text-amber-800';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getUserInitials = (email: string, username?: string) => {
    if (username) {
      return username.substring(0, 2).toUpperCase();
    }
    return email.substring(0, 2).toUpperCase();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t('workspace.workspaceUsers')}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{workspaceName}</p>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <>
              {users.length === 0 ? (
                <div className="text-center py-8">
                  <UserCircle className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">{t('workspace.noUsersFound')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {users.map((user, index) => (
                    <div key={user.id}>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {getUserInitials(user.email, user.username)}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">
                              {user.username || user.email}
                            </p>
                            <Badge variant="secondary" className={getRoleColor(user.workspace_role)}>
                              {user.workspace_role === 'owner' ? 'Owner' : t(`workspace.roles.${user.workspace_role}`)}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {user.email}
                          </p>
                          {user.invited_at && (
                            <p className="text-xs text-muted-foreground">
                              {t('workspace.invitedOn')} {new Date(user.invited_at).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {index < users.length - 1 && <Separator className="mt-3" />}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WorkspaceUsersModal;