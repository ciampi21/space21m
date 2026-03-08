import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { useTrackingEvents } from '@/hooks/useTrackingEvents';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [signInLoading, setSignInLoading] = useState(false);
  const [signUpLoading, setSignUpLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [referralCode, setReferralCode] = useState('');
  
  const { signIn, signUp } = useAuth();
  const { trackSignupStarted } = useTrackingEvents();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  useEffect(() => {
    // Set language to English by default for the login page
    i18n.changeLanguage('en');

    // Capture referral code from URL
    const params = new URLSearchParams(window.location.search);
    const urlReferralCode = params.get('referralCode');
    if (urlReferralCode) {
      const upperCode = urlReferralCode.toUpperCase();
      setReferralCode(upperCode);
      // Persist to localStorage immediately
      localStorage.setItem('21m_referral_code', upperCode);
      console.log('[Auth] Referral code captured from URL and saved to localStorage:', upperCode);
    }

    // Check for email confirmation tokens
    const handleEmailConfirmation = async () => {
      const tokenHash = params.get('token_hash');
      const type = params.get('type');
      
      if (tokenHash && type === 'signup') {
        try {
          // Verify the email confirmation token
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'signup'
          });
          
          if (error) {
            // Check if it's just a "token already used" error, which means confirmation was successful
            if (error.message?.includes('One-time token not found') || error.message?.includes('token_hash')) {
              toast({
                title: "Email Confirmed!",
                description: "Your email has been confirmed successfully. Welcome to 21M Space!",
                variant: "default"
              });
              // Clear the URL parameters and navigate to dashboard
              window.history.replaceState({}, document.title, '/auth');
              navigate('/dashboard');
              return;
            } else {
              console.error('Email confirmation error:', error);
              toast({
                title: "Confirmation Error",
                description: "There was an issue confirming your email. Please try again or contact support.",
                variant: "destructive"
              });
            }
          } else if (data.user) {
            toast({
              title: "Email Confirmed!",
              description: "Your email has been confirmed successfully. Welcome to 21M Space!",
              variant: "default"
            });
            // Clear the URL parameters and navigate to dashboard
            window.history.replaceState({}, document.title, '/auth');
            navigate('/dashboard');
            return;
          }
        } catch (error) {
          console.error('Confirmation verification error:', error);
          toast({
            title: "Confirmation Error", 
            description: "There was an issue confirming your email. Please try again or contact support.",
            variant: "destructive"
          });
        }
      }
    };

    // If already authenticated, handle redirects immediately
    supabase.auth.getSession().then(async ({ data }) => {
      const session = data.session;
      if (session) {
        const params = new URLSearchParams(window.location.search);
        const redirect = params.get('redirect');
        const inviteToken = localStorage.getItem('accept_invite_token');
        if (redirect) {
          navigate(redirect);
        } else if (inviteToken) {
          try {
            const { data: acceptData, error: acceptError } = await supabase.functions.invoke('accept-invitation', {
              body: { token: inviteToken }
            });
            localStorage.removeItem('accept_invite_token');
            if (!acceptError && !acceptData?.error && acceptData?.workspace?.id) {
              navigate(`/workspace/${acceptData.workspace.id}`);
            } else {
              navigate('/dashboard');
            }
          } catch {
            localStorage.removeItem('accept_invite_token');
            navigate('/dashboard');
          }
        } else {
          navigate('/dashboard');
        }
      } else {
        // If not authenticated, check for email confirmation
        await handleEmailConfirmation();
      }
    });
  }, [i18n, navigate, toast]);

  // Persist referral code to localStorage whenever it changes
  useEffect(() => {
    if (referralCode) {
      localStorage.setItem('21m_referral_code', referralCode);
      console.log('[Auth] Referral code updated in localStorage:', referralCode);
    }
  }, [referralCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (isSignUp) {
      setSignUpLoading(true);
      try {
        if (password !== confirmPassword) {
          setError(t('auth.passwordMismatch', 'Passwords don\'t match'));
          return;
        }
        
        // Track signup started
        trackSignupStarted();
        
        const { error } = await signUp(email, password, { 
          username,
          referralCode: referralCode || undefined
        });
        if (error) {
          setError(error.message);
        } else {
          navigate('/dashboard');
        }
      } catch (err: any) {
        setError(err.message || 'An unexpected error occurred');
      } finally {
        setSignUpLoading(false);
      }
    } else {
      setSignInLoading(true);
      try {
        const { error } = await signIn(email, password);
        if (error) {
          setError(error.message);
        } else {
          const params = new URLSearchParams(window.location.search);
          const redirect = params.get('redirect');
          const inviteToken = localStorage.getItem('accept_invite_token');
          if (redirect) {
            navigate(redirect);
          } else if (inviteToken) {
            try {
              const { data: acceptData, error: acceptError } = await supabase.functions.invoke('accept-invitation', {
                body: { token: inviteToken }
              });
              localStorage.removeItem('accept_invite_token');
              if (!acceptError && !acceptData?.error && acceptData?.workspace?.id) {
                navigate(`/workspace/${acceptData.workspace.id}`);
              } else {
                navigate('/dashboard');
              }
            } catch {
              localStorage.removeItem('accept_invite_token');
              navigate('/dashboard');
            }
          } else {
            navigate('/dashboard');
          }
        }
      } catch (err: any) {
        setError(err.message || 'An unexpected error occurred');
      } finally {
        setSignInLoading(false);
      }
    }
  };


  return (
    <div className="min-h-screen flex">
      {/* Left Column - Video (66%) */}
      <div className="hidden lg:flex lg:w-2/3 relative bg-[hsl(var(--login-background))] items-center justify-center p-8">
        <div className="w-full max-w-4xl aspect-video rounded-xl overflow-hidden shadow-2xl bg-black/20 backdrop-blur-sm border border-white/10">
          <video
            className="w-full h-full object-cover"
            autoPlay
            muted
            loop
            playsInline
          >
            <source src="/21m-space-tutorial.mp4" type="video/mp4" />
          </video>
        </div>
        <div className="absolute inset-0 bg-[hsl(var(--login-video-overlay))] bg-opacity-10 -z-10"></div>
      </div>

      {/* Right Column - Login Form (34%) */}
      <div className="w-full lg:w-1/3 flex items-center justify-center p-6 lg:p-8 bg-background">
        <div className="w-full max-w-sm space-y-8">
          {/* Logo */}
          <div className="text-center">
            <img 
              src="/lovable-uploads/9c757eda-fcd2-4f1d-8a13-a0fcd9dd77b4.png" 
              alt="21M Space Logo" 
              className="h-12 mx-auto mb-6"
            />
          </div>

          <Card className="border-0 shadow-none bg-transparent hover:shadow-none transition-none">
            <CardHeader className="text-center space-y-1 pb-4">
              <CardTitle className="text-2xl font-bold">
                {isSignUp 
                  ? t('auth.createAccount', 'Create Account')
                  : t('auth.welcomeBack', 'Welcome back')
                }
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                {isSignUp 
                  ? t('auth.signUpDescription', 'Create your free account to get started')
                  : t('auth.signInDescription', 'Sign in to your account to continue')
                }
              </CardDescription>
            </CardHeader>

            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4 px-0">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">{t('auth.email', 'Email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={t('auth.emailPlaceholder', 'Enter your email')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-12"
                  />
                </div>

                {isSignUp && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="username">{t('auth.username', 'Username')}</Label>
                      <Input
                        id="username"
                        type="text"
                        placeholder={t('auth.usernamePlaceholder', 'Choose a username')}
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        className="h-12"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="referralCode">
                        {t('auth.referralCode', 'Referral Code')}
                        <span className="text-muted-foreground text-xs ml-1">
                          ({t('auth.optional', 'Optional')})
                        </span>
                      </Label>
                      <Input
                        id="referralCode"
                        type="text"
                        placeholder={t('auth.referralCodePlaceholder', 'Enter referral code')}
                        value={referralCode}
                        onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                        className="h-12"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="password">{t('auth.password', 'Password')}</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder={t('auth.passwordPlaceholder', 'Enter your password')}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="h-12 pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-12 px-3"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {isSignUp && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">{t('auth.confirmPassword', 'Confirm Password')}</Label>
                      <div className="relative">
                        <Input
                          id="confirmPassword"
                          type={showConfirmPassword ? 'text' : 'password'}
                          placeholder={t('auth.confirmPasswordPlaceholder', 'Confirm your password')}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                          className="h-12 pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-12 px-3"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>

              <CardFooter className="flex-col space-y-4 px-0">
                <Button 
                  type="submit" 
                  className="w-full h-12 text-base font-semibold"
                  disabled={signInLoading || signUpLoading}
                >
                  {(signInLoading || signUpLoading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isSignUp ? t('auth.createAccount', 'Create Account') : t('auth.signIn', 'Sign In')}
                </Button>
                
                <div className="text-center">
                  <Button
                    type="button"
                    variant="link"
                    className="text-sm text-muted-foreground h-auto p-0"
                    onClick={() => {
                      setIsSignUp(!isSignUp);
                      setError('');
                      setConfirmPassword('');
                      setUsername('');
                    }}
                  >
                    {isSignUp 
                      ? t('auth.hasAccount', 'Already have an account?')
                      : t('auth.noAccount', 'Don\'t have an account?')
                    }
                  </Button>
                </div>

                {!isSignUp && (
                  <>
                    <div className="relative w-full">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">
                          {t('auth.or', 'Or')}
                        </span>
                      </div>
                    </div>

                    <Button 
                      type="button"
                      variant="outline"
                      className="w-full h-12 text-base font-semibold"
                      onClick={() => {
                        setIsSignUp(true);
                        setError('');
                      }}
                    >
                      {t('auth.startFreeTrial', 'Start Free Trial')}
                    </Button>
                  </>
                )}
              </CardFooter>
            </form>
          </Card>

          {/* Terms and Privacy */}
          <div className="text-center">
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t('auth.termsText', 'By continuing, you agree to our')}{' '}
              <a 
                href="https://21m.space/terms-of-service/" 
                className="underline underline-offset-4"
              >
                {t('auth.termsOfService', 'Terms of Service')}
              </a>{' '}
              {t('auth.and', 'and')}{' '}
              <a 
                href="https://21m.space/privacy-policy/" 
                className="underline underline-offset-4"
              >
                {t('auth.privacyPolicy', 'Privacy Policy')}
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;