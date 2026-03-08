import { useState } from 'react';
import { AlertTriangle, Trash2, Shield, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface DeleteAccountModalProps {
  userEmail: string;
  onAccountDeleted: () => void;
}

export function DeleteAccountModal({ userEmail, onAccountDeleted }: DeleteAccountModalProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmDeletion, setConfirmDeletion] = useState(false);
  const [understandConsequences, setUnderstandConsequences] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const canDelete = 
    confirmEmail === userEmail && 
    password.length > 0 && 
    confirmDeletion && 
    understandConsequences;

  const handleDeleteAccount = async () => {
    if (!canDelete) return;

    setIsDeleting(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        throw new Error('No active session');
      }

      const { data, error } = await supabase.functions.invoke('delete-user-account', {
        body: {
          confirmEmail,
          password
        },
        headers: {
          Authorization: `Bearer ${session.session.access_token}`
        }
      });

      if (error) {
        throw error;
      }

      if (!data.success) {
        throw new Error(data.message);
      }

      toast({
        title: t('profile.deleteAccount.successTitle'),
        description: t('profile.deleteAccount.successDescription', { count: data.preservedData?.analyticsEventsCount || 0 }),
      });

      // Close modal
      setIsOpen(false);
      onAccountDeleted();

      // Start countdown and logout after 5 seconds
      setCountdown(5);
      const countdownInterval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            // Logout and redirect to auth page
            signOut().then(() => {
              navigate('/auth');
            });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Show countdown toast
      toast({
        title: 'Logout automático',
        description: `Você será deslogado automaticamente em ${countdown} segundos...`,
        duration: 5000,
      });

    } catch (error: any) {
      console.error('Error deleting account:', error);
      toast({
        title: t('profile.deleteAccount.errorTitle'),
        description: error.message || t('profile.deleteAccount.errorDescription'),
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const resetForm = () => {
    setConfirmEmail('');
    setPassword('');
    setConfirmDeletion(false);
    setUnderstandConsequences(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (!open) resetForm();
    }}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm" className="gap-2">
          <Trash2 className="h-4 w-4" />
          {t('profile.deleteAccount.buttonTrigger')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            {t('profile.deleteAccount.title')}
          </DialogTitle>
          <DialogDescription>
            {t('profile.deleteAccount.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* What gets deleted */}
          <Alert>
            <Trash2 className="h-4 w-4" />
            <AlertDescription>
              <strong>{t('profile.deleteAccount.willBeRemoved')}</strong>
              <ul className="mt-2 text-sm list-disc list-inside space-y-1">
                <li>{t('profile.deleteAccount.removedItems.profile')}</li>
                <li>{t('profile.deleteAccount.removedItems.workspaces')}</li>
                <li>{t('profile.deleteAccount.removedItems.media')}</li>
                <li>{t('profile.deleteAccount.removedItems.settings')}</li>
                <li>{t('profile.deleteAccount.removedItems.billing')}</li>
              </ul>
            </AlertDescription>
          </Alert>

          {/* What gets preserved */}
          <Alert>
            <Database className="h-4 w-4" />
            <AlertDescription>
              <strong>{t('profile.deleteAccount.dataPreserved')}</strong>
              <ul className="mt-2 text-sm list-disc list-inside space-y-1">
                <li>{t('profile.deleteAccount.preservedItems.acquisition')}</li>
                <li>{t('profile.deleteAccount.preservedItems.conversion')}</li>
                <li>{t('profile.deleteAccount.preservedItems.retention')}</li>
                <li>{t('profile.deleteAccount.preservedItems.funnel')}</li>
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                {t('profile.deleteAccount.preservedNote')}
              </p>
            </AlertDescription>
          </Alert>

          {/* Confirmation fields */}
          <div className="space-y-3">
            <div>
              <Label htmlFor="confirm-email">
                {t('profile.deleteAccount.confirmEmail')} <span className="text-muted-foreground">{userEmail}</span>
              </Label>
              <Input
                id="confirm-email"
                type="email"
                placeholder={t('profile.deleteAccount.confirmEmailPlaceholder')}
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="password">{t('profile.deleteAccount.confirmPassword')}</Label>
              <Input
                id="password"
                type="password"
                placeholder={t('profile.deleteAccount.confirmPasswordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="confirm-deletion"
                  checked={confirmDeletion}
                  onCheckedChange={(checked) => setConfirmDeletion(checked as boolean)}
                />
                <Label htmlFor="confirm-deletion" className="text-sm leading-5">
                  {t('profile.deleteAccount.confirmDeletion')}
                </Label>
              </div>

              <div className="flex items-start space-x-2">
                <Checkbox
                  id="understand-consequences"
                  checked={understandConsequences}
                  onCheckedChange={(checked) => setUnderstandConsequences(checked as boolean)}
                />
                <Label htmlFor="understand-consequences" className="text-sm leading-5">
                  {t('profile.deleteAccount.understandConsequences')}
                </Label>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button 
            variant="outline" 
            onClick={() => setIsOpen(false)}
            disabled={isDeleting}
          >
            {t('profile.deleteAccount.cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={handleDeleteAccount}
            disabled={!canDelete || isDeleting}
            className="gap-2"
          >
            {isDeleting ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                {t('profile.deleteAccount.deleting')}
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                {t('profile.deleteAccount.deleteButton')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}