import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Trash, UserPlus, Users, Settings as SettingsIcon, HardDrive, Instagram } from 'lucide-react';
import { InstagramConnectButton } from '@/components/InstagramConnectButton';
import { InstagramAccountsList } from '@/components/InstagramAccountsList';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/contexts/WorkspaceContextNew';
import { useTranslation } from 'react-i18next';

interface WorkspaceSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace: {
    id: string;
    name: string;
    description?: string;
    metrics_visibility?: 'owner_only' | 'all' | 'disabled';
    autodelete_days?: number | null;
    owner_id?: string;
  };
}

interface WorkspaceMember {
  id: string;
  user_id: string;
  workspace_role: string;
  profiles: {
    email: string;
    username?: string;
  };
}

const WorkspaceSettingsModal = ({ open, onOpenChange, workspace }: WorkspaceSettingsModalProps) => {
  const { toast } = useToast();
  const { refreshWorkspaces, deleteWorkspace: deleteWorkspaceFromContext } = useWorkspace();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(workspace.name);
  const [description, setDescription] = useState(workspace.description || '');
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [removeConfirm, setRemoveConfirm] = useState('');
  const [memberToRemove, setMemberToRemove] = useState<string | null>(null);
  const [storageUsage, setStorageUsage] = useState<{ totalSize: number; fileCount: number } | null>(null);
  const [loadingStorage, setLoadingStorage] = useState(false);
  const [metricsVisibility, setMetricsVisibility] = useState<'owner_only' | 'all' | 'disabled'>('owner_only');
  const [autodeleteeDays, setAutodeleteeDays] = useState<number | null>(90);
  const [ownerPlanTier, setOwnerPlanTier] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      console.log('Opening workspace settings modal with autodelete_days:', workspace.autodelete_days);
      setName(workspace.name);
      setDescription(workspace.description || '');
      setMetricsVisibility(workspace.metrics_visibility || 'owner_only');
      // Properly handle null values - if null, keep it null (disabled)
      // If undefined, set to default 90 days
      const autodeleteValue = workspace.autodelete_days === null ? null : (workspace.autodelete_days ?? 90);
      console.log('Setting autodelete_days to:', autodeleteValue);
      setAutodeleteeDays(autodeleteValue);
      setDeleteConfirm('');
      setRemoveConfirm('');
      setMemberToRemove(null);
      loadMembers();
      loadStorageUsage();
      loadOwnerPlanTier();
    }
  }, [open, workspace]);

  const loadMembers = async () => {
    try {
      // Get workspace members
      const { data: membersData, error: membersError } = await supabase
        .from('workspace_members')
        .select('id, user_id, workspace_role')
        .eq('workspace_id', workspace.id);

      if (membersError) throw membersError;

      // Get profiles for each member
      const memberProfiles = await Promise.all(
        (membersData || []).map(async (member) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('email, username')
            .eq('user_id', member.user_id)
            .single();

          return {
            ...member,
            profiles: {
              email: profile?.email || '',
              username: profile?.username,
            },
          };
        })
      );

      // Get pending invitations (not yet accepted)
      const { data: invitationsData, error: invitationsError } = await supabase
        .from('invitations')
        .select('token, email, created_at, accepted_at, expires_at')
        .eq('workspace_id', workspace.id)
        .is('accepted_at', null);

      if (invitationsError) {
        console.warn('Could not load invitations:', invitationsError);
      }

      const invitedMembers: WorkspaceMember[] = (invitationsData || []).map((inv) => ({
        id: `invitation-${inv.token}`,
        user_id: '',
        workspace_role: 'invited',
        profiles: {
          email: inv.email,
          username: undefined,
        },
      }));

      setMembers([...memberProfiles, ...invitedMembers]);
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('workspace.loadMembersFailed'),
        variant: 'destructive',
      });
    }
  };

  const loadStorageUsage = async () => {
    setLoadingStorage(true);
    try {
      // Get storage usage from R2 media_assets, only non-deleted files
      console.log('Loading storage usage for workspace:', workspace.id);
      const { data: assets, error } = await supabase
        .from('media_assets')
        .select('size_bytes, r2_key')
        .eq('workspace_id', workspace.id)
        .is('deleted_at', null) // Only count non-deleted files
        .not('size_bytes', 'is', null); // Only count files with valid size

      if (error) {
        console.error('Error loading R2 storage usage:', error);
        setStorageUsage({ totalSize: 0, fileCount: 0 });
        return;
      }

      if (!assets || assets.length === 0) {
        setStorageUsage({ totalSize: 0, fileCount: 0 });
        return;
      }

      // Calculate total size from R2 assets using size_bytes (the correct field)
      const totalSize = assets.reduce((total, asset) => {
        return total + (asset.size_bytes || 0);
      }, 0);

      console.log(`Storage calculation for workspace ${workspace.id}:`, {
        fileCount: assets.length,
        totalSize,
        totalSizeFormatted: formatBytes(totalSize)
      });

      setStorageUsage({
        totalSize,
        fileCount: assets.length
      });
    } catch (error) {
      console.error('Failed to load R2 storage usage:', error);
      setStorageUsage({ totalSize: 0, fileCount: 0 });
    } finally {
      setLoadingStorage(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const loadOwnerPlanTier = async () => {
    try {
      const { data: ownerProfile, error } = await supabase
        .from('profiles')
        .select('plan_tier')
        .eq('user_id', workspace.owner_id)
        .single();

      if (error) {
        console.error('Error loading owner plan tier:', error);
        return;
      }

      setOwnerPlanTier(ownerProfile?.plan_tier || 'free');
    } catch (error) {
      console.error('Failed to load owner plan tier:', error);
      setOwnerPlanTier('free');
    }
  };

  const getRetentionOptions = () => {
    const freeOptions = [
      { value: 30, label: t('workspace.retentionDays', { days: 30 }) },
      { value: 60, label: t('workspace.retentionDays', { days: 60 }) },
      { value: 90, label: t('workspace.retentionDays', { days: 90 }) },
    ];

    const allOptions = [
      { value: 30, label: t('workspace.retentionDays', { days: 30 }) },
      { value: 60, label: t('workspace.retentionDays', { days: 60 }) },
      { value: 90, label: t('workspace.retentionDays', { days: 90 }) },
      { value: 120, label: t('workspace.retentionDays', { days: 120 }) },
      { value: 150, label: t('workspace.retentionDays', { days: 150 }) },
      { value: 180, label: t('workspace.retentionDays', { days: 180 }) },
      { value: 360, label: t('workspace.retentionDays', { days: 360 }) },
      { value: null, label: t('workspace.retentionDisabled') },
    ];

    return ownerPlanTier === 'free' ? freeOptions : allOptions;
  };

  const updateWorkspace = async () => {
    if (!name.trim()) {
      toast({
        title: t('common.error'),
        description: t('workspace.nameRequired'),
        variant: 'destructive',
      });
      return;
    }

    console.log('Updating workspace with autodelete_days:', autodeleteeDays);
    const previousAutodeleteeDays = workspace.autodelete_days;
    setLoading(true);
    try {
      const updateData = {
        name: name.trim(),
        description: description.trim() || null,
        metrics_visibility: metricsVisibility,
        autodelete_days: autodeleteeDays,
      };
      
      console.log('Update data being sent:', updateData);
      
      const { error } = await supabase
        .from('workspaces')
        .update(updateData)
        .eq('id', workspace.id);

      if (error) {
        console.error('Database update error:', error);
        throw error;
      }

      // Sync expire_at for existing posts when Auto Cleanup setting changes
      const wasDisabled = previousAutodeleteeDays === null;
      const isNowDisabled = autodeleteeDays === null;
      const valueChanged = previousAutodeleteeDays !== autodeleteeDays;
      
      if (!wasDisabled && isNowDisabled) {
        // User DISABLED Auto Cleanup - clear expire_at from all posts
        console.log('Auto Cleanup disabled - clearing expire_at from all posts');
        const { error: clearError } = await supabase
          .from('posts')
          .update({ expire_at: null })
          .eq('workspace_id', workspace.id);
        
        if (clearError) {
          console.error('Error clearing expire_at:', clearError);
        } else {
          console.log('Successfully cleared expire_at from all posts');
        }
      } else if (wasDisabled && !isNowDisabled) {
        // User ENABLED Auto Cleanup - trigger recalculation by touching posts
        console.log('Auto Cleanup enabled - triggering expire_at recalculation');
        const { error: touchError } = await supabase
          .from('posts')
          .update({ updated_at: new Date().toISOString() })
          .eq('workspace_id', workspace.id);
        
        if (touchError) {
          console.error('Error touching posts for recalculation:', touchError);
        } else {
          console.log('Successfully triggered expire_at recalculation');
        }
      } else if (!wasDisabled && !isNowDisabled && valueChanged) {
        // User CHANGED Auto Cleanup value (e.g., 30 days → 360 days) - trigger recalculation
        console.log(`Auto Cleanup changed from ${previousAutodeleteeDays} to ${autodeleteeDays} days - triggering expire_at recalculation`);
        const { error: touchError } = await supabase
          .from('posts')
          .update({ updated_at: new Date().toISOString() })
          .eq('workspace_id', workspace.id);
        
        if (touchError) {
          console.error('Error touching posts for recalculation:', touchError);
        } else {
          console.log('Successfully triggered expire_at recalculation');
        }
      }

      console.log('Workspace updated successfully');
      
      toast({
        title: 'Sucesso',
        description: 'Workspace atualizado com sucesso',
      });
      
      await refreshWorkspaces();
      onOpenChange(false);
    } catch (error) {
      console.error('Update workspace error:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao atualizar workspace',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const addMember = async () => {
    if (!newMemberEmail.trim()) return;

    setLoading(true);
    try {
      // Get current session to extract token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Sessão não encontrada. Faça login novamente.');
      }

      // Get current user profile ID
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', session.user.id)
        .single();

      if (!currentProfile) {
        throw new Error(t('workspace.profileNotFound'));
      }

      // Call the send-invitation edge function with explicit auth token
      const requestBody = {
        email: newMemberEmail.trim(),
        workspace_id: workspace.id,
        workspace_name: workspace.name,
        invited_by_id: currentProfile.id
      };
      
      console.log('Sending invitation request:', requestBody);
      
      const { data, error } = await supabase.functions.invoke('send-invitation', {
        body: requestBody,
      });

      if (error) throw error;

      toast({
        title: t('common.success'),
        description: data.message || t('workspace.inviteSent'),
      });
      
      setNewMemberEmail('');
      loadMembers();
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message || t('workspace.inviteFailed'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const removeMember = async (memberId: string) => {
    if (removeConfirm !== 'remove') {
      toast({
        title: t('common.error'),
        description: t('workspace.confirmRemove'),
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const target = members.find(m => m.id === memberId);
      const targetEmail = target?.profiles?.email;

      if (memberId.startsWith('invitation-')) {
        // Revoke a pending invitation by deleting it from invitations
        const token = memberId.replace('invitation-', '');
        const { error } = await supabase
          .from('invitations')
          .delete()
          .eq('token', token)
          .eq('workspace_id', workspace.id);
        if (error) throw error;
      } else {
        // Remove an existing workspace member
        const { error } = await supabase
          .from('workspace_members')
          .delete()
          .eq('id', memberId);
        if (error) throw error;
      }

      // Attempt to cleanup pending accounts with no memberships
      if (targetEmail) {
        try {
          await supabase.functions.invoke('cleanup-pending-account', {
            body: { email: targetEmail },
          });
        } catch (cleanupErr) {
          console.warn('Cleanup function warning:', cleanupErr);
        }
      }

      toast({
        title: t('common.success'),
        description: t('workspace.memberRemoved'),
      });
      setMemberToRemove(null);
      setRemoveConfirm('');
      loadMembers();
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error?.message || t('workspace.removeMemberFailed'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteWorkspace = async () => {
    if (deleteConfirm !== 'delete workspace') {
      toast({
        title: t('common.error'),
        description: t('workspace.confirmDelete'),
        variant: 'destructive',
      });
      return;
    }

    console.log('🔥 UI DEBUG: Starting workspace deletion from settings modal');
    console.log('🔥 UI DEBUG: Workspace to delete:', {
      id: workspace.id,
      name: workspace.name,
      owner_id: workspace.owner_id
    });

    setLoading(true);
    
    // Show initial progress toast
    toast({
      title: t('workspace.deletingWorkspace'),
      description: t('workspace.deletingWorkspaceDescription'),
    });

    try {
      console.log('🔥 UI DEBUG: Calling deleteWorkspaceFromContext function...');
      
      // Use the context function instead of direct SQL deletion
      const result = await deleteWorkspaceFromContext(workspace.id);
      
      console.log('🔥 UI DEBUG: DeleteWorkspace function returned:', result);

      if (result.error) {
        console.error('🔥 UI ERROR: Error returned from deleteWorkspace:', result.error);
        throw result.error;
      }

      console.log('🔥 UI SUCCESS: Workspace deletion completed successfully');
      
      toast({
        title: t('common.success'),
        description: t('workspace.workspaceDeleted'),
      });
      
      onOpenChange(false);
    } catch (error: any) {
      console.error('🔥 UI FATAL ERROR: Exception in deleteWorkspace:', error);
      console.error('🔥 UI FATAL ERROR: Error details:', JSON.stringify(error, null, 2));
      
      toast({
        title: t('common.error'),
        description: error?.message || t('workspace.workspaceDeleteFailed'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" />
            {t('workspace.workspaceSettings')}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="general">{t('workspace.generalTab')}</TabsTrigger>
            <TabsTrigger value="members">{t('workspace.membersTab')}</TabsTrigger>
            <TabsTrigger value="integrations">{t('workspace.integrationsTab')}</TabsTrigger>
            <TabsTrigger value="danger">{t('workspace.dangerZoneTab')}</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="workspace-name">{t('workspace.name')}</Label>
                <Input
                  id="workspace-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('workspace.enterWorkspaceName')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="metrics-visibility">{t('workspace.metricsVisibility')}</Label>
                <Select value={metricsVisibility} onValueChange={(value: 'owner_only' | 'all' | 'disabled') => setMetricsVisibility(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('workspace.selectVisibility')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('workspace.visibilityAll')}</SelectItem>
                    <SelectItem value="owner_only">{t('workspace.visibilityOwnerOnly')}</SelectItem>
                    <SelectItem value="disabled">{t('workspace.visibilityDisabled')}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {metricsVisibility === 'owner_only' && t('workspace.visibilityOwnerOnlyHelp')}
                  {metricsVisibility === 'all' && t('workspace.visibilityAllHelp')}
                  {metricsVisibility === 'disabled' && t('workspace.visibilityDisabledHelp')}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="workspace-description">{t('workspace.description')}</Label>
                <Textarea
                  id="workspace-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('workspace.describeWorkspace')}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="post-retention">{t('workspace.autoCleanup')}</Label>
                <Select 
                  value={autodeleteeDays === null ? 'null' : autodeleteeDays?.toString() || '90'} 
                  onValueChange={(value) => {
                    console.log('Select value changed to:', value);
                    const newValue = value === 'null' ? null : parseInt(value, 10);
                    console.log('Setting autodeleteeDays to:', newValue);
                    setAutodeleteeDays(newValue);
                  }}
                  disabled={ownerPlanTier === 'free'}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('workspace.selectPeriod')} />
                  </SelectTrigger>
                  <SelectContent>
                    {getRetentionOptions().map((option) => (
                      <SelectItem key={option.value?.toString() || 'null'} value={option.value?.toString() || 'null'}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {ownerPlanTier === 'free' ? (
                    <>{t('workspace.retentionHelpFree', { days: autodeleteeDays })}</>
                  ) : (
                    <>{autodeleteeDays ? t('workspace.retentionHelpEnabled', { days: autodeleteeDays }) : t('workspace.retentionHelpDisabled')}</>
                  )}
                </p>
              </div>
            </div>

            <Button onClick={updateWorkspace} disabled={loading} className="w-full">
              {t('workspace.saveChanges')}
            </Button>
          </TabsContent>

          <TabsContent value="members" className="space-y-4 mt-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="member-email">{t('workspace.inviteMember')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('workspace.inviteMemberDescription')}
                </p>
                <div className="flex gap-2">
                  <Input
                    id="member-email"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    placeholder={t('workspace.newMemberEmail')}
                    className="flex-1"
                    type="email"
                  />
                  <Button onClick={addMember} disabled={loading} size="sm">
                    <UserPlus className="h-4 w-4 mr-2" />
                    {t('workspace.invite')}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {t('workspace.membersCount')} ({members.length})
                </h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="text-sm font-medium">
                            {member.profiles.username || member.profiles.email}
                          </p>
                          {member.profiles.username && (
                            <p className="text-xs text-muted-foreground">{member.profiles.email}</p>
                          )}
                        </div>
                        <Badge variant={
                          member.workspace_role === 'owner' ? 'default' : (member.workspace_role === 'invited' ? 'secondary' : 'default')
                        }>
                          {member.workspace_role === 'owner' ? 'owner' : (member.workspace_role === 'invited' ? t('workspace.invited', 'invited') : t('workspace.accepted', 'accepted'))}
                        </Badge>
                      </div>
                      
                      {member.workspace_role !== 'owner' && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setMemberToRemove(member.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {memberToRemove && (
                <div className="border border-destructive rounded-lg p-4 space-y-3">
                  <p className="text-sm font-medium text-destructive">
                    {t('workspace.confirmMemberRemoval')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t('workspace.removeMemberConfirmation')}
                  </p>
                  <div className="flex gap-2">
                    <Input
                      value={removeConfirm}
                      onChange={(e) => setRemoveConfirm(e.target.value)}
                      placeholder={t('workspace.typeRemove')}
                    />
                    <Button
                      variant="destructive"
                      onClick={() => removeMember(memberToRemove)}
                      disabled={loading || removeConfirm !== 'remove'}
                    >
                      {t('workspace.remove')}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setMemberToRemove(null);
                        setRemoveConfirm('');
                      }}
                    >
                      {t('common.cancel')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="danger" className="space-y-4 mt-6">
            {/* Storage Usage Section */}
            <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 space-y-4">
              <div className="flex items-center gap-2 text-blue-700">
                <HardDrive className="h-5 w-5" />
                <h4 className="font-medium">{t('workspace.storageUsage')}</h4>
              </div>
              
              <div className="space-y-2">
                {loadingStorage ? (
                  <p className="text-sm text-muted-foreground">{t('workspace.loadingStorageUsage')}</p>
                ) : storageUsage ? (
                  <div className="space-y-1">
                    <p className="text-sm">
                      <span className="font-medium">{t('workspace.totalUsed')}</span> {formatBytes(storageUsage.totalSize)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {storageUsage.fileCount} {t('workspace.mediaFiles')}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{t('workspace.storageError')}</p>
                )}
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadStorageUsage}
                  disabled={loadingStorage}
                >
                  {t('workspace.refresh')}
                </Button>
              </div>
            </div>

            {/* Delete Workspace Section */}
            <div className="border border-destructive rounded-lg p-4 space-y-4">
              <div className="flex items-center gap-2 text-destructive">
                <Trash className="h-5 w-5" />
                <h4 className="font-medium">{t('workspace.deleteWorkspace')}</h4>
              </div>
              
              <p className="text-sm text-muted-foreground">
                {t('workspace.deleteWorkspaceDescription')}
              </p>
              
              <div className="space-y-3">
                <Label htmlFor="delete-confirm">
                  {t('workspace.deleteWorkspaceConfirmation')}
                </Label>
                <Input
                  id="delete-confirm"
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder={t('workspace.deleteWorkspacePlaceholder')}
                />
                <Button
                  variant="destructive"
                  onClick={deleteWorkspace}
                  disabled={loading || deleteConfirm !== 'delete workspace'}
                  className="w-full"
                >
                  <Trash className="h-4 w-4 mr-2" />
                  {t('workspace.deleteWorkspacePermanently')}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="integrations" className="space-y-4 mt-6">
            <div className="space-y-6">
              {/* Instagram Section */}
              <div className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center gap-2 justify-between">
                  <div className="flex items-center gap-2">
                    <Instagram className="h-5 w-5" />
                    <h4 className="font-medium">{t('workspace.instagram')}</h4>
                  </div>
                  <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800 border-yellow-300">
                    {t('workspace.instagramWIPBadge')}
                  </Badge>
                </div>
                
                <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                  <p className="text-xs text-amber-800">
                    ⚠️ <strong>{t('workspace.instagramWIPTitle')}</strong> {t('workspace.instagramWIPBody')} <strong>{t('workspace.instagramWIPAction')}</strong>
                  </p>
                </div>
                
                <p className="text-sm text-muted-foreground">
                  {t('workspace.instagramDescription')}
                </p>
                
                <InstagramConnectButton 
                  workspaceId={workspace.id}
                  onSuccess={loadMembers}
                />
                
                <InstagramAccountsList workspaceId={workspace.id} />
              </div>
              
              {/* Future integrations placeholder */}
              <div className="border border-dashed rounded-lg p-4 text-center text-muted-foreground">
                <p className="text-sm">{t('workspace.moreIntegrationsSoon')}</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default WorkspaceSettingsModal;