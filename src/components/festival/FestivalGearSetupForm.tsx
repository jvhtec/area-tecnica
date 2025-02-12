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
import { Switch } from "@/components/ui/switch";
import { WIRELESS_SYSTEMS, IEM_SYSTEMS } from "@/types/festival-equipment";

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
    has_side_fills: false,
    has_drum_fills: false,
    has_dj_booths: false,
    available_cat6_runs: 0,
    available_hma_runs: 0,
    available_coax_runs: 0,
    available_analog_runs: 0,
    available_opticalcon_duo_runs: 0,
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

  const handleFormSubmit = async (values: any) => {
    try {
      const wirelessSystems = values.wireless_systems.map((system: any) => ({
        model: system.model,
        quantity: parseInt(system.quantity) || 0,
        band: system.band || ''
      }));

      const iemSystems = values.iem_systems.map((system: any) => ({
        model: system.model,
        quantity: parseInt(system.quantity) || 0,
        band: system.band || ''
      }));

      const payload = {
        ...values,
        wireless_systems: wirelessSystems,
        iem_systems: iemSystems,
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
    }
  };

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
          <CardTitle>Wireless Systems</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
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

      <Button type="submit" disabled={isLoading} className="w-full">
        <Save className="h-4 w-4 mr-2" />
        {isLoading ? "Saving..." : "Save Setup"}
      </Button>
    </form>
  );
};
