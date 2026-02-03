import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowLeft } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";

interface ForgotPasswordFormProps {
  onBack: () => void;
}

export const ForgotPasswordForm = ({ onBack }: ForgotPasswordFormProps) => {
  const { requestPasswordReset, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!email) {
      setError("Please enter your email address");
      return;
    }

    console.log('[ForgotPassword] Requesting reset for:', email);

    try {
      await requestPasswordReset(email);
      console.log('[ForgotPassword] Reset request successful');
      setSuccess(true);
    } catch (err: any) {
      console.error('[ForgotPassword] Error:', err);
      setError(err.message || "Failed to send password reset email. Please try again.");
    }
  };

  if (success) {
    return (
      <div className="space-y-4">
        <Alert>
          <AlertDescription>
            If an account with that email exists, a password reset link has been sent to your email address.
            Please check your inbox and follow the instructions to reset your password.
          </AlertDescription>
        </Alert>
        
        <Button 
          type="button" 
          variant="ghost" 
          onClick={onBack}
          className="w-full"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Login
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold">Reset Password</h2>
        <p className="text-muted-foreground mt-2">
          Enter your email address and we'll send you a link to reset your password.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <div className="space-y-2">
        <Label htmlFor="reset-email">Email</Label>
        <Input
          id="reset-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full"
          placeholder="Enter your email address"
        />
      </div>

      <div className="flex flex-col space-y-4">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending Reset Link...
            </>
          ) : (
            'Send Reset Link'
          )}
        </Button>
        
        <Button type="button" variant="ghost" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Login
        </Button>
      </div>
    </form>
  );
};