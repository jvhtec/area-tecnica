import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import SplashScreen from '@/components/SplashScreen';
import { WallboardDisplay } from './Wallboard';
import { exchangeWallboardToken } from '@/lib/wallboard-api';
import { getErrorMessage, getErrorStack, getErrorStatus } from '@/utils/errorMessage';

/**
 * WallboardPublic - Tokenized access to wallboard with JWT-based authentication
 *
 * URL format: /wallboard/public/:token/:presetSlug?
 *
 * Authentication flow:
 * 1. Sends the shared link token to the wallboard-auth edge function
 * 2. Receives a short-lived, wallboard-scoped JWT
 * 3. Passes that JWT to WallboardDisplay so it can call wallboard feeds directly
 * 4. Displays the wallboard with proper data access
 */
export default function WallboardPublic() {
  const { token, presetSlug } = useParams<{ token: string; presetSlug?: string }>();
  const navigate = useNavigate();
  const [isValid, setIsValid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSplash, setShowSplash] = useState(true);
  const [splashComplete, setSplashComplete] = useState(false);
  const [authComplete, setAuthComplete] = useState(false);
  const [wallboardToken, setWallboardToken] = useState<string | null>(null);
  const [refreshAt, setRefreshAt] = useState<number | null>(null);
  const wallboardTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (authComplete && splashComplete) {
      setShowSplash(false);
    }
  }, [authComplete, splashComplete]);

  const authenticate = useCallback(async (isRenewal = false) => {
    if (!token) {
      setError('No se ha proporcionado un token de acceso.');
      setIsValid(false);
      setAuthComplete(true);
      return false;
    }

    try {
      const result = await exchangeWallboardToken(token, presetSlug);
      wallboardTokenRef.current = result.token;
      setWallboardToken(result.token);
      setRefreshAt(Date.now() + Math.max(30, result.expiresIn - 60) * 1000);
      setError(null);
      setIsValid(true);
      setAuthComplete(true);
      return true;
    } catch (err) {
      console.error('Wallboard token exchange failed', {
        message: getErrorMessage(err),
        status: getErrorStatus(err),
        stack: getErrorStack(err),
      });
      if (isRenewal && wallboardTokenRef.current) {
        setRefreshAt(Date.now() + 30_000);
        return false;
      }
      setError(`No se pudo iniciar la sesión del wallboard: ${getErrorMessage(err, 'error desconocido')}. Actualice el enlace compartido.`);
      setIsValid(false);
      setAuthComplete(true);
      return false;
    }
  }, [presetSlug, token]);

  useEffect(() => {
    setAuthComplete(false);
    void authenticate();
  }, [authenticate]);

  useEffect(() => {
    if (!refreshAt) return;
    const timeoutId = window.setTimeout(() => {
      void authenticate(true);
    }, Math.max(1_000, refreshAt - Date.now()));
    return () => window.clearTimeout(timeoutId);
  }, [authenticate, refreshAt]);

  const handleWallboardFatalError = useCallback(() => {
    void authenticate();
  }, [authenticate]);

  // Show error if token is invalid (before splash completes)
  if (!isValid && error && authComplete) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8">
        <div className="max-w-md w-full space-y-6">
          <div className="text-center">
            <img
              src="/sector pro logo.png"
              alt="Sector-Pro"
              width={794}
              height={100}
              loading="eager"
              decoding="async"
              className="w-48 mx-auto mb-6"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = "/lovable-uploads/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png";
              }}
            />
            <h1 className="text-3xl font-bold text-red-500 mb-4">Acceso denegado</h1>
            <p className="text-zinc-400 mb-6">
              {error}
            </p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-3 bg-white text-black rounded hover:bg-zinc-200 transition-colors"
            >
              Volver al inicio
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
      {showSplash && <SplashScreen onComplete={() => setSplashComplete(true)} />}
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
