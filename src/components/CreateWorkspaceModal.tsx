
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { X, Plus } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContextNew';
import { useAuth } from '@/contexts/AuthContext';
import { PLATFORMS, PlatformType } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

interface CreateWorkspaceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CreateWorkspaceModal: React.FC<CreateWorkspaceModalProps> = ({ open, onOpenChange }) => {
  const { createWorkspace } = useWorkspace();
  const { profile } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    platforms: ['Instagram', 'Facebook', 'LinkedIn'] as PlatformType[],
    collaborators: [] as string[]
  });
  
  const [newCollaborator, setNewCollaborator] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePlatformChange = (platform: PlatformType, checked: boolean) => {
    if (checked) {
      setFormData(prev => ({
        ...prev,
        platforms: [...prev.platforms, platform]
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        platforms: prev.platforms.filter(p => p !== platform)
      }));
    }
  };

  const addCollaborator = () => {
    if (!newCollaborator.trim()) return;
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newCollaborator)) {
      toast({
        title: t('common.error'),
        description: 'Please enter a valid email address',
        variant: "destructive"
      });
      return;
    }
    
    // Prevent self-invite
    if (profile?.email && newCollaborator.toLowerCase() === profile.email.toLowerCase()) {
      toast({
        title: t('common.error'),
        description: 'You cannot invite yourself to the workspace',
        variant: "destructive"
      });
      return;
    }
    
    // Check for duplicates
    if (formData.collaborators.some(email => email.toLowerCase() === newCollaborator.toLowerCase())) {
      toast({
        title: t('common.error'),
        description: 'This collaborator has already been added',
        variant: "destructive"
      });
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      collaborators: [...prev.collaborators, newCollaborator]
    }));
    setNewCollaborator('');
  };

  const removeCollaborator = (email: string) => {
    setFormData(prev => ({
      ...prev,
      collaborators: prev.collaborators.filter(c => c !== email)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        title: t('common.error'),
        description: t('workspace.nameRequired'),
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const result = await createWorkspace({
        name: formData.name,
        description: formData.description || undefined,
        platforms: formData.platforms.length > 0 ? formData.platforms : ['Instagram', 'Facebook', 'LinkedIn'],
        collaborators: formData.collaborators.length > 0 ? formData.collaborators : undefined
      });

      const { data, error } = result;

      if (error) {
        console.error('Workspace creation error:', error);
        toast({
          title: "Error",
          description: error?.message || "Failed to create workspace",
          variant: "destructive"
        });
        return;
      }

      let successMessage = "Workspace created successfully!";
      if (formData.collaborators.length > 0) {
        successMessage += ` Invitations sent to ${formData.collaborators.length} collaborator(s).`;
      }

      toast({
        title: "Success",
        description: successMessage
      });

      // Reset form
      setFormData({
        name: '',
        description: '',
        platforms: ['Instagram', 'Facebook', 'LinkedIn'],
        collaborators: []
      });
      
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Unexpected error creating workspace",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('workspace.createWorkspace')}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Workspace Name */}
          <div className="space-y-2">
            <Label htmlFor="name">{t('workspace.name')} *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder={t('workspace.enterWorkspaceName')}
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">{t('workspace.description')}</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder={t('workspace.describeWorkspace')}
              rows={3}
            />
          </div>

          {/* Platforms */}
          <div className="space-y-3">
            <Label>{t('workspace.platforms')}</Label>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(PLATFORMS).map(([key, { label }]) => (
                <div key={key} className="flex items-center space-x-2">
                  <Checkbox
                    id={key}
                    checked={formData.platforms.includes(key as PlatformType)}
                    onCheckedChange={(checked) => 
                      handlePlatformChange(key as PlatformType, checked as boolean)
                    }
                    className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                  <Label htmlFor={key} className="cursor-pointer">
                    {label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Collaborators */}
          <div className="space-y-3">
            <Label>Collaborators</Label>
            <div className="flex space-x-2">
              <Input
                value={newCollaborator}
                onChange={(e) => setNewCollaborator(e.target.value)}
                placeholder="Enter collaborator email"
                type="email"
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCollaborator())}
              />
              <Button
                type="button"
                variant="outline"
                onClick={addCollaborator}
                disabled={!newCollaborator}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            
            {formData.collaborators.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.collaborators.map((email) => (
                  <Badge key={email} variant="secondary" className="flex items-center space-x-1">
                    <span>{email}</span>
                    <button
                      type="button"
                      onClick={() => removeCollaborator(email)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('common.loading') : t('workspace.create')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateWorkspaceModal;
