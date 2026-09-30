import { Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface MissingRiderEmailFormProps {
  recipients: string;
  onRecipientsChange: (value: string) => void;
  isSending: boolean;
  onSend: () => void;
}

/** Sends the missing-rider report to external recipients. */
export const MissingRiderEmailForm = ({
  recipients,
  onRecipientsChange,
  isSending,
  onSend,
}: MissingRiderEmailFormProps) => (
  <div className="pl-6 mt-3 space-y-2">
    <Label htmlFor="missing-rider-recipient-emails" className="text-sm font-medium dark:text-gray-200">
      Enviar reporte por email (externo)
    </Label>
    <Textarea
      id="missing-rider-recipient-emails"
      value={recipients}
      onChange={(event) => onRecipientsChange(event.target.value)}
      placeholder="correo1@dominio.com, correo2@dominio.com"
      rows={3}
    />
    <Button type="button" variant="secondary" onClick={onSend} disabled={isSending} className="w-full sm:w-auto">
      <Mail className="h-4 w-4 mr-2" />
      {isSending ? "Enviando reporte..." : "Enviar Reporte por Email"}
    </Button>
  </div>
);
