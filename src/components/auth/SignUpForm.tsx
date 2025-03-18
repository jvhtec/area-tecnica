
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SignUpFormFields } from "./signup/SignUpFormFields";
import { SignUpFormActions } from "./signup/SignUpFormActions";

interface SignUpFormProps {
  onBack?: () => void;
  preventAutoLogin?: boolean;
}

export const SignUpForm = ({ onBack, preventAutoLogin = false }: SignUpFormProps) => {
  const { signUp, isLoading, error: authError } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (formData: any) => {
    setError(null);

    try {
      console.log("Starting user creation process");
      
      if (preventAutoLogin) {
        // TODO: Handle admin user creation flow (if needed)
        console.log("Admin user creation flow");
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
      />
      {onBack && <SignUpFormActions onBack={onBack} loading={isLoading} />}
    </div>
  );
};
