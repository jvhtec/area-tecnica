
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { FestivalGearSetup, ConsoleSetup, WirelessSetup } from "@/types/festival";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Minus, Save } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const consoleOptions = [
  'Yamaha CL5', 'Yamaha PMx', 'DiGiCo SD5', 'DiGiCo SD7', 'DiGiCo SD8', 
  'DiGiCo SD10', 'DiGiCo SD11', 'DiGiCo SD12', 'DiGiCo SD5Q', 'DiGiCo SD7Q',
  'DiGiCo Q225', 'DiGiCo Q326', 'DiGiCo Q338', 'DiGiCo Q852', 'Avid S6L',
  'A&H C1500', 'A&H C2500', 'A&H S3000', 'A&H S5000', 'A&H S7000',
  'Waves LV1 (homemade)', 'Waves LV1 Classic', 'SSL', 'Other'
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
  const [setup, setSetup] = useState<Partial<FestivalGearSetup>>({
    max_stages: 1,
    foh_consoles: [],
    mon_consoles: [],
    wireless_systems: [],
    iem_systems: [],
    available_monitors: 0,
    available_side_fills: 0,
    available_drum_fills: 0,
    available_dj_booths: 0,
    available_cat6_runs: 0,
    available_hma_runs: 0,
    available_coax_runs: 0,
    available_analog_runs: 0,
    available_opticalcon_duo_runs: 0,
    infrastructure_provided_by: 'festival',
    wireless_provided_by: 'festival',
    iem_provided_by: 'festival'
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('festival_gear_setups')
        .upsert({
          ...setup,
          job_id: jobId,
          date: selectedDate
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Festival gear setup has been saved.",
      });

      onSave?.();
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

  const addConsole = (type: 'foh_consoles' | 'mon_consoles') => {
    setSetup(prev => ({
      ...prev,
      [type]: [...(prev[type] || []), { model: '', quantity: 1 }]
    }));
  };

  const removeConsole = (type: 'foh_consoles' | 'mon_consoles', index: number) => {
    setSetup(prev => ({
      ...prev,
      [type]: prev[type]?.filter((_, i) => i !== index)
    }));
  };

  const updateConsole = (
    type: 'foh_consoles' | 'mon_consoles',
    index: number,
    field: keyof ConsoleSetup,
    value: string | number
  ) => {
    setSetup(prev => ({
      ...prev,
      [type]: prev[type]?.map((console, i) =>
        i === index ? { ...console, [field]: value } : console
      )
    }));
  };

  const addWirelessSystem = (type: 'wireless_systems' | 'iem_systems') => {
    setSetup(prev => ({
      ...prev,
      [type]: [...(prev[type] || []), { model: '', quantity: 1, band: '' }]
    }));
  };

  const removeWirelessSystem = (type: 'wireless_systems' | 'iem_systems', index: number) => {
    setSetup(prev => ({
      ...prev,
      [type]: prev[type]?.filter((_, i) => i !== index)
    }));
  };

  const updateWirelessSystem = (
    type: 'wireless_systems' | 'iem_systems',
    index: number,
    field: keyof WirelessSetup,
    value: string | number
  ) => {
    setSetup(prev => ({
      ...prev,
      [type]: prev[type]?.map((system, i) =>
        i === index ? { ...system, [field]: value } : system
      )
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div>
              <Label>FOH Consoles</Label>
              {setup.foh_consoles?.map((console, index) => (
                <div key={index} className="flex gap-2 mt-2">
                  <Select
                    value={console.model}
                    onValueChange={(value) => updateConsole('foh_consoles', index, 'model', value)}
                  >
                    <SelectTrigger className="flex-grow">
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
                  <Input
                    type="number"
                    min="1"
                    value={console.quantity}
                    onChange={(e) => updateConsole('foh_consoles', index, 'quantity', parseInt(e.target.value))}
                    className="w-24"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeConsole('foh_consoles', index)}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() => addConsole('foh_consoles')}
                className="mt-2"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add FOH Console
              </Button>
            </div>

            <div>
              <Label>Monitor Consoles</Label>
              {setup.mon_consoles?.map((console, index) => (
                <div key={index} className="flex gap-2 mt-2">
                  <Select
                    value={console.model}
                    onValueChange={(value) => updateConsole('mon_consoles', index, 'model', value)}
                  >
                    <SelectTrigger className="flex-grow">
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
                  <Input
                    type="number"
                    min="1"
                    value={console.quantity}
                    onChange={(e) => updateConsole('mon_consoles', index, 'quantity', parseInt(e.target.value))}
                    className="w-24"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeConsole('mon_consoles', index)}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() => addConsole('mon_consoles')}
                className="mt-2"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Monitor Console
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Wireless Systems</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Provided By</Label>
              <RadioGroup
                value={setup.wireless_provided_by}
                onValueChange={(value: 'festival' | 'artist') => 
                  setSetup(prev => ({ ...prev, wireless_provided_by: value }))
                }
                className="flex space-x-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="festival" id="wireless-festival" />
                  <Label htmlFor="wireless-festival">Festival</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="artist" id="wireless-artist" />
                  <Label htmlFor="wireless-artist">Artist</Label>
                </div>
              </RadioGroup>
            </div>

            {setup.wireless_systems?.map((system, index) => (
              <div key={index} className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    placeholder="Model"
                    value={system.model}
                    onChange={(e) => updateWirelessSystem('wireless_systems', index, 'model', e.target.value)}
                  />
                  <Input
                    type="number"
                    min="0"
                    placeholder="Quantity"
                    value={system.quantity}
                    onChange={(e) => updateWirelessSystem('wireless_systems', index, 'quantity', parseInt(e.target.value))}
                    className="w-24"
                  />
                  <Input
                    placeholder="Band"
                    value={system.band}
                    onChange={(e) => updateWirelessSystem('wireless_systems', index, 'band', e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeWirelessSystem('wireless_systems', index)}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() => addWirelessSystem('wireless_systems')}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Wireless System
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>IEM Systems</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Provided By</Label>
              <RadioGroup
                value={setup.iem_provided_by}
                onValueChange={(value: 'festival' | 'artist') => 
                  setSetup(prev => ({ ...prev, iem_provided_by: value }))
                }
                className="flex space-x-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="festival" id="iem-festival" />
                  <Label htmlFor="iem-festival">Festival</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="artist" id="iem-artist" />
                  <Label htmlFor="iem-artist">Artist</Label>
                </div>
              </RadioGroup>
            </div>

            {setup.iem_systems?.map((system, index) => (
              <div key={index} className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    placeholder="Model"
                    value={system.model}
                    onChange={(e) => updateWirelessSystem('iem_systems', index, 'model', e.target.value)}
                  />
                  <Input
                    type="number"
                    min="0"
                    placeholder="Quantity"
                    value={system.quantity}
                    onChange={(e) => updateWirelessSystem('iem_systems', index, 'quantity', parseInt(e.target.value))}
                    className="w-24"
                  />
                  <Input
                    placeholder="Band"
                    value={system.band}
                    onChange={(e) => updateWirelessSystem('iem_systems', index, 'band', e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeWirelessSystem('iem_systems', index)}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() => addWirelessSystem('iem_systems')}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add IEM System
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Monitor Setup</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Available Monitors</Label>
            <Input
              type="number"
              min="0"
              value={setup.available_monitors}
              onChange={(e) => setSetup(prev => ({ ...prev, available_monitors: parseInt(e.target.value) }))}
            />
          </div>
          <div>
            <Label>Side Fills (Pairs)</Label>
            <Input
              type="number"
              min="0"
              value={setup.available_side_fills}
              onChange={(e) => setSetup(prev => ({ ...prev, available_side_fills: parseInt(e.target.value) }))}
            />
          </div>
          <div>
            <Label>Drum Fills</Label>
            <Input
              type="number"
              min="0"
              value={setup.available_drum_fills}
              onChange={(e) => setSetup(prev => ({ ...prev, available_drum_fills: parseInt(e.target.value) }))}
            />
          </div>
          <div>
            <Label>DJ Booths</Label>
            <Input
              type="number"
              min="0"
              value={setup.available_dj_booths}
              onChange={(e) => setSetup(prev => ({ ...prev, available_dj_booths: parseInt(e.target.value) }))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Infrastructure</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Provided By</Label>
            <RadioGroup
              value={setup.infrastructure_provided_by}
              onValueChange={(value: 'festival' | 'artist') => 
                setSetup(prev => ({ ...prev, infrastructure_provided_by: value }))
              }
              className="flex space-x-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="festival" id="infrastructure-festival" />
                <Label htmlFor="infrastructure-festival">Festival</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="artist" id="infrastructure-artist" />
                <Label htmlFor="infrastructure-artist">Artist</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>CAT6 Runs</Label>
              <Input
                type="number"
                min="0"
                value={setup.available_cat6_runs}
                onChange={(e) => setSetup(prev => ({ ...prev, available_cat6_runs: parseInt(e.target.value) }))}
              />
            </div>
            <div>
              <Label>HMA Runs</Label>
              <Input
                type="number"
                min="0"
                value={setup.available_hma_runs}
                onChange={(e) => setSetup(prev => ({ ...prev, available_hma_runs: parseInt(e.target.value) }))}
              />
            </div>
            <div>
              <Label>Coax Runs</Label>
              <Input
                type="number"
                min="0"
                value={setup.available_coax_runs}
                onChange={(e) => setSetup(prev => ({ ...prev, available_coax_runs: parseInt(e.target.value) }))}
              />
            </div>
            <div>
              <Label>Analog Runs</Label>
              <Input
                type="number"
                min="0"
                value={setup.available_analog_runs}
                onChange={(e) => setSetup(prev => ({ ...prev, available_analog_runs: parseInt(e.target.value) }))}
              />
            </div>
            <div>
              <Label>Opticalcon DUO Runs</Label>
              <Input
                type="number"
                min="0"
                value={setup.available_opticalcon_duo_runs}
                onChange={(e) => setSetup(prev => ({ ...prev, available_opticalcon_duo_runs: parseInt(e.target.value) }))}
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
            value={setup.notes || ''}
            onChange={(e) => setSetup(prev => ({ ...prev, notes: e.target.value }))}
            placeholder="Add any additional notes about the festival gear setup..."
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
