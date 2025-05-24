
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { WirelessConfig } from "./gear-setup/WirelessConfig";

const consoleOptions = [
  'Yamaha CL5', 'Yamaha PMx', 'Yamaha DM7','Yamaha DM3', 'DiGiCo SD5', 'DiGiCo SD7', 'DiGiCo SD8', 
  'DiGiCo SD10', 'DiGiCo SD11', 'DiGiCo SD12', 'DiGiCo SD5Q', 'DiGiCo SD7Q',
  'DiGiCo Q225', 'DiGiCo Q326', 'DiGiCo Q338', 'DiGiCo Q852', 'Avid S6L',
  'A&H C1500', 'A&H C2500', 'A&H S3000', 'A&H S5000', 'A&H S7000',
  'Waves LV1 (homemade)', 'Waves LV1 Classic', 'SSL', 'Midas HD96', 'Other'
];

interface ArtistManagementFormProps {
  initialData: any;
  onSave: (data: any) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  dayStartTime: string;
}

export const ArtistManagementForm = ({ 
  initialData, 
  onSave, 
  onCancel, 
  isLoading,
  dayStartTime 
}: ArtistManagementFormProps) => {
  const [formData, setFormData] = useState(initialData);

  useEffect(() => {
    setFormData(initialData);
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(formData);
  };

  const updateFormData = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Artist/Band Name</Label>
          <Input
            id="name"
            value={formData.name || ""}
            onChange={(e) => updateFormData("name", e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="stage">Stage</Label>
          <Select value={formData.stage?.toString() || ""} onValueChange={(value) => updateFormData("stage", parseInt(value))}>
            <SelectTrigger>
              <SelectValue placeholder="Select stage" />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5].map((stage) => (
                <SelectItem key={stage} value={stage.toString()}>
                  Stage {stage}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Show Times */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="show_start">Show Start</Label>
          <Input
            id="show_start"
            type="time"
            value={formData.show_start || ""}
            onChange={(e) => updateFormData("show_start", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="show_end">Show End</Label>
          <Input
            id="show_end"
            type="time"
            value={formData.show_end || ""}
            onChange={(e) => updateFormData("show_end", e.target.value)}
          />
        </div>
      </div>

      {/* Soundcheck */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="soundcheck"
            checked={formData.soundcheck || false}
            onCheckedChange={(checked) => updateFormData("soundcheck", checked)}
          />
          <Label htmlFor="soundcheck">Soundcheck Required</Label>
        </div>
        
        {formData.soundcheck && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-6">
            <div className="space-y-2">
              <Label htmlFor="soundcheck_start">Soundcheck Start</Label>
              <Input
                id="soundcheck_start"
                type="time"
                value={formData.soundcheck_start || ""}
                onChange={(e) => updateFormData("soundcheck_start", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="soundcheck_end">Soundcheck End</Label>
              <Input
                id="soundcheck_end"
                type="time"
                value={formData.soundcheck_end || ""}
                onChange={(e) => updateFormData("soundcheck_end", e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Console Setup */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">FOH Console</h3>
          <div className="space-y-2">
            <Label>Console Model</Label>
            <Select
              value={formData.foh_console || ""}
              onValueChange={(value) => updateFormData("foh_console", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select console" />
              </SelectTrigger>
              <SelectContent>
                {consoleOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Provided By</Label>
            <Select
              value={formData.foh_console_provided_by || "festival"}
              onValueChange={(value) => updateFormData("foh_console_provided_by", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="festival">Festival</SelectItem>
                <SelectItem value="artist">Artist</SelectItem>
                <SelectItem value="production">Production</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="foh_tech"
              checked={formData.foh_tech || false}
              onCheckedChange={(checked) => updateFormData("foh_tech", checked)}
            />
            <Label htmlFor="foh_tech">FOH Technician Required</Label>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Monitor Console</h3>
          <div className="space-y-2">
            <Label>Console Model</Label>
            <Select
              value={formData.mon_console || ""}
              onValueChange={(value) => updateFormData("mon_console", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select console" />
              </SelectTrigger>
              <SelectContent>
                {consoleOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Provided By</Label>
            <Select
              value={formData.mon_console_provided_by || "festival"}
              onValueChange={(value) => updateFormData("mon_console_provided_by", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="festival">Festival</SelectItem>
                <SelectItem value="artist">Artist</SelectItem>
                <SelectItem value="production">Production</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="mon_tech"
              checked={formData.mon_tech || false}
              onCheckedChange={(checked) => updateFormData("mon_tech", checked)}
            />
            <Label htmlFor="mon_tech">Monitor Technician Required</Label>
          </div>
        </div>
      </div>

      {/* Wireless Setup */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">RF & Wireless Setup</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <WirelessConfig
              systems={formData.wireless_systems || []}
              onChange={(systems) => updateFormData("wireless_systems", systems)}
              label="Wireless Systems"
              includeQuantityTypes={true}
            />
            <div className="space-y-2">
              <Label>Provided By</Label>
              <Select
                value={formData.wireless_provided_by || "festival"}
                onValueChange={(value) => updateFormData("wireless_provided_by", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="festival">Festival</SelectItem>
                  <SelectItem value="artist">Artist</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-4">
            <WirelessConfig
              systems={formData.iem_systems || []}
              onChange={(systems) => updateFormData("iem_systems", systems)}
              label="IEM Systems"
              includeQuantityTypes={true}
              isIEM={true}
            />
            <div className="space-y-2">
              <Label>Provided By</Label>
              <Select
                value={formData.iem_provided_by || "festival"}
                onValueChange={(value) => updateFormData("iem_provided_by", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="festival">Festival</SelectItem>
                  <SelectItem value="artist">Artist</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Monitors */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="monitors_enabled"
            checked={formData.monitors_enabled || false}
            onCheckedChange={(checked) => updateFormData("monitors_enabled", checked)}
          />
          <Label htmlFor="monitors_enabled">Stage Monitors Required</Label>
        </div>
        
        {formData.monitors_enabled && (
          <div className="space-y-2 ml-6">
            <Label htmlFor="monitors_quantity">Number of Monitors</Label>
            <Input
              id="monitors_quantity"
              type="number"
              min="0"
              value={formData.monitors_quantity || 0}
              onChange={(e) => updateFormData("monitors_quantity", parseInt(e.target.value) || 0)}
            />
          </div>
        )}
      </div>

      {/* Extras */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Additional Requirements</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="extras_sf"
              checked={formData.extras_sf || false}
              onCheckedChange={(checked) => updateFormData("extras_sf", checked)}
            />
            <Label htmlFor="extras_sf">Side Fills</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="extras_df"
              checked={formData.extras_df || false}
              onCheckedChange={(checked) => updateFormData("extras_df", checked)}
            />
            <Label htmlFor="extras_df">Drum Fills</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="extras_djbooth"
              checked={formData.extras_djbooth || false}
              onCheckedChange={(checked) => updateFormData("extras_djbooth", checked)}
            />
            <Label htmlFor="extras_djbooth">DJ Booth</Label>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="extras_wired">Additional Wired Requirements</Label>
          <Input
            id="extras_wired"
            value={formData.extras_wired || ""}
            onChange={(e) => updateFormData("extras_wired", e.target.value)}
            placeholder="Describe any additional wired requirements"
          />
        </div>
      </div>

      {/* Infrastructure */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Infrastructure Requirements</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="infra_cat6"
                checked={formData.infra_cat6 || false}
                onCheckedChange={(checked) => updateFormData("infra_cat6", checked)}
              />
              <Label htmlFor="infra_cat6">CAT6 Lines</Label>
            </div>
            {formData.infra_cat6 && (
              <Input
                type="number"
                min="0"
                value={formData.infra_cat6_quantity || 0}
                onChange={(e) => updateFormData("infra_cat6_quantity", parseInt(e.target.value) || 0)}
                placeholder="Quantity"
                className="ml-6"
              />
            )}
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="infra_hma"
                checked={formData.infra_hma || false}
                onCheckedChange={(checked) => updateFormData("infra_hma", checked)}
              />
              <Label htmlFor="infra_hma">HMA Lines</Label>
            </div>
            {formData.infra_hma && (
              <Input
                type="number"
                min="0"
                value={formData.infra_hma_quantity || 0}
                onChange={(e) => updateFormData("infra_hma_quantity", parseInt(e.target.value) || 0)}
                placeholder="Quantity"
                className="ml-6"
              />
            )}
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="infra_coax"
                checked={formData.infra_coax || false}
                onCheckedChange={(checked) => updateFormData("infra_coax", checked)}
              />
              <Label htmlFor="infra_coax">Coax Lines</Label>
            </div>
            {formData.infra_coax && (
              <Input
                type="number"
                min="0"
                value={formData.infra_coax_quantity || 0}
                onChange={(e) => updateFormData("infra_coax_quantity", parseInt(e.target.value) || 0)}
                placeholder="Quantity"
                className="ml-6"
              />
            )}
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="infra_opticalcon_duo"
                checked={formData.infra_opticalcon_duo || false}
                onCheckedChange={(checked) => updateFormData("infra_opticalcon_duo", checked)}
              />
              <Label htmlFor="infra_opticalcon_duo">OpticalCON DUO</Label>
            </div>
            {formData.infra_opticalcon_duo && (
              <Input
                type="number"
                min="0"
                value={formData.infra_opticalcon_duo_quantity || 0}
                onChange={(e) => updateFormData("infra_opticalcon_duo_quantity", parseInt(e.target.value) || 0)}
                placeholder="Quantity"
                className="ml-6"
              />
            )}
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="infra_analog">Analog Lines</Label>
          <Input
            id="infra_analog"
            type="number"
            min="0"
            value={formData.infra_analog || 0}
            onChange={(e) => updateFormData("infra_analog", parseInt(e.target.value) || 0)}
          />
        </div>
        
        <div className="space-y-2">
          <Label>Infrastructure Provided By</Label>
          <Select
            value={formData.infrastructure_provided_by || "festival"}
            onValueChange={(value) => updateFormData("infrastructure_provided_by", value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="festival">Festival</SelectItem>
              <SelectItem value="artist">Artist</SelectItem>
              <SelectItem value="production">Production</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="other_infrastructure">Other Infrastructure</Label>
          <Textarea
            id="other_infrastructure"
            value={formData.other_infrastructure || ""}
            onChange={(e) => updateFormData("other_infrastructure", e.target.value)}
            placeholder="Describe any other infrastructure requirements"
          />
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">Additional Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes || ""}
          onChange={(e) => updateFormData("notes", e.target.value)}
          placeholder="Any additional requirements or comments"
        />
      </div>

      {/* After Midnight Toggle */}
      <div className="flex items-center space-x-2">
        <Checkbox
          id="isaftermidnight"
          checked={formData.isaftermidnight || false}
          onCheckedChange={(checked) => updateFormData("isaftermidnight", checked)}
        />
        <Label htmlFor="isaftermidnight">Show is after midnight (next day)</Label>
      </div>

      {/* Form Actions */}
      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Saving..." : "Save Artist"}
        </Button>
      </div>
    </form>
  );
};
