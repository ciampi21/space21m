import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/contexts/WorkspaceContextNew';

const AcceptInvite = () => {
  const { token: routeToken } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { refreshWorkspaces } = useWorkspace();

  const token = useMemo(() => routeToken || localStorage.getItem('accept_invite_token') || '', [routeToken]);

  const [status, setStatus] = useState<'idle' | 'checking' | 'invoking' | 'success' | 'error' | 'unauth'>('checking');
  const [message, setMessage] = useState<string>('');
  const [workspace, setWorkspace] = useState<{ id: string; name?: string } | null>(null);
  const [preparing, setPreparing] = useState(false);

  useEffect(() => {
    document.title = 'Accept Invite | 21M Space';
    const meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      const m = document.createElement('meta');
      m.name = 'description';
      m.content = 'Accept your workspace invitation to 21M Space.';
      document.head.appendChild(m);
    } else {
      meta.setAttribute('content', 'Accept your workspace invitation to 21M Space.');
    }
  }, []);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Invalid invitation link.');
      return;
    }

    // Persist token to recover after login
    localStorage.setItem('accept_invite_token', token);

    // Check session with improved validation
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error('Error getting session:', error);
        setStatus('unauth');
        return;
      }
      
      const session = data.session;
      if (!session || !session.user) {
        console.log('No valid session found, redirecting to auth');
        setStatus('unauth');
        return;
      }
      
      // Check if session is close to expiring (less than 5 minutes)
      const expiresAt = session.expires_at;
      const now = Math.floor(Date.now() / 1000);
      if (expiresAt && (expiresAt - now < 300)) {
        console.log('Session is close to expiring, will refresh before accepting');
      }
      
      console.log('Valid session found, proceeding to accept invitation');
      accept();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const loginUrl = useMemo(() => {
    const redirect = encodeURIComponent(`/invite/${token}`);
    return `/auth?redirect=${redirect}`;
  }, [token]);

  const accept = async () => {
    if (!token) return;
    setStatus('invoking');
    setMessage('');

    console.log('Accepting invitation with token:', token);
    
    try {
      // Force session refresh to ensure JWT is valid and up-to-date
      console.log('Refreshing session before accepting invitation...');
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError) {
        console.error('Session refresh error:', refreshError);
        // If refresh fails, try to get current session
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
          console.log('No valid session, redirecting to login');
          setStatus('unauth');
          return;
        }
      } else {
        console.log('Session refreshed successfully');
      }
      
      // Wait a moment to ensure session is fully established
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const { data, error } = await supabase.functions.invoke('accept-invitation', {
        body: { token },
      });

      console.log('Accept invitation response:', { data, error });

      if (error) {
        console.error('Network error accepting invitation:', error);
        setStatus('error');
        setMessage(`Network error: ${error.message || 'Unable to accept invitation.'}`);
        return;
      }

      if (data?.error) {
        console.error('Server error accepting invitation:', data.error);
        
        // Handle specific authentication errors
        if (data.errorCode === 'user_not_found' || data.needsReauth) {
          console.log('Authentication error detected, forcing re-login');
          setStatus('unauth');
          setMessage('Your session is invalid. Please sign in again to accept the invitation.');
          return;
        }
        
        setStatus('error');
        setMessage(`Server error: ${data.error}`);
        return;
      }
      
      // If we reach here, the invitation was accepted successfully
      const w = data?.workspace;
      if (w?.id) {
        setWorkspace(w);
        setStatus('success');
        toast({ title: 'Invitation accepted!', description: `You joined "${w.name || 'workspace'}".` });
        // Clean stored token
        localStorage.removeItem('accept_invite_token');
        
        // Force refresh of workspaces context and then navigate
        console.log('Invitation accepted successfully, refreshing workspaces...');
        setTimeout(async () => {
          try {
            console.log('Refreshing workspace context before navigation...');
            await refreshWorkspaces();
            console.log('Workspace context refreshed, navigating to workspace');
            navigate(`/workspace/${w.id}`);
          } catch (error) {
            console.error('Error refreshing workspaces:', error);
            // Navigate anyway after delay
            setTimeout(() => {
              console.log('Navigating anyway after refresh error');
              navigate(`/workspace/${w.id}`);
            }, 1000);
          }
        }, 2000); // Wait 2 seconds for database propagation
      } else {
        console.warn('Unexpected response format:', data);
        setStatus('error');
        setMessage('Unexpected server response.');
      }
    } catch (unexpectedError) {
      console.error('Unexpected error during invitation acceptance:', unexpectedError);
      setStatus('error');
      setMessage('An unexpected error occurred. Please try again.');
      return;
    }
  };

  const startSetup = async () => {
    if (!token) return;
    try {
      setPreparing(true);
      // Persist invite token so we can auto-accept after account creation
      localStorage.setItem('accept_invite_token', token);
      
      console.log('Preparing invitation setup with token:', token);
      const { data, error } = await supabase.functions.invoke('prepare-invite-setup', { body: { token } });
      
      console.log('prepare-invite-setup response:', { data, error });
      
      if (error) {
        console.error('prepare-invite-setup error:', error);
        setStatus('error');
        setMessage(error?.message || 'Network error occurred.');
        return;
      }
      
      if (data?.error) {
        console.error('prepare-invite-setup data error:', data.error);
        setStatus('error');
        setMessage(data.error);
        return;
      }
      
      if (data?.existing_user) {
        // Check if user has completed setup
        if (data?.setup_complete) {
          // User exists and setup is complete - redirect to login
          console.log('User exists and setup complete, redirecting to login');
          navigate(loginUrl);
        } else if (data?.setup_token) {
          // User exists but needs to complete setup - go to setup page
          console.log('User exists but needs setup, redirecting to setup page');
          navigate(`/auth/setup-account?token=${encodeURIComponent(data.setup_token)}`);
        } else {
          // Fallback to login if no setup token
          console.log('User exists but no setup token, redirecting to login');
          navigate(loginUrl);
        }
      } else if (data?.setup_token) {
        // New user created, go to setup page
        console.log('New user created, redirecting to setup page');
        navigate(`/auth/setup-account?token=${encodeURIComponent(data.setup_token)}`);
      } else {
        setStatus('error');
        setMessage('Unexpected server response.');
      }
    } catch (e: any) {
      console.error('startSetup exception:', e);
      setStatus('error');
      setMessage(e?.message || 'Failed to prepare account setup.');
    } finally {
      setPreparing(false);
    }
  };
  
  if (status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-outer">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Validating invitation...</p>
        </div>
      </div>
    );
  }

  if (status === 'unauth') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-outer p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Accept Invitation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>
                You need to sign in or create an account to accept this invitation.
              </AlertDescription>
            </Alert>
            <Button className="w-full" onClick={startSetup} disabled={preparing}>
              {preparing ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Preparing...</>) : 'Continue'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-outer p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Invitation Error</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
            <div className="flex gap-2">
              <Button variant="outline" className="w-1/2" onClick={() => { window.location.href = 'https://app.21m.space/auth'; }}>
                Go to Login
              </Button>
              <Button 
                className="w-1/2" 
                onClick={async () => {
                  // Force session refresh before retrying
                  try {
                    console.log('Refreshing session before retry...');
                    await supabase.auth.refreshSession();
                    setTimeout(() => accept(), 500);
                  } catch (error) {
                    console.error('Error refreshing session:', error);
                    setStatus('unauth');
                  }
                }}
                disabled={preparing}
              >
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'invoking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-outer">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Accepting invitation...</p>
        </div>
      </div>
    );
  }

  // success handled by navigate; keep a small fallback
  if (status === 'success' && workspace) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-outer p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Invitation Accepted!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Preparing workspace...</span>
            </div>
            <p className="text-sm text-muted-foreground">
              You've been added to "{workspace.name || 'workspace'}". We're syncing your data now.
            </p>
            <Button onClick={() => navigate(`/workspace/${workspace.id}`)}>Go Now</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
};

export default AcceptInvite;
