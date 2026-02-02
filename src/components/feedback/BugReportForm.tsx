import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Bug, Loader2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { ScreenshotCapture } from "./ScreenshotCapture";
import { getRecentConsoleLogs } from "@/utils/consoleCapture";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const bugReportSchema = z.object({
  title: z.string().min(5, "El título debe tener al menos 5 caracteres"),
  description: z.string().min(10, "La descripción debe tener al menos 10 caracteres"),
  reproductionSteps: z.string().optional(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  includeConsoleLogs: z.boolean().default(false),
  reporterEmail: z.string().email("Correo electrónico inválido"),
});

type BugReportFormData = z.infer<typeof bugReportSchema>;

/**
 * Render a bug report form UI that collects user-provided bug details and submits them to the backend.
 *
 * The form collects a title, description, optional reproduction steps, severity, an optional screenshot,
 * an option to include recent console logs, and a reporter email. It validates input (including a 5MB
 * approximate limit for screenshots), sends the data to a Supabase function, shows a success dialog
 * with an optional GitHub issue link on success, and displays an error toast on failure.
 *
 * @returns The React element for the bug report form and its success dialog.
 */
export function BugReportForm() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [screenshotFilename, setScreenshotFilename] = useState<string | null>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [githubIssueUrl, setGithubIssueUrl] = useState<string | null>(null);

  const form = useForm<BugReportFormData>({
    resolver: zodResolver(bugReportSchema),
    defaultValues: {
      title: "",
      description: "",
      reproductionSteps: "",
      severity: "medium",
      includeConsoleLogs: false,
      reporterEmail: user?.email || "",
    },
  });

  // Update reporterEmail when user data loads
  useEffect(() => {
    if (user?.email && !form.getValues("reporterEmail")) {
      form.setValue("reporterEmail", user.email);
    }
  }, [user?.email, form]);

  const handleScreenshotCapture = (dataUrl: string, filename: string) => {
    setScreenshot(dataUrl);
    setScreenshotFilename(filename);
  };

  const handleScreenshotClear = () => {
    setScreenshot(null);
    setScreenshotFilename(null);
  };

  const onSubmit = async (data: BugReportFormData) => {
    setIsSubmitting(true);
    try {
      // Validate screenshot size before sending (max 5MB accounting for base64 overhead)
      if (screenshot) {
        // Remove data URL prefix to get pure base64
        const base64Data = screenshot.split(",")[1] || screenshot;
        // Calculate approximate binary size (base64 is ~33% larger than binary)
        const binarySize = Math.ceil((base64Data.length * 3) / 4);
        const maxSize = 5 * 1024 * 1024; // 5MB

        if (binarySize > maxSize) {
          toast({
            title: "Imagen demasiado grande",
            description: `La captura de pantalla es demasiado grande (${(binarySize / 1024 / 1024).toFixed(2)}MB). El tamaño máximo es 5MB. Por favor, usa una imagen más pequeña.`,
            variant: "destructive",
          });
          setIsSubmitting(false);
          return;
        }
      }

      // Get app version from environment
      const appVersion = import.meta.env.VITE_APP_VERSION || "unknown";

      // Collect environment info
      const environmentInfo = {
        browser: navigator.userAgent,
        os: (navigator as any).userAgentData?.platform || navigator.platform || "unknown",
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        language: navigator.language,
      };

      // Get console logs if requested
      let consoleLogs = undefined;
      if (data.includeConsoleLogs) {
        consoleLogs = getRecentConsoleLogs(100);
      }

      // Call Supabase function to submit bug report
      const { data: result, error } = await supabase.functions.invoke("submit-bug-report", {
        body: {
          title: data.title,
          description: data.description,
          reproductionSteps: data.reproductionSteps,
          severity: data.severity,
          screenshot,
          screenshotFilename,
          consoleLogs,
          reporterEmail: data.reporterEmail,
          appVersion,
          environmentInfo,
        },
      });

      if (error) {
        throw error;
      }

      // Show success message
      setGithubIssueUrl(result?.githubIssue?.url || null);
      setShowSuccessDialog(true);

      // Reset form (preserve reporterEmail to avoid re-prompting)
      const currentEmail = form.getValues("reporterEmail");
      form.reset({
        title: "",
        description: "",
        reproductionSteps: "",
        severity: "medium",
        includeConsoleLogs: false,
        reporterEmail: currentEmail,
      });
      setScreenshot(null);
      setScreenshotFilename(null);
    } catch (error) {
      console.error("Error submitting bug report:", error);
      toast({
        title: "Error",
        description: "No se pudo enviar el informe de error. Por favor, inténtalo de nuevo.",
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
                <FormLabel>Título del error *</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Ej: Error al guardar el formulario de asignación"
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
                    placeholder="Describe el error que encontraste..."
                    className="min-h-[100px]"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="reproductionSteps"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Pasos para reproducir (opcional)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="1. Ir a la página de asignaciones&#10;2. Hacer clic en 'Guardar'&#10;3. Ver el error..."
                    className="min-h-[80px]"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Ayúdanos a reproducir el error listando los pasos
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="severity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Severidad *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona la severidad" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="low">🟢 Baja - Problema menor</SelectItem>
                    <SelectItem value="medium">🟡 Media - Afecta funcionalidad</SelectItem>
                    <SelectItem value="high">🟠 Alta - Problema importante</SelectItem>
                    <SelectItem value="critical">🔴 Crítica - Bloquea trabajo</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <ScreenshotCapture
            onScreenshotCapture={handleScreenshotCapture}
            onClear={handleScreenshotClear}
            currentScreenshot={screenshot || undefined}
          />

          <FormField
            control={form.control}
            name="includeConsoleLogs"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Incluir registro de consola</FormLabel>
                  <FormDescription>
                    Esto puede incluir información técnica de tu dispositivo y de la aplicación.
                    Los últimos 100 mensajes de consola serán incluidos. Por favor, revisa que no contenga información sensible antes de enviar.
                  </FormDescription>
                </div>
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
                  Te notificaremos cuando el error sea resuelto
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
                <Bug className="mr-2 h-4 w-4" />
                Enviar informe de error
              </>
            )}
          </Button>
        </form>
      </Form>

      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>✅ Informe enviado correctamente</DialogTitle>
            <DialogDescription className="space-y-4 pt-4">
              <p>
                Tu informe se ha enviado correctamente. Nuestro equipo lo revisará
                y trabajará en resolverlo lo antes posible.
              </p>
              {githubIssueUrl && (
                <p>
                  Puedes seguir el progreso en GitHub:{" "}
                  <a
                    href={githubIssueUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Ver issue
                  </a>
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                Te notificaremos por correo cuando el error sea resuelto.
              </p>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
}