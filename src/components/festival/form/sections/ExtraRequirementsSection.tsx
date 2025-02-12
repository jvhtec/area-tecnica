
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SectionProps } from "@/types/festival-form";

export const ExtraRequirementsSection = ({ formData, onChange, gearSetup }: SectionProps) => {
  return (
    <div className="space-y-4 border rounded-lg p-4">
      <h3 className="text-lg font-semibold">Extra Requirements</h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center space-x-2">
          <Switch
            id="extras-sf"
            checked={formData.extras_sf}
            onCheckedChange={(checked) => 
              onChange({ extras_sf: checked })
            }
            disabled={!gearSetup?.has_side_fills}
          />
          <Label htmlFor="extras-sf">Side Fill</Label>
          {!gearSetup?.has_side_fills && (
            <Badge variant="secondary">Not Available</Badge>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <Switch
            id="extras-df"
            checked={formData.extras_df}
            onCheckedChange={(checked) => 
              onChange({ extras_df: checked })
            }
            disabled={!gearSetup?.has_drum_fills}
          />
          <Label htmlFor="extras-df">Drum Fill</Label>
          {!gearSetup?.has_drum_fills && (
            <Badge variant="secondary">Not Available</Badge>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <Switch
            id="extras-djbooth"
            checked={formData.extras_djbooth}
            onCheckedChange={(checked) => 
              onChange({ extras_djbooth: checked })
            }
            disabled={!gearSetup?.has_dj_booths}
          />
          <Label htmlFor="extras-djbooth">DJ Booth</Label>
          {!gearSetup?.has_dj_booths && (
            <Badge variant="secondary">Not Available</Badge>
          )}
        </div>
      </div>
      <div>
        <Label htmlFor="extras-wired">Additional Wired Requirements</Label>
        <Input
          id="extras-wired"
          value={formData.extras_wired || ''}
          onChange={(e) => onChange({ extras_wired: e.target.value })}
        />
      </div>
    </div>
  );
};
