import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sparkles, Clock, ExternalLink } from 'lucide-react';

export const EarlyAdopterIndicator = () => {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);

  if (!profile) return null;

  // Calculate remaining trial days
  const trialEndsAt = profile.trial_ends_at ? new Date(profile.trial_ends_at) : null;
  const now = new Date();
  const daysRemaining = trialEndsAt 
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : null;

  // Only show if trial is active
  const isTrialActive = profile.subscription_status === 'trialing' && daysRemaining !== null && daysRemaining > 0;

  if (!isTrialActive) return null;

  // Badge color based on days remaining
  const badgeVariant = daysRemaining <= 3 ? 'destructive' : daysRemaining <= 7 ? 'default' : 'secondary';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="gap-2 hover:bg-blue-50 dark:hover:bg-blue-950"
        >
          <Sparkles className="h-4 w-4 text-blue-600" />
          <Badge variant={badgeVariant} className="gap-1">
            <Clock className="h-3 w-3" />
            {daysRemaining}d trial
          </Badge>
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-blue-100 p-2 dark:bg-blue-900">
              <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-sm">
                {daysRemaining === 1 
                  ? 'Last day of trial!' 
                  : `${daysRemaining} days of PRO trial remaining`}
              </h4>
              <p className="text-xs text-muted-foreground mt-1">
                Trial expires on {trialEndsAt?.toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Early Adopter Offer */}
          <div className="rounded-lg bg-gradient-to-br from-blue-50 to-sky-50 dark:from-blue-950 dark:to-sky-950 p-4 space-y-3">
            <div>
              <h5 className="font-semibold text-sm mb-1">
                Exclusive Early Adopter Offer
              </h5>
              <p className="text-xs text-muted-foreground">
                Limited to first 100 users
              </p>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Storage</span>
                <span className="font-semibold">10 GB (5x)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Workspaces</span>
                <span className="font-semibold">30 (6x)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground line-through">US$ 23.98/mo</span>
                <span className="font-bold text-blue-600 dark:text-blue-400 text-base">
                  US$ 11.99/mo
                </span>
              </div>
            </div>

            <Button 
              size="sm" 
              className="w-full bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-700 hover:to-sky-700"
              onClick={() => {
                window.open('https://21m.space/early-adopters/', '_blank');
                setOpen(false);
              }}
            >
              View Early Adopter Offer
              <ExternalLink className="h-3 w-3 ml-2" />
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              50% off forever while subscription is active
            </p>
          </div>

          {/* Trial Benefits */}
          <div className="space-y-2 pt-2 border-t">
            <p className="text-xs font-medium text-muted-foreground">
              Current PRO trial includes:
            </p>
            <ul className="text-xs space-y-1 text-muted-foreground">
              <li>5 workspaces</li>
              <li>2 GB storage</li>
              <li>No post expiration</li>
              <li>Priority support</li>
            </ul>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
