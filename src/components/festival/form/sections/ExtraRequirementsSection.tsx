
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SectionProps } from "@/types/festival-form";

export const ExtraRequirementsSection = ({ formData, onChange, gearSetup }: SectionProps) => {
  return (
    <div className="space-y-4 border rounded-lg p-4">
      <h3 className="text-lg font-semibold">Extra Requirements</h3>
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h4 className="font-medium">Side Fill</h4>
            {formData.extras_sf === false && (
              <Badge variant="secondary">Not Available</Badge>
            )}
          </div>
          <RadioGroup
            value={formData.extras_sf ? "yes" : "no"}
            onValueChange={(value) => 
              onChange({ extras_sf: value === "yes" })
            }
            className="flex flex-col space-y-1"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yes" id="sf-yes" />
              <Label htmlFor="sf-yes">Yes</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no" id="sf-no" />
              <Label htmlFor="sf-no">No</Label>
            </div>
          </RadioGroup>
        </div>
        
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h4 className="font-medium">Drum Fill</h4>
            {formData.extras_df === false && (
              <Badge variant="secondary">Not Available</Badge>
            )}
          </div>
          <RadioGroup
            value={formData.extras_df ? "yes" : "no"}
            onValueChange={(value) => 
              onChange({ extras_df: value === "yes" })
            }
            className="flex flex-col space-y-1"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yes" id="df-yes" />
              <Label htmlFor="df-yes">Yes</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no" id="df-no" />
              <Label htmlFor="df-no">No</Label>
            </div>
          </RadioGroup>
        </div>
        
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h4 className="font-medium">DJ Booth</h4>
            {formData.extras_djbooth === false && (
              <Badge variant="secondary">Not Available</Badge>
            )}
          </div>
          <RadioGroup
            value={formData.extras_djbooth ? "yes" : "no"}
            onValueChange={(value) => 
              onChange({ extras_djbooth: value === "yes" })
            }
            className="flex flex-col space-y-1"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yes" id="djbooth-yes" />
              <Label htmlFor="djbooth-yes">Yes</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no" id="djbooth-no" />
              <Label htmlFor="djbooth-no">No</Label>
            </div>
          </RadioGroup>
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
