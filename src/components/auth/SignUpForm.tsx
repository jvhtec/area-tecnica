
import { useState } from "react";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SignUpFormFields } from "./signup/SignUpFormFields";
import { SignUpFormActions } from "./signup/SignUpFormActions";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

interface SignUpFormProps {
  onBack?: () => void;
  preventAutoLogin?: boolean;
}

export const SignUpForm = ({ onBack, preventAutoLogin = false }: SignUpFormProps) => {
  const { signUp, isLoading, error: authError } = useOptimizedAuth();
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSubmit = async (formData: any) => {
    setError(null);

    try {
      console.log("Starting user creation process");
      
      if (preventAutoLogin) {
        // Create user via Edge Function with default password, without logging in
        const payload = {
          email: formData.email,
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.phone,
          department: formData.department,
          dni: formData.dni,
          residencia: formData.residencia,
        };

        const { data, error: fnError } = await supabase.functions.invoke("create-user", {
          body: payload,
        });

        if (fnError) {
          throw fnError;
        }

        toast({
          title: "User created",
          description: `Account created for ${payload.email} with default password`,
        });
        if (onBack) onBack();
        return;
      }
      
      await signUp({
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        department: formData.department,
        dni: formData.dni,
        residencia: formData.residencia,
      });
    } catch (err: any) {
      console.error("Error in signup form:", err);
      setError(err.message || "An unexpected error occurred");
    }
  };

  return (
    <div className="space-y-6">
      {(error || authError) && (
        <Alert variant="destructive">
          <AlertDescription>{error || authError}</AlertDescription>
        </Alert>
      )}
      
      <SignUpFormFields 
        onSubmit={handleSubmit}
        error={error || authError}
        isLoading={isLoading}
        hidePassword={preventAutoLogin}
        submitLabel={preventAutoLogin ? 'Create User' : 'Sign Up'}
      />
      {onBack && <SignUpFormActions onBack={onBack} loading={isLoading} />}
    </div>
  );
};
