import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { SignUpFormFields } from "./signup/SignUpFormFields";
import { SignUpFormActions } from "./signup/SignUpFormActions";
import { AuthApiError } from "@supabase/supabase-js";

interface SignUpFormProps {
  onBack?: () => void;
  preventAutoLogin?: boolean;
}

export const SignUpForm = ({ onBack, preventAutoLogin = false }: SignUpFormProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (formData: any) => {
    setIsLoading(true);
    setError(null);

    try {
      console.log("Starting user creation process");
      
      // Attempt to sign up the user directly
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email.toLowerCase(),
        password: formData.password,
        options: {
          data: {
            first_name: formData.firstName,
            last_name: formData.lastName,
            phone: formData.phone,
            department: formData.department,
            dni: formData.dni,
            residencia: formData.residencia,
          },
        },
      });

      if (signUpError) {
        console.error("Signup error:", signUpError);
        if (signUpError instanceof AuthApiError && signUpError.message === "User already registered") {
          setError("This email is already registered. Please use a different email or contact an administrator.");
        } else {
          setError(signUpError.message);
        }
        return;
      }

      if (!signUpData.user) {
        setError("Failed to create user account.");
        return;
      }

      console.log("User created successfully:", signUpData.user.email);

      // If we're preventing auto-login (e.g., in settings page)
      if (preventAutoLogin) {
        console.log("Auto-login prevented - user created from settings");
        toast({
          title: "Success",
          description: "New user account created successfully.",
        });
        if (onBack) onBack();
        return;
      }

      // Normal signup flow with auto-login (e.g., in auth page)
      console.log("Proceeding with normal signup flow");
      toast({
        title: "Welcome!",
        description: "Your account has been created successfully.",
      });
      navigate("/dashboard");

    } catch (error: any) {
      console.error("Unexpected error during signup:", error);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <SignUpFormFields 
        onSubmit={handleSubmit}
        error={error}
        isLoading={isLoading}
      />
      {onBack && <SignUpFormActions onBack={onBack} loading={isLoading} />}
    </div>
  );
};