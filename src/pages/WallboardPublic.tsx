import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import SplashScreen from '@/components/SplashScreen';
import { WallboardDisplay } from './Wallboard';
import { exchangeWallboardToken } from '@/lib/wallboard-api';

/**
 * WallboardPublic - Tokenized access to wallboard with JWT-based authentication
 *
 * URL format: /wallboard/public/:token/:presetSlug?
 *
 * Authentication flow:
 * 1. Validates the provided token against VITE_WALLBOARD_TOKEN
 * 2. Calls the wallboard-auth edge function to get a JWT
 * 3. Passes that JWT to WallboardDisplay so it can call wallboard feeds directly
 * 4. Displays the wallboard with proper data access
 */
export default function WallboardPublic() {
  const { token, presetSlug } = useParams<{ token: string; presetSlug?: string }>();
  const navigate = useNavigate();
  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSplash, setShowSplash] = useState(true);
  const [authComplete, setAuthComplete] = useState(false);
  const [wallboardToken, setWallboardToken] = useState<string | null>(null);

  // Handle splash screen completion
  const handleSplashComplete = () => {
    // Only hide splash if auth is also complete
    if (authComplete) {
      setShowSplash(false);
    }
  };

  // When auth completes, check if splash timer has also finished
  useEffect(() => {
    if (authComplete && !showSplash) {
      // Both complete, do nothing (already hidden)
    }
  }, [authComplete, showSplash]);

  useEffect(() => {
    const validateTokenAndAuthenticate = async () => {
      if (!token) {
        setError('No token provided');
        setIsValidating(false);
        setAuthComplete(true);
        return;
      }

      console.log('🔐 Attempting token exchange...', { tokenLength: token.length });

      // Step 1: Exchange the shared token for a short-lived JWT
      try {
        const result = await exchangeWallboardToken(token, presetSlug);
        console.log('✅ Token exchange successful', { jwtLength: result.token.length, expiresIn: result.expiresIn });
        setWallboardToken(result.token);
        setIsValid(true);
        setIsValidating(false);
        setAuthComplete(true);
      } catch (err: any) {
        console.error('❌ Wallboard token exchange failed:', err);
        console.error('Error details:', {
          message: err?.message,
          status: err?.status,
          stack: err?.stack,
        });
        setError(`Failed to initialize wallboard session: ${err?.message || 'Unknown error'}. Please refresh your shared link.`);
        setIsValid(false);
        setIsValidating(false);
        setAuthComplete(true);
      }
    };

    validateTokenAndAuthenticate();
  }, [token]);

  const handleWallboardFatalError = (message?: string) => {
    setError(message || 'Access token expired or invalid. Please request a new wallboard link.');
    setIsValid(false);
    setAuthComplete(true);
  };

  // Show error if token is invalid (before splash completes)
  if (!isValid && error && authComplete) {
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

  // Render wallboard in background while splash is showing (so data loads during splash)
  // Once auth completes and is valid, start loading the wallboard
  const shouldLoadWallboard = authComplete && isValid;

  return (
    <>
      {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
      {shouldLoadWallboard && (
        <div style={{ visibility: showSplash ? 'hidden' : 'visible' }}>
          <WallboardDisplay
            presetSlug={presetSlug}
            skipSplash={true}
            wallboardApiToken={wallboardToken ?? undefined}
            onFatalError={handleWallboardFatalError}
          />
        </div>
      )}
    </>
  );
}
