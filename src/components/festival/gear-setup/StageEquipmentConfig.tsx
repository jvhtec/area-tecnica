
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { StageEquipmentConfigProps } from "@/types/festival-gear";

export const StageEquipmentConfig = ({ data, onChange }: StageEquipmentConfigProps) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Stage Equipment</h3>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="available-monitors">Available Monitors</Label>
          <Input
            id="available-monitors"
            type="number"
            min="0"
            value={data.available_monitors}
            onChange={(e) => onChange({ available_monitors: parseInt(e.target.value) || 0 })}
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="side-fills">Side Fills Available</Label>
            <Switch
              id="side-fills"
              checked={data.has_side_fills}
              onCheckedChange={(checked) => onChange({ has_side_fills: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="drum-fills">Drum Fills Available</Label>
            <Switch
              id="drum-fills"
              checked={data.has_drum_fills}
              onCheckedChange={(checked) => onChange({ has_drum_fills: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="dj-booths">DJ Booths Available</Label>
            <Switch
              id="dj-booths"
              checked={data.has_dj_booths}
              onCheckedChange={(checked) => onChange({ has_dj_booths: checked })}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
