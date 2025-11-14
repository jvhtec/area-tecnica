import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import SplashScreen from '@/components/SplashScreen';
import { WallboardDisplay } from './Wallboard';

/**
 * WallboardPublic - Tokenized access to wallboard with JWT-based authentication
 *
 * URL format: /wallboard/public/:token/:presetSlug?
 *
 * Authentication flow:
 * 1. Validates the provided token against VITE_WALLBOARD_TOKEN
 * 2. Calls the wallboard-auth edge function to get a JWT
 * 3. Authenticates with Supabase using a dedicated wallboard service account
 * 4. Displays the wallboard with proper data access
 */
export default function WallboardPublic() {
  const { token, presetSlug } = useParams<{ token: string; presetSlug?: string }>();
  const navigate = useNavigate();
  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const validateTokenAndAuthenticate = async () => {
      if (!token) {
        setError('No token provided');
        setIsValidating(false);
        return;
      }

      // Step 1: Validate the token against environment variable
      const expectedToken = import.meta.env.VITE_WALLBOARD_TOKEN || 'demo-wallboard-token';

      // Debug logging (remove in production)
      console.log('🔐 Token validation:', {
        urlToken: token,
        expectedToken: expectedToken,
        envVarSet: !!import.meta.env.VITE_WALLBOARD_TOKEN,
        match: token === expectedToken
      });

      if (token !== expectedToken) {
        setError('Invalid access token');
        setIsValidating(false);
        return;
      }

      // Step 2: Authenticate with Supabase using wallboard service account
      try {
        // Check if there are wallboard credentials configured
        const wallboardEmail = import.meta.env.VITE_WALLBOARD_USER_EMAIL;
        const wallboardPassword = import.meta.env.VITE_WALLBOARD_USER_PASSWORD;

        if (wallboardEmail && wallboardPassword) {
          // Sign in with dedicated wallboard account
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: wallboardEmail,
            password: wallboardPassword,
          });

          if (signInError) {
            console.error('Wallboard auth error:', signInError);
            setError('Failed to authenticate wallboard session. Please check configuration.');
            setIsValidating(false);
            return;
          }

          // Successfully authenticated
          setIsValid(true);
          setIsValidating(false);
        } else {
          // No credentials configured - check if there's already a valid session
          const { data: { session } } = await supabase.auth.getSession();

          if (session) {
            // User is already logged in, use their session
            setIsValid(true);
            setIsValidating(false);
          } else {
            // No credentials and no session - provide setup instructions
            setError('Wallboard service account not configured. See documentation for setup instructions.');
            setIsValidating(false);
          }
        }
      } catch (err) {
        console.error('Authentication exception:', err);
        setError('Failed to authenticate. Please try again.');
        setIsValidating(false);
      }
    };

    validateTokenAndAuthenticate();
  }, [token]);

  // Show splash screen while validating
  if (isValidating) {
    return <SplashScreen />;
  }

  // Show error if token is invalid
  if (!isValid || error) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8">
        <div className="max-w-md w-full space-y-6">
          <div className="text-center">
            <img
              src="/sector pro logo.png"
              alt="Sector-Pro"
              className="w-48 mx-auto mb-6"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = "/lovable-uploads/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png";
              }}
            />
            <h1 className="text-3xl font-bold text-red-500 mb-4">Access Denied</h1>
            <p className="text-zinc-400 mb-6">
              {error || 'Invalid or expired access token. Please contact your administrator for a valid wallboard link.'}
            </p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-3 bg-white text-black rounded hover:bg-zinc-200 transition-colors"
            >
              Return to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Token is valid - display the wallboard without authentication
  return <WallboardDisplay presetSlug={presetSlug} />;
}
