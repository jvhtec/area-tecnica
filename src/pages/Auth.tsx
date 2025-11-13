import { useState, useEffect } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { LoginForm } from "@/components/auth/LoginForm";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { getDashboardPath } from "@/utils/roleBasedRouting";
import { UserRole } from "@/types/user";

const Auth = () => {
  const { session, userRole, isLoading, error } = useOptimizedAuth();
  const [searchParams] = useSearchParams();
  const [showSignUp, setShowSignUp] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const isRecovery = searchParams.get('type') === 'recovery';
  
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white" />
      </div>
    );
  }

  if (session && !isRecovery) {
    const dashboardPath = getDashboardPath(userRole as UserRole);
    return <Navigate to={dashboardPath} replace />;
  }

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
          {isRecovery ? (
            <ResetPasswordForm 
              onSuccess={() => {
                // User will be automatically redirected after successful reset
              }} 
            />
          ) : showForgotPassword ? (
            <ForgotPasswordForm onBack={() => setShowForgotPassword(false)} />
          ) : showSignUp ? (
            <SignUpForm onBack={() => setShowSignUp(false)} />
          ) : (
            <LoginForm 
              onShowSignUp={() => setShowSignUp(true)}
              onShowForgotPassword={() => setShowForgotPassword(true)}
            />
          )}
        </Card>

        <div className="mt-8 flex justify-center">
          <img 
            src="/lovable-uploads/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png" 
            alt="Sector Pro Logo" 
            width="174"
            height="48"
            fetchPriority="high"
            className="h-12 w-auto opacity-80"
          />
        </div>
      </div>
    </div>
  );
};

export default Auth;
