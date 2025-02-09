import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface LoginFormProps {
  onShowSignUp: () => void;
}

export const LoginForm = ({ onShowSignUp }: LoginFormProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      console.log("Starting login process for email:", formData.email);
      
      // First attempt to sign in
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email.toLowerCase(),
        password: formData.password,
      });

      if (signInError) {
        console.error("Login error:", signInError);
        if (signInError.message.includes("Email not confirmed")) {
          setError("Please check your email to verify your account before logging in.");
        } else if (signInError.message.includes("Invalid login credentials")) {
          setError("Invalid email or password. Please try again.");
        } else {
          setError(signInError.message);
        }
        return;
      }

      if (!signInData.user) {
        console.error("No user data returned after login");
        setError("No user found with these credentials.");
        return;
      }

      console.log("Login successful, fetching user profile");

      // Fetch user profile data
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role, department')
        .eq('id', signInData.user.id)
        .single();

      if (profileError) {
        console.error("Error fetching user profile:", profileError);
        setError("Error fetching user profile. Please try logging in again.");
        // Sign out the user since we couldn't get their profile
        await supabase.auth.signOut();
        return;
      }

      if (!profileData) {
        console.error("No profile data found");
        setError("User profile not found. Please contact support.");
        await supabase.auth.signOut();
        return;
      }

      console.log("Login successful for user:", signInData.user.email, "with role:", profileData.role);
      
      toast({
        title: "Welcome back!",
        description: "You have successfully logged in.",
      });

      // Redirect based on role
      if (profileData.role === 'technician') {
        navigate("/technician-dashboard");
      } else {
        navigate("/dashboard");
      }
    } catch (error: any) {
      console.error("Unexpected error during login:", error);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
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
        <Button type="submit" disabled={loading}>
          {loading ? (
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