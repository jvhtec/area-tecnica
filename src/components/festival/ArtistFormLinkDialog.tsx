import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, Mail, Printer } from "lucide-react";
import { useArtistFormSend } from "@/features/festival-forms/hooks/useArtistFormSend";

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
  const form = useArtistFormSend({ open, artistId, artistName, jobId, selectedDate });
  const { tx } = form;

  const formatExpiry = (value: string) =>
    new Intl.DateTimeFormat(form.language === "en" ? "en-GB" : "es-ES", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Madrid",
    }).format(new Date(value));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {tx("Enviar formulario a", "Send form to")} {artistName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {form.formLink ? (
            <>
              <div className="flex space-x-2">
                <Input value={form.formLink} readOnly className="flex-1" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={form.copyLink}
                  title={tx("Copiar enlace", "Copy link")}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              {form.formExpiresAt && (
                <div
                  className={`rounded-md border px-3 py-2 text-sm ${
                    form.isExpiringSoon
                      ? "border-amber-300 bg-amber-50 text-amber-900"
                      : "border-blue-200 bg-blue-50 text-blue-900"
                  }`}
                >
                  {tx("Este enlace expira:", "This link expires:")}{" "}
                  <strong>{formatExpiry(form.formExpiresAt)}</strong>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-md border border-muted px-3 py-2 text-xs text-muted-foreground">
              {tx(
                "El enlace público se creará al enviar el formulario y expirará en 7 días.",
                "The public link will be created when the form is sent and will expire in 7 days.",
              )}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">{tx("Idioma del artista", "Artist language")}</label>
            <Select
              value={form.language}
              onValueChange={(value) => void form.changeLanguage(value === "en" ? "en" : "es")}
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

          {form.qrCodeDataUrl && (
            <div className="flex justify-center p-2 border rounded-md">
              <img src={form.qrCodeDataUrl} alt="QR Formulario Artista" className="h-40 w-40 object-contain" />
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            onClick={form.downloadBlankTemplate}
            disabled={form.isGeneratingBlankPdf}
            className="w-full"
          >
            <Printer className="h-4 w-4 mr-2" />
            {form.isGeneratingBlankPdf ? "Generando Plantilla..." : "Plantilla PDF en Blanco"}
          </Button>

          <div className="space-y-2">
            <label htmlFor="recipient-emails" className="text-sm font-medium">
              {tx("Enviar formulario por email", "Send form by email")}
            </label>
            <Textarea
              id="recipient-emails"
              value={form.recipientEmails}
              onChange={(event) => form.setRecipientEmails(event.target.value)}
              placeholder="correo1@dominio.com, correo2@dominio.com"
              rows={3}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={form.sendByEmail}
              disabled={form.isSendingEmail}
              className="w-full"
            >
              <Mail className="h-4 w-4 mr-2" />
              {form.isSendingEmail
                ? tx("Enviando formulario...", "Sending form...")
                : tx("Enviar formulario + QR", "Send form + QR")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
