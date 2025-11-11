
import { CheckCircle } from "lucide-react";

export const FormSubmitted = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md mx-auto text-center space-y-4">
        <CheckCircle className="h-16 w-16 mx-auto text-green-500" />
        <h1 className="text-2xl font-bold">Formulario Enviado Correctamente</h1>
        <p className="text-muted-foreground">
          Gracias por enviar sus requerimientos técnicos. El equipo del festival revisará su envío.
        </p>
      </div>
    </div>
  );
};
