
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionProps } from "@/types/festival-form";

export const BasicInfoSection = ({ formData }: SectionProps) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Artist/Band Name</Label>
          <Input value={formData.name} readOnly className="bg-muted" />
        </div>
        <div>
          <Label>Stage</Label>
          <Input value={formData.stage} readOnly className="bg-muted" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Show Start</Label>
          <Input value={formData.show_start} readOnly className="bg-muted" />
        </div>
        <div>
          <Label>Show End</Label>
          <Input value={formData.show_end} readOnly className="bg-muted" />
        </div>
      </div>
      {formData.soundcheck && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Soundcheck Start</Label>
            <Input value={formData.soundcheck_start} readOnly className="bg-muted" />
          </div>
          <div>
            <Label>Soundcheck End</Label>
            <Input value={formData.soundcheck_end} readOnly className="bg-muted" />
          </div>
        </div>
      )}
    </div>
  );
};
