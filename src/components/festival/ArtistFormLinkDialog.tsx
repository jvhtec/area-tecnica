
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Copy, Mail, Printer, RefreshCcw } from "lucide-react";
import { useState, useEffect } from "react";
import { addDays } from "date-fns";
import { generateQRCode } from "@/utils/qrcode";
import { exportArtistPDF, ArtistPdfData } from "@/utils/artistPdfExport";
import { fetchJobLogo } from "@/utils/pdf/logoUtils";
import { fetchFestivalGearOptionsForTemplate } from "@/utils/festivalGearOptions";

interface ArtistFormLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  artistId: string;
  artistName: string;
  jobId?: string;
  selectedDate?: string;
}

export const ArtistFormLinkDialog = ({
  open,
  onOpenChange,
  artistId,
  artistName,
  jobId,
  selectedDate,
}: ArtistFormLinkDialogProps) => {
  const { toast } = useToast();
  const [formToken, setFormToken] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [recipientEmails, setRecipientEmails] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [isGeneratingBlankPdf, setIsGeneratingBlankPdf] = useState(false);
  const [artistLanguage, setArtistLanguage] = useState<"es" | "en">("es");
  const [formExpiresAt, setFormExpiresAt] = useState<string>("");

  const tx = (es: string, en: string) => (artistLanguage === "en" ? en : es);
  const buildFormUrl = (token: string) =>
    `${window.location.origin}/festival/artist-form/${token}?lang=${artistLanguage}`;
  const formLink = formToken ? buildFormUrl(formToken) : "";
  const formatExpiry = (value: string) =>
    new Intl.DateTimeFormat(artistLanguage === "en" ? "en-GB" : "es-ES", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Madrid",
    }).format(new Date(value));
  const isExpiringSoon = !!formExpiresAt && new Date(formExpiresAt).getTime() - Date.now() <= 24 * 60 * 60 * 1000;

  const getErrorMessage = (error: unknown) =>
    error instanceof Error ? error.message : "Ocurrió un error inesperado";

  const escapeHtml = (str: string) =>
    str.replace(/[&<>"']/g, (char) => {
      const escaped: Record<string, string> = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };
      return escaped[char] || char;
    });

  const generateNewLink = async () => {
    if (!artistId) {
      toast({
        title: "Error",
        description: "Se requiere el ID del artista para generar un enlace de formulario.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // First, mark any existing pending forms for THIS ARTIST as expired
      const { error: updateError } = await supabase
        .from('festival_artist_forms')
        .update({
          status: 'expired',
          expires_at: new Date().toISOString() // Expire immediately
        })
        .eq('artist_id', artistId) // Only affect THIS artist's forms
        .eq('status', 'pending');

      if (updateError) {
        console.error('Error expiring existing forms:', updateError);
        throw updateError;
      }

      // Create a new form entry that expires in 7 days
      const expiresAt = addDays(new Date(), 7);
      
      const { data, error } = await supabase
        .from('festival_artist_forms')
        .insert({
          artist_id: artistId,
          expires_at: expiresAt.toISOString(),
          status: 'pending'
        })
        .select('token')
        .maybeSingle();

      if (error) {
        console.error('Error generating form link:', error);
        throw error;
      }

      if (!data?.token) {
        throw new Error('Failed to generate form token');
      }

      setFormToken(data.token);
      setFormExpiresAt(expiresAt.toISOString());

      toast({
        title: tx("Enlace generado", "Link generated"),
        description: tx(
          "El nuevo enlace de formulario ha sido generado correctamente.",
          "The new form link was generated successfully."
        ),
      });
    } catch (error: unknown) {
      console.error('Error generating form link:', error);
      toast({
        title: tx("Error", "Error"),
        description:
          getErrorMessage(error) ||
          tx("No se pudo generar el enlace del formulario.", "Could not generate the form link."),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(formLink);
      toast({
        title: tx("Copiado", "Copied"),
        description: tx("Enlace copiado al portapapeles", "Link copied to clipboard"),
      });
    } catch (error) {
      toast({
        title: tx("Error", "Error"),
        description: tx("No se pudo copiar el enlace", "Could not copy the link"),
        variant: "destructive",
      });
    }
  };

  const parseRecipientEmails = (value: string) =>
    Array.from(
      new Set(
        value
          .split(/[,\n;]+/)
          .map((email) => email.trim())
          .filter(Boolean),
      ),
    );

  const saveArtistLanguage = async (nextLanguage: "es" | "en") => {
    setArtistLanguage(nextLanguage);
    const { error } = await supabase
      .from("festival_artists")
      .update({ form_language: nextLanguage })
      .eq("id", artistId);

    if (error) {
      console.error("Error saving artist form language:", error);
      toast({
        title: tx("Error", "Error"),
        description: tx("No se pudo guardar el idioma del artista.", "Could not save artist language."),
        variant: "destructive",
      });
    }
  };

  const sendLinkByEmail = async () => {
    const recipients = parseRecipientEmails(recipientEmails);
    if (!formLink || recipients.length === 0) {
      toast({
        title: tx("Faltan datos", "Missing data"),
        description: tx(
          "Añade al menos un correo y genera un enlace antes de enviar.",
          "Add at least one email and generate a link before sending."
        ),
        variant: "destructive",
      });
      return;
    }

    setIsSendingEmail(true);
    try {
      const inlineImages =
        qrCodeDataUrl && qrCodeDataUrl.startsWith("data:")
          ? (() => {
              const [meta, content] = qrCodeDataUrl.split(",", 2);
              const mimeType = meta.match(/data:(.*?);base64/)?.[1] || "image/png";
              return [
                {
                  cid: "artist_form_qr",
                  content,
                  mimeType,
                  filename: `artist-form-${artistName || "artist"}.png`,
                },
              ];
            })()
          : [];

      const bodyHtml =
        artistLanguage === "en"
          ? `
        <p>Hello,</p>
        <p>You can complete the technical form for <strong>${escapeHtml(artistName)}</strong> using the button below.</p>
        <p>
          <a
            href="${formLink}"
            target="_blank"
            rel="noopener noreferrer"
            style="display:inline-block;padding:10px 16px;border-radius:6px;background:#7d0101;color:#ffffff;text-decoration:none;font-weight:600;"
          >
            Click here to fill the form
          </a>
        </p>
        <p>You can also scan this QR code:</p>
        <p><img src="cid:artist_form_qr" alt="Artist form QR" style="max-width:220px;height:auto;" /></p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
        <p style="font-size:12px;color:#6b7280;">
          This is an automated email. Please do not reply. For any issues, contact the festival technical office at
          <a href="mailto:sonido@sector-pro.com">sonido@sector-pro.com</a>.
        </p>
      `
          : `
        <p>Hola,</p>
        <p>Puedes completar el formulario técnico de <strong>${escapeHtml(artistName)}</strong> usando el botón de abajo.</p>
        <p>
          <a
            href="${formLink}"
            target="_blank"
            rel="noopener noreferrer"
            style="display:inline-block;padding:10px 16px;border-radius:6px;background:#7d0101;color:#ffffff;text-decoration:none;font-weight:600;"
          >
            Haz clic aquí para completar el formulario
          </a>
        </p>
        <p>También puedes escanear este código QR:</p>
        <p><img src="cid:artist_form_qr" alt="QR formulario artista" style="max-width:220px;height:auto;" /></p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
        <p style="font-size:12px;color:#6b7280;">
          Este correo es automático. Por favor, no respondas a este email. Si tienes incidencias, contacta con la oficina técnica del festival en
          <a href="mailto:sonido@sector-pro.com">sonido@sector-pro.com</a>.
        </p>
      `;

      const { data, error } = await supabase.functions.invoke("send-corporate-email", {
        body: {
          subject:
            artistLanguage === "en"
              ? `Technical form - ${artistName}`
              : `Formulario técnico - ${artistName}`,
          bodyHtml,
          recipients: {
            emails: recipients,
          },
          inlineImages,
          senderNameOverride: "Festivales - Sector Pro",
        },
      });

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.error || "No se pudo enviar el correo");
      }

      toast({
        title: tx("Correo enviado", "Email sent"),
        description:
          artistLanguage === "en"
            ? `Link sent to ${recipients.length} recipient(s).`
            : `Se envió el enlace a ${recipients.length} destinatario(s).`,
      });
    } catch (error: unknown) {
      console.error("Error sending artist form email:", error);
      toast({
        title: tx("Error", "Error"),
        description:
          getErrorMessage(error) ||
          tx("No se pudo enviar el correo con el enlace.", "Could not send the email with the link."),
        variant: "destructive",
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const downloadBlankTemplatePdf = async () => {
    if (!artistId) return;

    setIsGeneratingBlankPdf(true);
    try {
      const { data: artistData, error: artistError } = await supabase
        .from("festival_artists")
        .select("name, stage, date, show_start, show_end, soundcheck, soundcheck_start, soundcheck_end")
        .eq("id", artistId)
        .maybeSingle();

      if (artistError) throw artistError;

      const templateDate = artistData?.date || selectedDate || new Date().toISOString().slice(0, 10);
      const templateName = artistData?.name || artistName || "Artista";
      const templateStage = typeof artistData?.stage === "number" ? artistData.stage : 1;
      let publicFormUrl = formToken ? buildFormUrl(formToken) : "";
      let publicFormQrDataUrl = "";

      if (!publicFormUrl) {
        const { data: existingForm, error: existingFormError } = await supabase
          .from("festival_artist_forms")
          .select("token")
          .eq("artist_id", artistId)
          .eq("status", "pending")
          .gt("expires_at", new Date().toISOString())
          .limit(1)
          .maybeSingle();

        if (!existingFormError && existingForm?.token) {
          publicFormUrl = buildFormUrl(existingForm.token);
        }
      }

      if (publicFormUrl) {
        try {
          publicFormQrDataUrl = await generateQRCode(publicFormUrl);
        } catch (qrError) {
          console.error("Error generating QR for blank template PDF:", qrError);
        }
      }

      let logoUrl: string | undefined;
      let festivalOptions: ArtistPdfData["festivalOptions"];
      if (jobId) {
        logoUrl = await fetchJobLogo(jobId);
        festivalOptions = await fetchFestivalGearOptionsForTemplate(jobId, templateStage);
      }

      const blankPdfData: ArtistPdfData = {
        name: templateName,
        stage: templateStage,
        date: templateDate,
        schedule: {
          show: {
            start: artistData?.show_start || "",
            end: artistData?.show_end || "",
          },
          soundcheck: artistData?.soundcheck
            ? {
                start: artistData?.soundcheck_start || "",
                end: artistData?.soundcheck_end || "",
              }
            : undefined,
        },
        technical: {
          fohTech: false,
          monTech: false,
          fohConsole: { model: "", providedBy: "festival" },
          monConsole: { model: "", providedBy: "festival" },
          wireless: { systems: [], providedBy: "festival" },
          iem: { systems: [], providedBy: "festival" },
          monitors: {
            enabled: false,
            quantity: 0,
          },
        },
        infrastructure: {
          providedBy: "festival",
          cat6: { enabled: false, quantity: 0 },
          hma: { enabled: false, quantity: 0 },
          coax: { enabled: false, quantity: 0 },
          opticalconDuo: { enabled: false, quantity: 0 },
          analog: 0,
          other: "",
        },
        extras: {
          sideFill: false,
          drumFill: false,
          djBooth: false,
          wired: "",
        },
        notes: "",
        wiredMics: [],
        micKit: "festival",
        riderMissing: false,
        logoUrl,
        festivalOptions,
        publicFormUrl,
        publicFormQrDataUrl,
      };

      const blob = await exportArtistPDF(blankPdfData, {
        templateMode: true,
        language: artistLanguage,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeName = templateName.replace(/[^a-zA-Z0-9_-]/g, "_") || "Artista";
      a.download =
        artistLanguage === "en"
          ? `Template_${safeName}_${templateDate}.pdf`
          : `Plantilla_${safeName}_${templateDate}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: tx("Plantilla generada", "Template generated"),
        description: tx("Se descargó la plantilla PDF en blanco.", "Blank PDF template downloaded."),
      });
    } catch (error) {
      console.error("Error generating blank artist template PDF:", error);
      toast({
        title: tx("Error", "Error"),
        description: tx("No se pudo generar la plantilla PDF en blanco.", "Could not generate the blank PDF template."),
        variant: "destructive",
      });
    } finally {
      setIsGeneratingBlankPdf(false);
    }
  };

  useEffect(() => {
    if (open && artistId) {
      // Check for existing unexpired form link for THIS SPECIFIC ARTIST
      const checkExistingLink = async () => {
        try {
          const { data: artistData, error: artistError } = await supabase
            .from("festival_artists")
            .select("form_language")
            .eq("id", artistId)
            .maybeSingle();

          if (artistError) {
            console.warn("Could not load artist language preference:", artistError);
          } else if (artistData?.form_language === "en" || artistData?.form_language === "es") {
            setArtistLanguage(artistData.form_language);
          } else {
            setArtistLanguage("es");
          }

          const { data, error } = await supabase
            .from('festival_artist_forms')
            .select('token, expires_at')
            .eq('artist_id', artistId) // Only check THIS artist's forms
            .eq('status', 'pending')
            .gt('expires_at', new Date().toISOString())
            .limit(1)
            .maybeSingle();

          if (error) {
            console.error('Error checking existing link:', error);
            throw error;
          }

          if (data?.token) {
            setFormToken(data.token);
            setFormExpiresAt(data.expires_at || "");
          } else {
            setFormToken("");
            setFormExpiresAt("");
          }
        } catch (error) {
          console.error('Error checking existing link:', error);
          setFormToken("");
          setFormExpiresAt("");
          toast({
            title: "Error",
            description: "No se pudo verificar el enlace de formulario existente.",
            variant: "destructive",
          });
        }
      };

      checkExistingLink();
    }
  }, [open, artistId, toast]);

  useEffect(() => {
    let cancelled = false;

    const makeQr = async () => {
      if (!formLink) {
        setQrCodeDataUrl("");
        return;
      }

      try {
        const qr = await generateQRCode(formLink);
        if (!cancelled) {
          setQrCodeDataUrl(qr);
        }
      } catch (error) {
        console.error("Error generating QR code for artist form:", error);
        if (!cancelled) {
          setQrCodeDataUrl("");
        }
      }
    };

    makeQr();
    return () => {
      cancelled = true;
    };
  }, [formLink]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Enlace de Formulario para {artistName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {formLink ? (
            <>
              <div className="flex space-x-2">
                <Input
                  value={formLink}
                  readOnly
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copyToClipboard}
                  title="Copiar enlace"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <Button
                onClick={generateNewLink}
                className="w-full"
                disabled={isLoading}
              >
                <RefreshCcw className="h-4 w-4 mr-2" />
                Generar Nuevo Enlace
              </Button>
              {formExpiresAt && (
                <div
                  className={`rounded-md border px-3 py-2 text-sm ${
                    isExpiringSoon
                      ? "border-amber-300 bg-amber-50 text-amber-900"
                      : "border-blue-200 bg-blue-50 text-blue-900"
                  }`}
                >
                  <p>
                    {tx("Este enlace expira:", "This link expires:")} <strong>{formatExpiry(formExpiresAt)}</strong>
                  </p>
                  <p className="text-xs mt-1">
                    {tx(
                      "Si necesitas rotarlo antes, usa “Generar Nuevo Enlace”.",
                      "If you need to rotate it before then, use “Generate New Link”."
                    )}
                  </p>
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={downloadBlankTemplatePdf}
                disabled={isGeneratingBlankPdf}
                className="w-full"
              >
                <Printer className="h-4 w-4 mr-2" />
                {isGeneratingBlankPdf ? "Generando Plantilla..." : "Plantilla PDF en Blanco"}
              </Button>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {tx("Idioma del artista", "Artist language")}
                </label>
                <Select
                  value={artistLanguage}
                  onValueChange={(value) => {
                    const nextLanguage = value === "en" ? "en" : "es";
                    void saveArtistLanguage(nextLanguage);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="es">Español</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {qrCodeDataUrl && (
                <div className="flex justify-center p-2 border rounded-md">
                  <img src={qrCodeDataUrl} alt="QR Formulario Artista" className="h-40 w-40 object-contain" />
                </div>
              )}
              <div className="space-y-2">
                <label htmlFor="recipient-emails" className="text-sm font-medium">
                  Enviar enlace por email (externo)
                </label>
                <Textarea
                  id="recipient-emails"
                  value={recipientEmails}
                  onChange={(e) => setRecipientEmails(e.target.value)}
                  placeholder="correo1@dominio.com, correo2@dominio.com"
                  rows={3}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={sendLinkByEmail}
                  disabled={isSendingEmail}
                  className="w-full"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  {isSendingEmail ? "Enviando correo..." : "Enviar Enlace + QR"}
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <div className="rounded-md border border-muted px-3 py-2 text-xs text-muted-foreground">
                {tx(
                  "Los enlaces públicos expiran en 7 días. Puedes regenerarlos para rotarlos cuando sea necesario.",
                  "Public links expire in 7 days. You can regenerate them to rotate when needed."
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {tx("Idioma del artista", "Artist language")}
                </label>
                <Select
                  value={artistLanguage}
                  onValueChange={(value) => {
                    const nextLanguage = value === "en" ? "en" : "es";
                    void saveArtistLanguage(nextLanguage);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="es">Español</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={generateNewLink}
                className="w-full"
                disabled={isLoading}
              >
                Generar Enlace
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={downloadBlankTemplatePdf}
                disabled={isGeneratingBlankPdf}
                className="w-full"
              >
                <Printer className="h-4 w-4 mr-2" />
                {isGeneratingBlankPdf ? "Generando Plantilla..." : "Plantilla PDF en Blanco"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
