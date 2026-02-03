import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

interface ResetPasswordFormProps {
  onSuccess: () => void;
}

export const ResetPasswordForm = ({ onSuccess }: ResetPasswordFormProps) => {
  const { resetPassword, isLoading } = useAuth();
  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [hasValidSession, setHasValidSession] = useState<boolean | null>(null);

  // Check for valid recovery session on mount
  const [searchParams] = useSearchParams();

  useEffect(() => {
    let sub: { unsubscribe: () => void } | null = null;
    const ensureSession = async () => {
      let resolved = false;
      try {
        // 1) PKCE exchange if present
        const href = typeof window !== 'undefined' ? window.location.href : '';
        if (href.includes('code=')) {
          console.log('[ResetPassword] Exchanging code for session...');
          try {
            await supabase.auth.exchangeCodeForSession(href);
            console.log('[ResetPassword] Code exchange successful');
          } catch (ex) {
            console.warn('[ResetPassword] Code exchange failed:', ex);
          }
        }

        // 2) Manual token handling as fallback (handles access_token in hash/query)
        const url = new URL(href);
        const query = url.searchParams;
        const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
        const accessToken = query.get('access_token') || hashParams.get('access_token') || undefined;
        const refreshToken = query.get('refresh_token') || hashParams.get('refresh_token') || undefined;
        if (accessToken && refreshToken) {
          console.log('[ResetPassword] Found tokens in URL, setting session...');
          try {
            await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          } catch (ex) {
            console.warn('[ResetPassword] setSession failed:', ex);
          }
        }

        // 3) Check session now
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          console.log('[ResetPassword] Valid session found');
          resolved = true;
          setHasValidSession(true);
          return;
        }

        // 4) Wait briefly for async auth url detection
        console.log('[ResetPassword] Waiting for auth state change...');
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
          if (sess && !resolved) {
            console.log('[ResetPassword] Session arrived via onAuthStateChange');
            resolved = true;
            setHasValidSession(true);
          }
        });
        sub = subscription;

        // Give it a short window then fail
        setTimeout(async () => {
          if (resolved) return;
          const { data: { session: s2 } } = await supabase.auth.getSession();
          if (s2) {
            resolved = true;
            setHasValidSession(true);
          } else if (!resolved) {
            console.error('[ResetPassword] No session after timeout');
            setHasValidSession(false);
            setError('Invalid or expired reset link. Please request a new password reset.');
          }
        }, 2500);
      } catch (e) {
        console.error('[ResetPassword] Unexpected error ensuring session:', e);
        setHasValidSession(false);
        setError('Invalid or expired reset link. Please request a new password reset.');
      }
    };

    // Only run on recovery flow
    const isRecovery = searchParams.get('type') === 'recovery' || window.location.href.includes('type=recovery');
    if (isRecovery) {
      ensureSession();
    } else {
      // Not a recovery flow; consider no session valid for this form
      setHasValidSession(false);
    }
    return () => { if (sub) sub.unsubscribe(); };
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!formData.password || !formData.confirmPassword) {
      setError("Please fill in all fields");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    console.log('[ResetPassword] Updating password...');

    try {
      await resetPassword(formData.password);
      console.log('[ResetPassword] Password updated successfully');
      onSuccess();
    } catch (err: any) {
      console.error('[ResetPassword] Error:', err);
      setError(err.message || "Failed to reset password");
    }
  };

  // Show loading state while checking session
  if (hasValidSession === null) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Show error if no valid session
  if (hasValidSession === false) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertDescription>
            Invalid or expired reset link. Please request a new password reset.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold">Set New Password</h2>
        <p className="text-muted-foreground mt-2">
          Enter your new password below.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <div className="space-y-2">
        <Label htmlFor="new-password">New Password</Label>
        <Input
          id="new-password"
          type="password"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          required
          className="w-full"
          placeholder="Enter new password"
          minLength={6}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm-password">Confirm Password</Label>
        <Input
          id="confirm-password"
          type="password"
          value={formData.confirmPassword}
          onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
          required
          className="w-full"
          placeholder="Confirm new password"
          minLength={6}
        />
      </div>

      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Updating Password...
          </>
        ) : (
          'Update Password'
        )}
      </Button>
    </form>
  );
};
