
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SectionProps } from "@/types/festival-form";

export const NotesSection = ({ formData, onChange }: SectionProps) => {
  return (
    <div className="space-y-4 border rounded-lg p-3 md:p-4">
      <h3 className="text-base md:text-lg font-semibold">Notas Adicionales</h3>
      <div>
        <Label htmlFor="notes" className="text-sm md:text-base">Notas</Label>
        <Textarea
          id="notes"
          value={formData.notes || ""}
          onChange={(e) => onChange({ notes: e.target.value })}
          placeholder="Ingrese notas adicionales sobre configuración, requerimientos o restricciones..."
          className="h-24 text-sm md:text-base"
        />
      </div>
    </div>
  );
};
