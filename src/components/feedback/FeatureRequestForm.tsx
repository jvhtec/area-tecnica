import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Lightbulb, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const featureRequestSchema = z.object({
  title: z.string().min(5, "El título debe tener al menos 5 caracteres"),
  description: z.string().min(10, "La descripción debe tener al menos 10 caracteres"),
  useCase: z.string().optional(),
  reporterEmail: z.string().email("Correo electrónico inválido"),
});

type FeatureRequestFormData = z.infer<typeof featureRequestSchema>;

/**
 * Render a feature request form that validates input and submits requests to the backend.
 *
 * The form uses the `featureRequestSchema` for validation and pre-fills the reporter email from
 * the current authenticated user when available. On submission the component invokes the
 * Supabase edge function "submit-feature-request"; on success it shows a confirmation dialog and
 * resets the form, and on failure it displays a destructive toast with an error message.
 */
export function FeatureRequestForm() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);

  const form = useForm<FeatureRequestFormData>({
    resolver: zodResolver(featureRequestSchema),
    defaultValues: {
      title: "",
      description: "",
      useCase: "",
      reporterEmail: user?.email || "",
    },
  });

  const onSubmit = async (data: FeatureRequestFormData) => {
    setIsSubmitting(true);
    try {
      // Call Supabase function to submit feature request
      const { data: result, error } = await supabase.functions.invoke("submit-feature-request", {
        body: {
          title: data.title,
          description: data.description,
          useCase: data.useCase,
          reporterEmail: data.reporterEmail,
        },
      });

      if (error) {
        throw error;
      }

      // Show success message
      setShowSuccessDialog(true);

      // Reset form
      form.reset();
    } catch (error) {
      console.error("Error submitting feature request:", error);
      toast({
        title: "Error",
        description: "No se pudo enviar la solicitud de función. Por favor, inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Título de la función *</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Ej: Exportar informes a PDF"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Descripción *</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Describe la función que te gustaría tener..."
                    className="min-h-[120px]"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Explica qué te gustaría que hiciera esta nueva función
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="useCase"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Caso de uso / Por qué lo necesitas (opcional)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Ej: Necesito poder exportar los informes mensuales en PDF para enviarlos a clientes..."
                    className="min-h-[80px]"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Ayúdanos a entender cómo usarías esta función
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="reporterEmail"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Correo electrónico para notificaciones *</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="tu@email.com"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Te notificaremos sobre el estado de tu solicitud
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Lightbulb className="mr-2 h-4 w-4" />
                Enviar solicitud de función
              </>
            )}
          </Button>
        </form>
      </Form>

      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>✅ Solicitud enviada correctamente</DialogTitle>
            <DialogDescription className="space-y-4 pt-4">
              <p>
                Tu solicitud de función se ha enviado correctamente. Nuestro equipo
                la revisará y la evaluará para futuras versiones.
              </p>
              <p className="text-sm text-muted-foreground">
                Te notificaremos por correo sobre cualquier actualización.
              </p>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
}