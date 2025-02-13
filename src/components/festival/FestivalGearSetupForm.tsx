
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save } from "lucide-react";
import { GearSetupFormData } from "@/types/festival-gear";

const consoleOptions = [
  'Yamaha CL5', 'Yamaha PMx', 'DiGiCo SD5', 'DiGiCo SD7', 'DiGiCo SD8', 
  'DiGiCo SD10', 'DiGiCo SD11', 'DiGiCo SD12', 'DiGiCo SD5Q', 'DiGiCo SD7Q',
  'DiGiCo Q225', 'DiGiCo Q326', 'DiGiCo Q338', 'DiGiCo Q852', 'Avid S6L',
  'A&H C1500', 'A&H C2500', 'A&H S3000', 'A&H S5000', 'A&H S7000',
  'Waves LV1 (homemade)', 'Waves LV1 Classic', 'SSL', 'Other'
];

const wirelessOptions = [
  'Shure AD Series', 'Shure AXT Series', 'Shure UR Series', 'Shure ULX Series',
  'Shure QLX Series', 'Sennheiser 2000 Series', 'Sennheiser EW500 Series',
  'Sennheiser EW300 Series', 'Sennheiser EW100 Series', 'Other'
];

const iemOptions = [
  'Shure Digital PSM Series', 'Shure PSM1000 Series', 'Shure PSM900 Series',
  'Shure PSM300 Series', 'Sennheiser 2000 series', 'Sennheiser 300 G4 Series',
  'Sennheiser 300 G3 Series', 'Wysicom MTK', 'Other'
];

interface FestivalGearSetupFormProps {
  jobId: string;
  selectedDate: string;
  onSave?: () => void;
}

export const FestivalGearSetupForm = ({
  jobId,
  selectedDate,
  onSave
}: FestivalGearSetupFormProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [setup, setSetup] = useState<GearSetupFormData>({
    max_stages: 1,
    foh_console: "",
    foh_console_provided_by: "festival",
    mon_console: "",
    mon_console_provided_by: "festival",
    wireless_model: "",
    wireless_provided_by: "festival",
    wireless_quantity_hh: 0,
    wireless_quantity_bp: 0,
    wireless_band: "",
    iem_model: "",
    iem_provided_by: "festival",
    iem_quantity: 0,
    iem_band: "",
    monitors_enabled: false,
    monitors_quantity: 0,
    extras_sf: false,
    extras_df: false,
    extras_djbooth: false,
    extras_wired: "",
    infra_cat6: false,
    infra_cat6_quantity: 0,
    infra_hma: false,
    infra_hma_quantity: 0,
    infra_coax: false,
    infra_coax_quantity: 0,
    infra_opticalcon_duo: false,
    infra_opticalcon_duo_quantity: 0,
    infra_analog: 0,
    infrastructure_provided_by: "festival",
    other_infrastructure: "",
    notes: "",
  });

  useEffect(() => {
    const fetchExistingSetup = async () => {
      try {
        const { data, error } = await supabase
          .from('festival_gear_setups')
          .select('*')
          .eq('job_id', jobId)
          .eq('date', selectedDate)
          .maybeSingle();

        if (error) throw error;
        if (data) {
          setSetup(data);
        }
      } catch (error) {
        console.error('Error fetching festival gear setup:', error);
      }
    };

    fetchExistingSetup();
  }, [jobId, selectedDate]);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const payload = {
        ...setup,
        job_id: jobId,
        date: selectedDate,
      };

      await supabase
        .from('festival_gear_setups')
        .upsert(payload);

      onSave?.();
      toast({
        title: "Success",
        description: "Festival gear setup has been saved.",
      });
    } catch (error) {
      console.error('Error saving festival gear setup:', error);
      toast({
        title: "Error",
        description: "Failed to save festival gear setup.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const ProviderRadioGroup = ({ value, onChange, label }: { value: string, onChange: (value: string) => void, label: string }) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <RadioGroup
        value={value}
        onValueChange={onChange}
        className="flex space-x-4"
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="festival" id={`${label}-festival`} />
          <Label htmlFor={`${label}-festival`}>Festival</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="band" id={`${label}-band`} />
          <Label htmlFor={`${label}-band`}>Band</Label>
        </div>
      </RadioGroup>
    </div>
  );

  return (
    <form onSubmit={handleFormSubmit} className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Basic Setup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Number of Stages</Label>
            <Input
              type="number"
              min="1"
              value={setup.max_stages}
              onChange={(e) => setSetup(prev => ({ ...prev, max_stages: parseInt(e.target.value) }))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Console Setup</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-6">
          {/* FOH Console */}
          <div className="space-y-4">
            <ProviderRadioGroup
              value={setup.foh_console_provided_by}
              onChange={(value) => setSetup(prev => ({ ...prev, foh_console_provided_by: value as 'festival' | 'band' }))}
              label="FOH Console"
            />
            <Select
              value={setup.foh_console}
              onValueChange={(value) => setSetup(prev => ({ ...prev, foh_console: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select FOH console" />
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

          {/* Monitor Console */}
          <div className="space-y-4">
            <ProviderRadioGroup
              value={setup.mon_console_provided_by}
              onChange={(value) => setSetup(prev => ({ ...prev, mon_console_provided_by: value as 'festival' | 'band' }))}
              label="Monitor Console"
            />
            <Select
              value={setup.mon_console}
              onValueChange={(value) => setSetup(prev => ({ ...prev, mon_console: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select monitor console" />
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>RF & Wireless Setup</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-6">
          {/* Wireless Systems */}
          <div className="space-y-4">
            <ProviderRadioGroup
              value={setup.wireless_provided_by}
              onChange={(value) => setSetup(prev => ({ ...prev, wireless_provided_by: value as 'festival' | 'band' }))}
              label="Wireless Systems"
            />
            <Select
              value={setup.wireless_model}
              onValueChange={(value) => setSetup(prev => ({ ...prev, wireless_model: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select wireless system" />
              </SelectTrigger>
              <SelectContent>
                {wirelessOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Handheld Qty</Label>
                <Input
                  type="number"
                  min="0"
                  value={setup.wireless_quantity_hh}
                  onChange={(e) => setSetup(prev => ({ ...prev, wireless_quantity_hh: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div>
                <Label>Bodypack Qty</Label>
                <Input
                  type="number"
                  min="0"
                  value={setup.wireless_quantity_bp}
                  onChange={(e) => setSetup(prev => ({ ...prev, wireless_quantity_bp: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>
            <div>
              <Label>Frequency Band</Label>
              <Input
                value={setup.wireless_band}
                onChange={(e) => setSetup(prev => ({ ...prev, wireless_band: e.target.value }))}
                placeholder="e.g., G50, H50"
              />
            </div>
          </div>

          {/* IEM Systems */}
          <div className="space-y-4">
            <ProviderRadioGroup
              value={setup.iem_provided_by}
              onChange={(value) => setSetup(prev => ({ ...prev, iem_provided_by: value as 'festival' | 'band' }))}
              label="IEM Systems"
            />
            <Select
              value={setup.iem_model}
              onValueChange={(value) => setSetup(prev => ({ ...prev, iem_model: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select IEM system" />
              </SelectTrigger>
              <SelectContent>
                {iemOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div>
              <Label>Quantity</Label>
              <Input
                type="number"
                min="0"
                value={setup.iem_quantity}
                onChange={(e) => setSetup(prev => ({ ...prev, iem_quantity: parseInt(e.target.value) || 0 }))}
              />
            </div>
            <div>
              <Label>Frequency Band</Label>
              <Input
                value={setup.iem_band}
                onChange={(e) => setSetup(prev => ({ ...prev, iem_band: e.target.value }))}
                placeholder="e.g., G50, H50"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Monitor Setup</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Enable Stage Monitors</Label>
              <Switch
                checked={setup.monitors_enabled}
                onCheckedChange={(checked) => setSetup(prev => ({ 
                  ...prev, 
                  monitors_enabled: checked,
                  monitors_quantity: checked ? 1 : 0
                }))}
              />
            </div>
            {setup.monitors_enabled && (
              <div>
                <Label>Number of Monitors</Label>
                <Input
                  type="number"
                  min="1"
                  value={setup.monitors_quantity}
                  onChange={(e) => setSetup(prev => ({ ...prev, monitors_quantity: parseInt(e.target.value) || 0 }))}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Extra Requirements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={setup.extras_sf}
                  onCheckedChange={(checked) => setSetup(prev => ({ ...prev, extras_sf: checked }))}
                />
                <Label>Side Fill</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={setup.extras_df}
                  onCheckedChange={(checked) => setSetup(prev => ({ ...prev, extras_df: checked }))}
                />
                <Label>Drum Fill</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={setup.extras_djbooth}
                  onCheckedChange={(checked) => setSetup(prev => ({ ...prev, extras_djbooth: checked }))}
                />
                <Label>DJ Booth</Label>
              </div>
            </div>
            <div>
              <Label>Additional Wired Requirements</Label>
              <Input
                value={setup.extras_wired}
                onChange={(e) => setSetup(prev => ({ ...prev, extras_wired: e.target.value }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Infrastructure</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <ProviderRadioGroup
              value={setup.infrastructure_provided_by}
              onChange={(value) => setSetup(prev => ({ ...prev, infrastructure_provided_by: value as 'festival' | 'band' }))}
              label="Infrastructure Provided By"
            />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={setup.infra_cat6}
                      onCheckedChange={(checked) => setSetup(prev => ({
                        ...prev,
                        infra_cat6: checked,
                        infra_cat6_quantity: checked ? 1 : 0
                      }))}
                    />
                    <Label>CAT6</Label>
                  </div>
                  {setup.infra_cat6 && (
                    <Input
                      type="number"
                      min="1"
                      className="w-24"
                      value={setup.infra_cat6_quantity}
                      onChange={(e) => setSetup(prev => ({ ...prev, infra_cat6_quantity: parseInt(e.target.value) || 0 }))}
                    />
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={setup.infra_hma}
                      onCheckedChange={(checked) => setSetup(prev => ({
                        ...prev,
                        infra_hma: checked,
                        infra_hma_quantity: checked ? 1 : 0
                      }))}
                    />
                    <Label>HMA</Label>
                  </div>
                  {setup.infra_hma && (
                    <Input
                      type="number"
                      min="1"
                      className="w-24"
                      value={setup.infra_hma_quantity}
                      onChange={(e) => setSetup(prev => ({ ...prev, infra_hma_quantity: parseInt(e.target.value) || 0 }))}
                    />
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={setup.infra_coax}
                      onCheckedChange={(checked) => setSetup(prev => ({
                        ...prev,
                        infra_coax: checked,
                        infra_coax_quantity: checked ? 1 : 0
                      }))}
                    />
                    <Label>Coax</Label>
                  </div>
                  {setup.infra_coax && (
                    <Input
                      type="number"
                      min="1"
                      className="w-24"
                      value={setup.infra_coax_quantity}
                      onChange={(e) => setSetup(prev => ({ ...prev, infra_coax_quantity: parseInt(e.target.value) || 0 }))}
                    />
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={setup.infra_opticalcon_duo}
                      onCheckedChange={(checked) => setSetup(prev => ({
                        ...prev,
                        infra_opticalcon_duo: checked,
                        infra_opticalcon_duo_quantity: checked ? 1 : 0
                      }))}
                    />
                    <Label>OpticalCon Duo</Label>
                  </div>
                  {setup.infra_opticalcon_duo && (
                    <Input
                      type="number"
                      min="1"
                      className="w-24"
                      value={setup.infra_opticalcon_duo_quantity}
                      onChange={(e) => setSetup(prev => ({ ...prev, infra_opticalcon_duo_quantity: parseInt(e.target.value) || 0 }))}
                    />
                  )}
                </div>
              </div>

              <div>
                <Label>Analog Lines</Label>
                <Input
                  type="number"
                  min="0"
                  value={setup.infra_analog}
                  onChange={(e) => setSetup(prev => ({ ...prev, infra_analog: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>
            <div>
              <Label>Other Infrastructure</Label>
              <Input
                value={setup.other_infrastructure}
                onChange={(e) => setSetup(prev => ({ ...prev, other_infrastructure: e.target.value }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Additional Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={setup.notes}
            onChange={(e) => setSetup(prev => ({ ...prev, notes: e.target.value }))}
            placeholder="Enter any additional notes about the gear setup..."
          />
        </CardContent>
      </Card>

      <Button type="submit" disabled={isLoading} className="w-full">
        <Save className="h-4 w-4 mr-2" />
        {isLoading ? "Saving..." : "Save Setup"}
      </Button>
    </form>
  );
};
