
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionProps } from "@/types/festival-form";

export const NotesSection = ({ formData, onChange }: SectionProps) => {
  return (
    <div className="space-y-2">
      <Label htmlFor="notes">Additional Notes</Label>
      <Input
        id="notes"
        value={formData.notes || ''}
        onChange={(e) => onChange({
          notes: e.target.value
        })}
        placeholder="Enter any additional notes or requirements"
      />
    </div>
  );
};
