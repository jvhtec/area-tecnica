
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SectionProps } from "@/types/festival-form";

export const NotesSection = ({ formData, onChange, isFieldLocked, language = "es" }: SectionProps) => {
  const notesLocked = isFieldLocked?.("notes") ?? false;
  const tx = (es: string, en: string) => (language === "en" ? en : es);

  return (
    <div className="space-y-4 border rounded-lg p-3 md:p-4">
      <h3 className="text-base md:text-lg font-semibold">{tx("Notas Adicionales", "Additional Notes")}</h3>
      <div>
        <Label htmlFor="notes" className="text-sm md:text-base">{tx("Notas", "Notes")}</Label>
        <Textarea
          id="notes"
          value={formData.notes || ""}
          onChange={(e) => onChange({ notes: e.target.value })}
          placeholder={tx(
            "Ingrese notas adicionales sobre configuración, requerimientos o restricciones...",
            "Enter additional notes about setup, requirements, or constraints..."
          )}
          className="h-24 text-sm md:text-base"
          disabled={notesLocked}
        />
      </div>
    </div>
  );
};
