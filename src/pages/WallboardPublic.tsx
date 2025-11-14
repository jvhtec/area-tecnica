import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import SplashScreen from '@/components/SplashScreen';
import { WallboardDisplay } from './Wallboard';

/**
 * WallboardPublic - Tokenized access to wallboard without authentication
 *
 * URL format: /wallboard/public/:token/:presetSlug?
 *
 * The token is a simple shared secret that allows access to the wallboard
 * without requiring user login. In production, this should be a long random string.
 */
export default function WallboardPublic() {
  const { token, presetSlug } = useParams<{ token: string; presetSlug?: string }>();
  const navigate = useNavigate();
  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setError('No token provided');
        setIsValidating(false);
        return;
      }

      // For now, we'll use a simple token validation
      // In production, you should set VITE_WALLBOARD_TOKEN in your environment
      const expectedToken = import.meta.env.VITE_WALLBOARD_TOKEN || 'demo-wallboard-token';

      if (token === expectedToken) {
        setIsValid(true);
        setIsValidating(false);
      } else {
        setError('Invalid access token');
        setIsValidating(false);
      }
    };

    validateToken();
  }, [token]);

  // Show splash screen while validating
  if (isValidating) {
    return <SplashScreen duration={5000} />;
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
