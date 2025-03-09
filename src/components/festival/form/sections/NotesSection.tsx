
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SectionProps } from "@/types/festival-form";

export const NotesSection = ({ formData, onChange }: SectionProps) => {
  return (
    <div className="space-y-4 border rounded-lg p-4">
      <h3 className="text-lg font-semibold">Additional Notes</h3>
      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes || ""}
          onChange={(e) => onChange({ notes: e.target.value })}
          placeholder="Enter additional notes about setup, requirements, or restrictions..."
          className="h-24"
        />
      </div>
    </div>
  );
};
