import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { trackError } from "@/lib/errorTracking";
import { downloadBlobInBrowser } from "@/features/festival-management/commands";
import { blobToBase64 } from "@/utils/blobToBase64";
import { generateQRCode } from "@/utils/qrcode";
import { fetchArtistFormLanguage, fetchPendingArtistForm, saveArtistFormLanguage, sendCorporateEmail } from "../api";
import { buildArtistBlankTemplatePdf } from "../blankTemplatePdf";
import { buildArtistFormEmail, parseRecipientEmails, toInlineQrImage } from "../emailTemplate";
import { getOrCreateArtistFormTokenForSend } from "../formTokens";
import { festivalFormKeys } from "../keys";
import { buildArtistFormUrl, type FormLanguage } from "../links";

interface UseArtistFormSendOptions {
  open: boolean;
  artistId: string;
  artistName: string;
  jobId?: string;
  selectedDate?: string;
}

const EXPIRING_SOON_MS = 24 * 60 * 60 * 1000;

/**
 * The "send form to artist" flow: shows the artist's active link (if one was already sent),
 * issues a token only when the form is actually sent by email, and downloads the blank template.
 */
export function useArtistFormSend({ open, artistId, artistName, jobId, selectedDate }: UseArtistFormSendOptions) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [language, setLanguage] = useState<FormLanguage>("es");
  // A token issued by this dialog; it wins over whatever the query found before.
  const [issued, setIssued] = useState<{ token: string; expiresAt: string } | null>(null);
  const [recipientEmails, setRecipientEmails] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isGeneratingBlankPdf, setIsGeneratingBlankPdf] = useState(false);

  const tx = (es: string, en: string) => (language === "en" ? en : es);

  const existing = useQuery({
    queryKey: festivalFormKeys.artist(artistId),
    queryFn: async () => ({
      language: await fetchArtistFormLanguage(artistId).catch((error) => {
        // Not being able to read the preference only means the default language.
        void trackError(error, { system: "festivals", operation: "load-artist-form-language", artistId });
        return "es" as FormLanguage;
      }),
      pending: await fetchPendingArtistForm(artistId),
    }),
    enabled: open && !!artistId,
    staleTime: 0,
    refetchOnMount: "always",
  });

  useEffect(() => {
    if (existing.data) setLanguage(existing.data.language);
  }, [existing.data]);

  useEffect(() => {
    if (!existing.error) return;
    void trackError(existing.error, { system: "festivals", operation: "load-artist-form-link", artistId });
    toast({
      title: "Error",
      description: "No se pudo verificar el enlace de formulario existente.",
      variant: "destructive",
    });
  }, [existing.error, artistId, toast]);

  // A token issued here is only trusted while the dialog stays open on the same artist. When it
  // closes, reopens or is reused for another artist, the link shown is whatever the server says
  // now: the form may have been submitted, expired or replaced in the meantime.
  useEffect(() => {
    setIssued(null);
  }, [open, artistId]);

  const token = issued?.token ?? existing.data?.pending?.token ?? "";
  const formExpiresAt = issued?.expiresAt ?? existing.data?.pending?.expiresAt ?? "";
  const formLink = token ? buildArtistFormUrl(token, language) : "";
  const isExpiringSoon = !!formExpiresAt && new Date(formExpiresAt).getTime() - Date.now() <= EXPIRING_SOON_MS;

  const qr = useQuery({
    queryKey: festivalFormKeys.qr(formLink),
    queryFn: () => generateQRCode(formLink),
    enabled: !!formLink,
  });

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(formLink);
      toast({ title: tx("Copiado", "Copied"), description: tx("Enlace copiado al portapapeles", "Link copied to clipboard") });
    } catch {
      toast({
        title: "Error",
        description: tx("No se pudo copiar el enlace", "Could not copy the link"),
        variant: "destructive",
      });
    }
  };

  const changeLanguage = async (next: FormLanguage) => {
    setLanguage(next);
    try {
      await saveArtistFormLanguage(artistId, next);
    } catch (error) {
      void trackError(error, { system: "festivals", operation: "save-artist-form-language", artistId });
      toast({
        title: "Error",
        description: tx("No se pudo guardar el idioma del artista.", "Could not save artist language."),
        variant: "destructive",
      });
    }
  };

  const sendByEmail = async () => {
    const recipients = parseRecipientEmails(recipientEmails);
    if (!artistId || recipients.length === 0) {
      toast({
        title: tx("Faltan datos", "Missing data"),
        description: tx("Añade al menos un correo antes de enviar.", "Add at least one email before sending."),
        variant: "destructive",
      });
      return;
    }

    setIsSendingEmail(true);
    try {
      // The public link only comes into existence here, when the form is actually sent.
      const form = await getOrCreateArtistFormTokenForSend(artistId);
      setIssued({ token: form.token, expiresAt: form.expiresAt });
      void queryClient.invalidateQueries({ queryKey: festivalFormKeys.links(jobId) });

      const outgoingLink = buildArtistFormUrl(form.token, language);
      const qrDataUrl = await generateQRCode(outgoingLink);
      const template = await buildArtistBlankTemplatePdf({
        artistId,
        artistName,
        selectedDate,
        jobId,
        language,
        formUrl: outgoingLink,
      });
      const { subject, bodyHtml } = buildArtistFormEmail({ language, artistName, formLink: outgoingLink });

      await sendCorporateEmail({
        subject,
        bodyHtml,
        recipients,
        inlineImages: toInlineQrImage(qrDataUrl, artistName),
        pdfAttachments: [
          {
            filename: template.fileName,
            content: await blobToBase64(template.blob),
            size: template.blob.size,
          },
        ],
      });

      toast({
        title: tx("Correo enviado", "Email sent"),
        description:
          language === "en"
            ? `Link sent to ${recipients.length} recipient(s).`
            : `Se envió el enlace a ${recipients.length} destinatario(s).`,
      });
    } catch (error) {
      void trackError(error, { system: "festivals", operation: "send-artist-form-email", artistId });
      toast({
        title: "Error",
        description:
          (error instanceof Error && error.message) ||
          tx("No se pudo enviar el correo con el enlace.", "Could not send the email with the link."),
        variant: "destructive",
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const downloadBlankTemplate = async () => {
    if (!artistId) return;
    setIsGeneratingBlankPdf(true);
    try {
      const { blob, fileName } = await buildArtistBlankTemplatePdf({
        artistId,
        artistName,
        selectedDate,
        jobId,
        language,
        formUrl: formLink || undefined,
      });
      downloadBlobInBrowser(blob, fileName);
      toast({
        title: tx("Plantilla generada", "Template generated"),
        description: tx("Se descargó la plantilla PDF en blanco.", "Blank PDF template downloaded."),
      });
    } catch (error) {
      void trackError(error, { system: "festivals", operation: "download-blank-template", artistId });
      toast({
        title: "Error",
        description: tx("No se pudo generar la plantilla PDF en blanco.", "Could not generate the blank PDF template."),
        variant: "destructive",
      });
    } finally {
      setIsGeneratingBlankPdf(false);
    }
  };

  return {
    language,
    tx,
    formLink,
    formExpiresAt,
    isExpiringSoon,
    qrCodeDataUrl: qr.data ?? "",
    recipientEmails,
    setRecipientEmails,
    isSendingEmail,
    isGeneratingBlankPdf,
    copyLink,
    changeLanguage,
    sendByEmail,
    downloadBlankTemplate,
  };
}
