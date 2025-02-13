
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { FestivalGearSetup } from "@/types/festival";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save } from "lucide-react";
import { ConsoleConfig } from "./gear-setup/ConsoleConfig";
import { InfrastructureConfig } from "./gear-setup/InfrastructureConfig";
import { StageEquipmentConfig } from "./gear-setup/StageEquipmentConfig";
import { GearSetupFormData } from "@/types/festival-gear";

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
        <CardContent className="space-y-6">
          <ConsoleConfig
            consoles={setup.foh_consoles}
            onChange={(consoles) => setSetup(prev => ({ ...prev, foh_consoles: consoles }))}
            label="FOH Consoles"
          />
          <ConsoleConfig
            consoles={setup.mon_consoles}
            onChange={(consoles) => setSetup(prev => ({ ...prev, mon_consoles: consoles }))}
            label="Monitor Consoles"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Wireless Systems</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <ConsoleConfig
            consoles={setup.wireless_systems}
            onChange={(systems) => setSetup(prev => ({ ...prev, wireless_systems: systems }))}
            label="Wireless Systems"
          />
          <ConsoleConfig
            consoles={setup.iem_systems}
            onChange={(systems) => setSetup(prev => ({ ...prev, iem_systems: systems }))}
            label="IEM Systems"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stage Equipment</CardTitle>
        </CardHeader>
        <CardContent>
          <StageEquipmentConfig
            data={{
              available_monitors: setup.available_monitors,
              has_side_fills: setup.has_side_fills,
              has_drum_fills: setup.has_drum_fills,
              has_dj_booths: setup.has_dj_booths
            }}
            onChange={(changes) => setSetup(prev => ({ ...prev, ...changes }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Infrastructure</CardTitle>
        </CardHeader>
        <CardContent>
          <InfrastructureConfig
            data={{
              available_cat6_runs: setup.available_cat6_runs,
              available_hma_runs: setup.available_hma_runs,
              available_coax_runs: setup.available_coax_runs,
              available_analog_runs: setup.available_analog_runs,
              available_opticalcon_duo_runs: setup.available_opticalcon_duo_runs
            }}
            onChange={(changes) => setSetup(prev => ({ ...prev, ...changes }))}
          />
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
