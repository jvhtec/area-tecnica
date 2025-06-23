
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArtistSectionProps } from "@/types/artist-form";

export const BasicInfoSection = ({ formData, onChange }: ArtistSectionProps) => {
  return (
    <div className="space-y-4 border rounded-lg p-4">
      <h3 className="text-lg font-semibold">Basic Information</h3>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Artist/Band Name</Label>
          <Input 
            value={formData.name || ""} 
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Enter artist name"
          />
        </div>
        <div>
          <Label>Stage</Label>
          <Select 
            value={formData.stage?.toString() || "1"} 
            onValueChange={(value) => onChange({ stage: parseInt(value) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: formData.max_stages || 3 }, (_, i) => (
                <SelectItem key={i + 1} value={(i + 1).toString()}>
                  Stage {i + 1}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Show Start</Label>
          <Input 
            type="time"
            value={formData.show_start || ""} 
            onChange={(e) => onChange({ show_start: e.target.value })}
          />
        </div>
        <div>
          <Label>Show End</Label>
          <Input 
            type="time"
            value={formData.show_end || ""} 
            onChange={(e) => onChange({ show_end: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Checkbox 
            id="soundcheck"
            checked={formData.soundcheck}
            onCheckedChange={(checked) => onChange({ soundcheck: checked })}
          />
          <Label htmlFor="soundcheck">Soundcheck Required</Label>
        </div>

        {formData.soundcheck && (
          <div className="grid grid-cols-2 gap-4 ml-6">
            <div>
              <Label>Soundcheck Start</Label>
              <Input 
                type="time"
                value={formData.soundcheck_start || ""} 
                onChange={(e) => onChange({ soundcheck_start: e.target.value })}
              />
            </div>
            <div>
              <Label>Soundcheck End</Label>
              <Input 
                type="time"
                value={formData.soundcheck_end || ""} 
                onChange={(e) => onChange({ soundcheck_end: e.target.value })}
              />
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Checkbox 
            id="after-midnight"
            checked={formData.isaftermidnight}
            onCheckedChange={(checked) => onChange({ isaftermidnight: checked })}
          />
          <Label htmlFor="after-midnight">Show is after midnight</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox 
            id="rider-missing"
            checked={formData.rider_missing}
            onCheckedChange={(checked) => onChange({ rider_missing: checked })}
          />
          <Label htmlFor="rider-missing">Rider is missing</Label>
        </div>
      </div>
    </div>
  );
};
