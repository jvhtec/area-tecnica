
import { CheckCircle } from "lucide-react";

export const FormSubmitted = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md mx-auto text-center space-y-4">
        <CheckCircle className="h-16 w-16 mx-auto text-green-500" />
        <h1 className="text-2xl font-bold">Form Submitted Successfully</h1>
        <p className="text-muted-foreground">
          Thank you for submitting your technical requirements. The festival team will review your submission.
        </p>
      </div>
    </div>
  );
};
