
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { StageEquipmentConfigProps } from "@/types/festival-gear";

export const StageEquipmentConfig = ({ data, onChange }: StageEquipmentConfigProps) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Equipamiento de Stage</h3>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="available-monitors">Monitores Disponibles</Label>
          <Input
            id="available-monitors"
            type="number"
            min="0"
            value={data.monitors_quantity}
            onChange={(e) => onChange({ monitors_quantity: parseInt(e.target.value) || 0 })}
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="side-fills">Side Fills Disponibles</Label>
            <Switch
              id="side-fills"
              checked={data.extras_sf}
              onCheckedChange={(checked) => onChange({ extras_sf: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="drum-fills">Drum Fills Disponibles</Label>
            <Switch
              id="drum-fills"
              checked={data.extras_df}
              onCheckedChange={(checked) => onChange({ extras_df: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="dj-booths">Cabinas de DJ Disponibles</Label>
            <Switch
              id="dj-booths"
              checked={data.extras_djbooth}
              onCheckedChange={(checked) => onChange({ extras_djbooth: checked })}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
