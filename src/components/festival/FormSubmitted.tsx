
import { CheckCircle } from "lucide-react";
import { useSearchParams } from "react-router-dom";

export const FormSubmitted = () => {
  const [searchParams] = useSearchParams();
  const language = searchParams.get("lang") === "en" ? "en" : "es";
  const tx = (es: string, en: string) => (language === "en" ? en : es);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md mx-auto text-center space-y-4">
        <CheckCircle className="h-16 w-16 mx-auto text-green-500" />
        <h1 className="text-2xl font-bold">{tx("Formulario enviado", "Form submitted")}</h1>
        <p className="text-muted-foreground">
          {tx(
            "Gracias por enviar sus requerimientos técnicos. Este enlace ya no permite nuevos envíos.",
            "Thank you for submitting your technical requirements. This link does not accept additional submissions."
          )}
        </p>
      </div>
    </div>
  );
};
