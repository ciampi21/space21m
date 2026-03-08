import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTrackingEvents } from '@/hooks/useTrackingEvents';
import { Button } from '@/components/ui/button';
import { CheckCircle, Mail, Rocket, User, Stars, Sparkles } from 'lucide-react';

const TRACKING_SESSION_KEY = 'thank_you_payment_tracked';
const TRACKING_TIMESTAMP_KEY = 'thank_you_payment_timestamp';
const TRACKING_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

const ThankYou = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { trackEvent } = useTrackingEvents();
  const hasTrackedRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    // Check if already tracked recently with timestamp verification
    const lastTracked = sessionStorage.getItem(TRACKING_SESSION_KEY);
    const lastTimestamp = sessionStorage.getItem(TRACKING_TIMESTAMP_KEY);
    const now = Date.now();
    
    if (lastTracked === 'true' && lastTimestamp) {
      const timeDiff = now - parseInt(lastTimestamp);
      if (timeDiff < TRACKING_WINDOW_MS) {
        console.log('ThankYou: Payment already tracked recently, skipping', { timeDiff });
        hasTrackedRef.current = true;
        return;
      }
    }

    // Only track when user is fully loaded and we haven't tracked yet
    if (!loading && !hasTrackedRef.current) {
      console.log('ThankYou: Preparing to track payment_completed event', { 
        userId: user?.id, 
        userExists: !!user,
        loading,
        hasTracked: hasTrackedRef.current
      });
      
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        // Double-check we haven't tracked yet (race condition protection)
        if (!hasTrackedRef.current) {
          console.log('ThankYou: Executing payment_completed tracking');
          trackEvent('payment_completed', user?.id);
          hasTrackedRef.current = true;
          sessionStorage.setItem(TRACKING_SESSION_KEY, 'true');
          sessionStorage.setItem(TRACKING_TIMESTAMP_KEY, now.toString());
          console.log('ThankYou: Payment tracking completed successfully');
        } else {
          console.log('ThankYou: Event already tracked, skipping duplicate');
        }
      }, 1000); // Increased debounce to 1 second
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [loading]); // Only depend on loading to prevent unnecessary re-runs

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-900 via-blue-900 to-slate-900">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
          <h1 className="text-2xl font-bold text-white">21M Space</h1>
          <p className="text-white/70 mt-2">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-b from-slate-900 via-blue-900 to-slate-900">
      {/* Animated stars background */}
      <div className="absolute inset-0">
        {[...Array(100)].map((_, i) => (
          <div
            key={i}
            className="absolute animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${2 + Math.random() * 3}s`
            }}
          >
            <div className="w-1 h-1 bg-white rounded-full opacity-60"></div>
          </div>
        ))}
      </div>

      {/* Floating elements */}
      <div className="absolute inset-0 pointer-events-none">
        <Stars className="absolute top-1/4 left-1/4 text-blue-300 opacity-20 animate-float" size={32} />
        <Sparkles className="absolute top-1/3 right-1/4 text-cyan-300 opacity-30 animate-float" size={24} style={{animationDelay: '1s'}} />
        <Stars className="absolute bottom-1/3 left-1/3 text-blue-400 opacity-25 animate-float" size={28} style={{animationDelay: '2s'}} />
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-lg mx-auto">
          {/* Main content card */}
          <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-8 shadow-2xl animate-scale-in">
            {/* Success icon */}
            <div className="text-center mb-8">
              <div className="mx-auto mb-6 p-4 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full w-fit animate-bounce-gentle shadow-lg shadow-green-500/30">
                <CheckCircle className="h-12 w-12 text-white" />
              </div>
              <h1 className="text-4xl font-bold text-white mb-2 bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
                Payment Successful!
              </h1>
              <p className="text-blue-200 text-lg">
                Welcome to the future of social media
              </p>
            </div>
            
            {user ? (
              // User is logged in - show upgrade success
              <div className="text-center space-y-6">
                <div className="p-6 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl border border-blue-300/30 backdrop-blur-sm">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-full mb-4 shadow-lg">
                    <User className="h-6 w-6 text-white" />
                  </div>
                  <p className="text-white/90 font-medium">
                    Welcome back! Your account has been upgraded successfully.
                  </p>
                  <p className="text-blue-200 text-sm mt-2">
                    You now have access to all premium features
                  </p>
                </div>
                
                <Button 
                  onClick={() => navigate('/dashboard')} 
                  className="w-full bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white border-0 shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-all duration-300"
                  size="lg"
                >
                  <Rocket className="h-5 w-5 mr-2" />
                  Launch to Dashboard
                </Button>
              </div>
            ) : (
              // User is not logged in - show email confirmation flow
              <div className="text-center space-y-6">
                <div className="p-6 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl border border-blue-300/30 backdrop-blur-sm">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-full mb-4 shadow-lg animate-pulse">
                    <Mail className="h-6 w-6 text-white" />
                  </div>
                  <p className="text-white/90 font-medium mb-3">
                    Check your email to confirm your account
                  </p>
                  <p className="text-blue-200 text-sm">
                    After confirming, you'll set up your username and password to start exploring the galaxy of social media management.
                  </p>
                </div>
                
                <div className="space-y-4">
                  <Button 
                    onClick={() => navigate('/auth')} 
                    className="w-full bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white border-0 shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-all duration-300"
                    size="lg"
                  >
                    <Rocket className="h-5 w-5 mr-2" />
                    Continue to Login
                  </Button>
                  
                  <p className="text-blue-200 text-sm">
                    Already confirmed your email? Sign in above to start your journey
                  </p>
                </div>
              </div>
            )}
            
            {/* Footer message */}
            <div className="text-center pt-8 mt-8 border-t border-white/20">
              <p className="text-blue-200 font-medium">
                Ready to conquer the social media universe?
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThankYou;