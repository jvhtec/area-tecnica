
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";

interface LoginFormProps {
  onShowSignUp: () => void;
}

export const LoginForm = ({ onShowSignUp }: LoginFormProps) => {
  const { login, isLoading, error: authError } = useOptimizedAuth();
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!formData.email || !formData.password) {
      setError("Please enter both email and password");
      return;
    }
    
    await login(formData.email, formData.password);
  };

  return (
    <form onSubmit={handleLogin} className="space-y-4">
      {(error || authError) && (
        <Alert variant="destructive">
          <AlertDescription>{error || authError}</AlertDescription>
        </Alert>
      )}
      
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          required
          className="w-full"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          required
          className="w-full"
        />
      </div>

      <div className="flex flex-col space-y-4">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Logging in...
            </>
          ) : (
            'Log In'
          )}
        </Button>
        <Button type="button" variant="ghost" onClick={onShowSignUp}>
          Don't have an account? Sign Up
        </Button>
      </div>
    </form>
  );
};
