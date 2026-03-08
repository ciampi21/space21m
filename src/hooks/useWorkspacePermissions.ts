import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContextNew';

export const useWorkspacePermissions = () => {
  const { profile } = useAuth();
  const { currentWorkspace } = useWorkspace();

  const isWorkspaceOwner = () => {
    if (!profile?.user_id || !currentWorkspace) return false;
    return currentWorkspace.owner_id === profile.user_id;
  };

  const canCreateDrafts = () => {
    return isWorkspaceOwner();
  };

  const canViewDrafts = () => {
    return isWorkspaceOwner();
  };

  const canManagePosts = () => {
    return profile?.role === 'user' || profile?.role === 'admin';
  };

  return {
    isWorkspaceOwner,
    canCreateDrafts,
    canViewDrafts,
    canManagePosts
  };
};