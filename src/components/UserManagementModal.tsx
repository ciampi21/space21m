import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Search, UserCheck, UserX, Shield, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { AcquisitionAnalytics } from '@/components/AcquisitionAnalytics';
import { formatDate } from '@/lib/dateUtils';

interface UserManagementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface UserProfile {
  id: string;
  user_id: string;
  email: string;
  username: string | null;
  role: string;
  plan_tier: string;
  is_early_adopter: boolean;
  subscription_active: boolean;
  created_at: string;
  last_sign_in_at: string | null;
  storage_used_mb: number;
  max_owned_workspaces: number;
  storage_total_mb: number;
  max_guest_memberships: number;
  workspace_count: number;
  guest_membership_count: number;
}

export function UserManagementModal({ open, onOpenChange }: UserManagementModalProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [error, setError] = useState('');
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const { profile } = useAuth();

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    if (open && isAdmin) {
      fetchUsers();
    }
  }, [open, isAdmin]);

  useEffect(() => {
    let filtered = users;

    if (searchTerm) {
      filtered = filtered.filter(user => 
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.username?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (roleFilter !== 'all') {
      filtered = filtered.filter(user => user.role === roleFilter);
    }

    setFilteredUsers(filtered);
  }, [users, searchTerm, roleFilter]);

  const fetchUsers = async () => {
    setIsLoading(true);
    setError('');

    try {
      // Chamar a Edge Function que usa service_role para bypass RLS
      const { data, error } = await supabase.functions.invoke('get-users-admin', {
        method: 'GET',
      });

      if (error) {
        console.error('Edge function error:', error);
        setError(error.message);
        return;
      }

      if (data?.error) {
        console.error('Edge function returned error:', data.error);
        setError(data.error);
        return;
      }

      console.log('Users fetched successfully:', data.users?.length || 0);
      setUsers(data.users || []);
    } catch (error: any) {
      console.error('Fetch users error:', error);
      setError(error.message || t('common.errorGeneric', 'An error occurred'));
    } finally {
      setIsLoading(false);
    }
  };

  const updateUserRole = async (userId: string, newRole: string, userEmail: string) => {
    try {
      // Use edge function to update role with proper logging
      const { data, error } = await supabase.functions.invoke('manage-user-role', {
        body: { 
          user_id: userId, 
          new_role: newRole,
          reason: `Role changed by admin ${profile?.email}` 
        }
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || 'Failed to update role');
      }

      await fetchUsers();
      
      toast({
        title: t('admin.roleUpdated', 'Role updated'),
        description: t('admin.roleUpdatedDescription', 'User role has been successfully updated'),
      });
    } catch (error: any) {
      toast({
        title: t('common.error', 'Error'),
        description: error.message || t('common.errorGeneric', 'An error occurred'),
        variant: 'destructive'
      });
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Shield className="h-4 w-4" />;
      case 'user': return <UserCheck className="h-4 w-4" />;
      case 'guest': return <User className="h-4 w-4" />;
      default: return <UserX className="h-4 w-4" />;
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'user': return 'default';
      case 'guest': return 'secondary';
      default: return 'outline';
    }
  };

  const getPlanBadgeVariant = (tier: string) => {
    switch (tier) {
      case 'pro': return 'default';
      case 'premium': return 'secondary';
      case 'free': return 'outline';
      default: return 'outline';
    }
  };

  const formatStorageDisplay = (usedMB: number, totalMB: number) => {
    if (!totalMB || totalMB === 0) return '0MB/0MB';
    const totalGB = (totalMB / 1024).toFixed(2);
    return `${usedMB}MB/${totalGB}GB`;
  };

  const formatLastLogin = (lastSignIn: string | null) => {
    if (!lastSignIn) return 'Never';
    
    const date = new Date(lastSignIn);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    return formatDate(date, profile?.date_format || 'DD/MM/YYYY', i18n.language);
  };

  const UserLimitsCell = ({ user }: { user: UserProfile }) => {
    // Validação para prevenir divisão por zero e NaN
    const workspaceUsage = user.max_owned_workspaces > 0 
      ? (user.workspace_count / user.max_owned_workspaces) * 100 
      : 0;
    
    const storageUsage = user.storage_total_mb > 0 
      ? (user.storage_used_mb / user.storage_total_mb) * 100 
      : 0;
    
    const isWorkspaceHigh = workspaceUsage > 90;
    const isStorageHigh = storageUsage > 90;
    
    return (
      <div className="space-y-2 min-w-[160px]">
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span>Workspaces</span>
            <span className={isWorkspaceHigh ? 'text-destructive' : 'text-muted-foreground'}>
              {user.workspace_count}/{user.max_owned_workspaces}
            </span>
          </div>
          <Progress 
            value={Math.min(workspaceUsage, 100)} 
            className="h-1.5"
          />
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span>Storage</span>
            <span className={isStorageHigh ? 'text-destructive' : 'text-muted-foreground'}>
              {formatStorageDisplay(user.storage_used_mb, user.storage_total_mb)}
            </span>
          </div>
          <Progress 
            value={Math.min(storageUsage, 100)} 
            className="h-1.5"
          />
        </div>
      </div>
    );
  };

  if (!isAdmin) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('common.accessDenied', 'Access Denied')}</DialogTitle>
            <DialogDescription>
              {t('admin.adminRequired', 'Administrator privileges required to access this feature')}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('admin.userManagement', 'User Management')}</DialogTitle>
          <DialogDescription>
            {t('admin.userManagementDescription', 'Manage user accounts, permissions and view acquisition analytics')}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="user-management" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="user-management">{t('admin.userManagement', 'User Management')}</TabsTrigger>
            <TabsTrigger value="acquisition-analytics">Acquisition Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="user-management" className="space-y-4 mt-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('admin.filters', 'Filters')}</CardTitle>
                <CardDescription>
                  {t('admin.filtersDescription', 'Filter and search users')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 items-end">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="search">{t('admin.search', 'Search')}</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="search"
                        placeholder={t('admin.searchPlaceholder', 'Search by email or username')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="roleFilter">{t('admin.roleFilter', 'Role')}</Label>
                    <Select value={roleFilter} onValueChange={setRoleFilter}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('admin.allRoles', 'All')}</SelectItem>
                        <SelectItem value="admin">{t('admin.admin', 'Admin')}</SelectItem>
                        <SelectItem value="user">{t('admin.user', 'User')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button 
                    onClick={fetchUsers} 
                    disabled={isLoading}
                    variant="outline"
                  >
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t('common.refresh', 'Refresh')}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {t('admin.users', 'Users')} ({filteredUsers.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('admin.email', 'Email')}</TableHead>
                          <TableHead>{t('admin.username', 'Username')}</TableHead>
                          <TableHead>{t('admin.role', 'Role')}</TableHead>
                          <TableHead>{t('admin.plan', 'Plan')}</TableHead>
                          <TableHead>{t('admin.subscription', 'Subscription')}</TableHead>
                          <TableHead>Limites</TableHead>
                          <TableHead>{t('admin.actions', 'Actions')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers.map((user) => (
                          <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              {user.email}
                              {user.is_early_adopter && (
                                <Badge variant="outline" className="text-xs">
                                  {t('billing.earlyAdopter', 'Early Adopter')}
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Last login: {formatLastLogin(user.last_sign_in_at)}
                            </div>
                          </div>
                        </TableCell>
                            <TableCell>{user.username || '-'}</TableCell>
                            <TableCell>
                              <Badge 
                                variant={getRoleBadgeVariant(user.role)}
                                className="flex items-center gap-1 w-fit"
                              >
                                {getRoleIcon(user.role)}
                                {user.role}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={getPlanBadgeVariant(user.plan_tier)}>
                                {user.plan_tier}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={user.subscription_active ? 'default' : 'secondary'}>
                                {user.subscription_active ? 
                                  t('admin.active', 'Active') : 
                                  t('admin.inactive', 'Inactive')
                                }
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <UserLimitsCell user={user} />
                            </TableCell>
                            <TableCell>
                              <Select
                                value={user.role}
                                onValueChange={(newRole) => updateUserRole(user.user_id, newRole, user.email)}
                              >
                                <SelectTrigger className="w-24">
                                  <SelectValue />
                                </SelectTrigger>
                                 <SelectContent>
                                   <SelectItem value="user">{t('admin.user', 'User')}</SelectItem>
                                   <SelectItem value="admin">{t('admin.admin', 'Admin')}</SelectItem>
                                 </SelectContent>
                              </Select>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    
                    {filteredUsers.length === 0 && !isLoading && (
                      <div className="text-center py-8 text-muted-foreground">
                        {t('admin.noUsers', 'No users found')}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="acquisition-analytics" className="mt-6">
            <AcquisitionAnalytics />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}