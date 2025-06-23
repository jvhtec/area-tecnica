
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ArtistSectionProps } from "@/types/artist-form";
import { useEquipmentModels } from "@/hooks/useEquipmentModels";

const consoleOptions = [
  'Yamaha CL5', 'Yamaha PMx', 'Yamaha DM7','Yamaha DM3', 'DiGiCo SD5', 'DiGiCo SD7', 'DiGiCo SD8', 
  'DiGiCo SD10', 'DiGiCo SD11', 'DiGiCo SD12', 'DiGiCo SD5Q', 'DiGiCo SD7Q',
  'DiGiCo Q225', 'DiGiCo Q326', 'DiGiCo Q338', 'DiGiCo Q852', 'Avid S6L',
  'A&H C1500', 'A&H C2500', 'A&H S3000', 'A&H S5000', 'A&H S7000',
  'Waves LV1 (homemade)', 'Waves LV1 Classic', 'SSL', 'Midas HD96', 'Other'
];

export const ConsoleSetupSection = ({ formData, onChange }: ArtistSectionProps) => {
  const { models } = useEquipmentModels();

  // Get console options from database with fallback
  const fohConsoleOptions = models
    .filter(model => model.category === 'foh_console')
    .map(model => model.name);
  const monConsoleOptions = models
    .filter(model => model.category === 'mon_console')
    .map(model => model.name);
    
  const fohOptions = fohConsoleOptions.length > 0 ? fohConsoleOptions : consoleOptions;
  const monOptions = monConsoleOptions.length > 0 ? monConsoleOptions : consoleOptions;

  return (
    <div className="space-y-4 border rounded-lg p-4">
      <h3 className="text-lg font-semibold">Console Setup</h3>
      
      {/* FOH Console */}
      <div className="space-y-4">
        <h4 className="font-medium">FOH Console</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Console Model</Label>
            <Select
              value={formData.foh_console || ""}
              onValueChange={(value) => onChange({ foh_console: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select console" />
              </SelectTrigger>
              <SelectContent>
                {fohOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Provided By</Label>
            <Select
              value={formData.foh_console_provided_by || "festival"}
              onValueChange={(value) => onChange({ foh_console_provided_by: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="festival">Festival</SelectItem>
                <SelectItem value="band">Band</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox 
            id="foh-tech"
            checked={formData.foh_tech}
            onCheckedChange={(checked) => onChange({ foh_tech: checked })}
          />
          <Label htmlFor="foh-tech">FOH Technician Required</Label>
        </div>
      </div>

      {/* Monitor Console */}
      <div className="space-y-4">
        <h4 className="font-medium">Monitor Console</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Console Model</Label>
            <Select
              value={formData.mon_console || ""}
              onValueChange={(value) => onChange({ mon_console: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select console" />
              </SelectTrigger>
              <SelectContent>
                {monOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Provided By</Label>
            <Select
              value={formData.mon_console_provided_by || "festival"}
              onValueChange={(value) => onChange({ mon_console_provided_by: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="festival">Festival</SelectItem>
                <SelectItem value="band">Band</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox 
            id="mon-tech"
            checked={formData.mon_tech}
            onCheckedChange={(checked) => onChange({ mon_tech: checked })}
          />
          <Label htmlFor="mon-tech">Monitor Technician Required</Label>
        </div>
      </div>
    </div>
  );
};
