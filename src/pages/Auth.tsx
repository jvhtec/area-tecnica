
import { useState, useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { LoginForm } from "@/components/auth/LoginForm";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";

const Auth = () => {
  const { session, isLoading, error } = useAuth();
  const [showSignUp, setShowSignUp] = useState(false);
  const navigate = useNavigate();
  
  useEffect(() => {
    // Remove dark mode for better authentication UI visibility
    const originalTheme = document.documentElement.classList.contains("dark");
    document.documentElement.classList.remove("dark");

    return () => {
      if (originalTheme) {
        document.documentElement.classList.add("dark");
      }
    };
  }, []);

  // Only redirect once when session is available and not loading
  useEffect(() => {
    if (session && !isLoading) {
      navigate("/dashboard", { replace: true });
    }
  }, [session, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white" />
      </div>
    );
  }

  // Don't use Navigate component, rely on the useEffect above for redirection
  // This prevents potential loops and excessive history.replaceState calls

  return (
    <div className="min-h-screen flex flex-col px-4 py-8 md:py-12">
      <div className="container max-w-lg mx-auto flex-1 flex flex-col">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">Bienvenido</h1>
          <p className="text-lg text-muted-foreground">
            al Area Tecnica Sector-Pro
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card className="p-6 w-full shadow-lg">
          {showSignUp ? (
            <SignUpForm onBack={() => setShowSignUp(false)} />
          ) : (
            <LoginForm onShowSignUp={() => setShowSignUp(true)} />
          )}
        </Card>

        <div className="mt-8 flex justify-center">
          <img 
            src="/lovable-uploads/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png" 
            alt="Sector Pro Logo" 
            className="h-12 w-auto opacity-80"
          />
        </div>
      </div>
    </div>
  );
};

export default Auth;
