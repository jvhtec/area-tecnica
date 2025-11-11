
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArtistSectionProps } from "@/types/artist-form";

export const BasicInfoSection = ({ formData, onChange, gearSetup }: ArtistSectionProps) => {
  // Get max stages from gearSetup or default to 3
  const maxStages = gearSetup?.max_stages || 3;

  return (
    <div className="space-y-4 border rounded-lg p-4">
      <h3 className="text-lg font-semibold">Información Básica</h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Nombre del Artista/Banda</Label>
          <Input
            value={formData.name || ""}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Ingrese el nombre del artista"
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
              {Array.from({ length: maxStages }, (_, i) => (
                <SelectItem key={i + 1} value={(i + 1).toString()}>
                  Stage {i + 1}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Fecha</Label>
        <Input
          type="date"
          value={formData.date || ""}
          onChange={(e) => onChange({ date: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Inicio del Show</Label>
          <Input
            type="time"
            value={formData.show_start || ""}
            onChange={(e) => onChange({ show_start: e.target.value })}
          />
        </div>
        <div>
          <Label>Fin del Show</Label>
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
          <Label htmlFor="soundcheck">Requiere Soundcheck</Label>
        </div>

        {formData.soundcheck && (
          <div className="grid grid-cols-2 gap-4 ml-6">
            <div>
              <Label>Inicio del Soundcheck</Label>
              <Input
                type="time"
                value={formData.soundcheck_start || ""}
                onChange={(e) => onChange({ soundcheck_start: e.target.value })}
              />
            </div>
            <div>
              <Label>Fin del Soundcheck</Label>
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
          <Label htmlFor="after-midnight">El show es después de medianoche</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="rider-missing"
            checked={formData.rider_missing}
            onCheckedChange={(checked) => onChange({ rider_missing: checked })}
          />
          <Label htmlFor="rider-missing">El rider está faltando</Label>
        </div>
      </div>
    </div>
  );
};
