import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, Mail, Clock } from "lucide-react";
import { useTranslation } from 'react-i18next';

interface EmailConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
  onResendEmail: () => void;
  isResending?: boolean;
}

export const EmailConfirmationModal: React.FC<EmailConfirmationModalProps> = ({
  isOpen,
  onClose,
  userEmail,
  onResendEmail,
  isResending = false
}) => {
  const { t } = useTranslation();
  const [cooldownTime, setCooldownTime] = useState<number | null>(null);

  // Check cooldown status and update timer
  useEffect(() => {
    const checkCooldown = () => {
      const lastResendTime = localStorage.getItem('lastResendTime');
      if (!lastResendTime) {
        setCooldownTime(null);
        return;
      }

      const cooldownMs = 2 * 60 * 1000; // 2 minutes
      const timeSinceLastResend = Date.now() - parseInt(lastResendTime);
      const remainingTime = cooldownMs - timeSinceLastResend;

      if (remainingTime > 0) {
        setCooldownTime(Math.ceil(remainingTime / 1000));
      } else {
        setCooldownTime(null);
        localStorage.removeItem('lastResendTime');
      }
    };

    // Check immediately and then every second
    checkCooldown();
    const interval = setInterval(checkCooldown, 1000);

    return () => clearInterval(interval);
  }, [isOpen]);

  const canResend = cooldownTime === null && !isResending;
  
  const formatCooldownTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            {t('auth.confirmEmailTitle', 'Confirm Your Email')}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-blue-800 mb-1">
                {t('auth.emailNotConfirmed', 'Email not confirmed')}
              </p>
              <p className="text-blue-700">
                {t('auth.emailConfirmationMessage', 'We sent a confirmation email to')} <strong>{userEmail}</strong>. 
                {t('auth.checkInboxMessage', ' Please check your inbox and click the confirmation link to continue.')}
              </p>
            </div>
          </div>

          <div className="text-sm text-muted-foreground space-y-2">
            <p>{t('auth.emailConfirmationSteps', 'Next steps:')}</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>{t('auth.step1', 'Check your email inbox')}</li>
              <li>{t('auth.step2', 'Click the confirmation link')}</li>
              <li>{t('auth.step3', 'Return here to start using the platform')}</li>
            </ol>
          </div>

          <div className="flex flex-col gap-2">
            <Button 
              onClick={onResendEmail}
              disabled={!canResend}
              className="w-full"
            >
              {isResending ? (
                <>
                  <Mail className="mr-2 h-4 w-4 animate-spin" />
                  {t('common.sending', 'Sending...')}
                </>
              ) : cooldownTime ? (
                <>
                  <Clock className="mr-2 h-4 w-4" />
                  {t('auth.waitToResend', `Wait ${formatCooldownTime(cooldownTime)} to resend`)}
                </>
              ) : (
                t('auth.resendEmail', 'Resend Email')
              )}
            </Button>
            
            <Button 
              variant="outline" 
              onClick={onClose}
              className="w-full"
            >
              {t('common.close', 'Close')}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            {t('auth.emailValidity', 'The confirmation link is valid for 72 hours.')}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};