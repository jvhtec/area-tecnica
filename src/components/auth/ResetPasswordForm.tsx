import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { supabase } from "@/lib/supabase";

interface ResetPasswordFormProps {
  onSuccess: () => void;
}

export const ResetPasswordForm = ({ onSuccess }: ResetPasswordFormProps) => {
  const { resetPassword, isLoading } = useOptimizedAuth();
  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [hasValidSession, setHasValidSession] = useState<boolean | null>(null);

  // Check for valid recovery session on mount
  useEffect(() => {
    const checkSession = async () => {
      console.log('[ResetPassword] Checking for recovery session...');
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error('[ResetPassword] No session found');
        setHasValidSession(false);
        setError("Invalid or expired reset link. Please request a new password reset.");
        return;
      }

      console.log('[ResetPassword] Valid session found');
      setHasValidSession(true);
    };

    checkSession();
  }, []);

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
