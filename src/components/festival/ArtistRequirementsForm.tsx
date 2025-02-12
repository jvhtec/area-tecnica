import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { FestivalGearSetup, ArtistFormData } from "@/types/festival";
import { Badge } from "@/components/ui/badge";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

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

export const ArtistRequirementsForm = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [gearSetup, setGearSetup] = useState<FestivalGearSetup | null>(null);
  const [formData, setFormData] = useState<Partial<ArtistFormData>>({});
  
  useEffect(() => {
    const fetchFormData = async () => {
      if (!token) return;
      
      try {
        // Get artist ID and form status from token
        const { data: formInfo, error: formError } = await supabase
          .from('festival_artist_forms')
          .select('artist_id, status')
          .eq('token', token)
          .single();

        if (formError) throw formError;
        if (formInfo.status === 'completed') {
          toast({
            title: "Form Already Submitted",
            description: "This form has already been completed.",
            variant: "destructive"
          });
          return;
        }

        // Get artist data
        const { data: artistData, error: artistError } = await supabase
          .from('festival_artists')
          .select('*, jobs!inner(*)')
          .eq('id', formInfo.artist_id)
          .single();

        if (artistError) throw artistError;

        // Get festival gear setup
        const { data: gearSetupData, error: gearError } = await supabase
          .from('festival_gear_setups')
          .select('*')
          .eq('job_id', artistData.job_id)
          .eq('date', artistData.date)
          .single();

        if (gearError) throw gearError;

        setGearSetup(gearSetupData);
        setFormData({
          name: artistData.name,
          stage: artistData.stage,
          date: artistData.date,
          show_start: artistData.show_start,
          show_end: artistData.show_end,
          soundcheck: artistData.soundcheck,
          soundcheck_start: artistData.soundcheck_start,
          soundcheck_end: artistData.soundcheck_end,
        });
      } catch (error: any) {
        console.error('Error fetching form data:', error);
        toast({
          title: "Error",
          description: "Could not load form data. Please try again later.",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchFormData();
  }, [token, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !formData) return;

    setIsLoading(true);
    try {
      // Get artist ID from token
      const { data: formInfo, error: formError } = await supabase
        .from('festival_artist_forms')
        .select('artist_id')
        .eq('token', token)
        .single();

      if (formError) throw formError;

      // Update artist data
      const { error: updateError } = await supabase
        .from('festival_artists')
        .update({
          foh_console: formData.foh_console,
          foh_console_provided_by: formData.foh_console_provided_by,
          mon_console: formData.mon_console,
          mon_console_provided_by: formData.mon_console_provided_by,
          wireless_model: formData.wireless_model,
          wireless_provided_by: formData.wireless_provided_by,
          wireless_quantity_hh: formData.wireless_quantity_hh,
          wireless_quantity_bp: formData.wireless_quantity_bp,
          wireless_band: formData.wireless_band,
          iem_model: formData.iem_model,
          iem_provided_by: formData.iem_provided_by,
          iem_quantity: formData.iem_quantity,
          iem_band: formData.iem_band,
          monitors_enabled: formData.monitors_enabled,
          monitors_quantity: formData.monitors_quantity,
          extras_sf: formData.extras_sf,
          extras_df: formData.extras_df,
          extras_djbooth: formData.extras_djbooth,
          extras_wired: formData.extras_wired,
          infra_cat6: formData.infra_cat6,
          infra_cat6_quantity: formData.infra_cat6_quantity,
          infra_hma: formData.infra_hma,
          infra_hma_quantity: formData.infra_hma_quantity,
          infra_coax: formData.infra_coax,
          infra_coax_quantity: formData.infra_coax_quantity,
          infra_opticalcon_duo: formData.infra_opticalcon_duo,
          infra_opticalcon_duo_quantity: formData.infra_opticalcon_duo_quantity,
          infra_analog: formData.infra_analog,
          infrastructure_provided_by: formData.infrastructure_provided_by,
          other_infrastructure: formData.other_infrastructure,
          notes: formData.notes
        })
        .eq('id', formInfo.artist_id);

      if (updateError) throw updateError;

      // Mark form as completed
      const { error: completionError } = await supabase
        .from('festival_artist_forms')
        .update({ status: 'completed' })
        .eq('token', token);

      if (completionError) throw completionError;

      toast({
        title: "Success",
        description: "Your technical requirements have been submitted successfully.",
      });

      // Redirect to success page
      navigate('/festival/form-submitted');
    } catch (error: any) {
      console.error('Error submitting form:', error);
      toast({
        title: "Error",
        description: "Could not submit form. Please try again later.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const validateFestivalEquipment = (section: string, value: number): boolean => {
    if (!gearSetup) return true;
    
    switch (section) {
      case 'monitors':
        return value <= gearSetup.available_monitors;
      case 'cat6':
        return value <= gearSetup.available_cat6_runs;
      case 'hma':
        return value <= gearSetup.available_hma_runs;
      case 'coax':
        return value <= gearSetup.available_coax_runs;
      case 'opticalcon':
        return value <= gearSetup.available_opticalcon_duo_runs;
      case 'analog':
        return value <= gearSetup.available_analog_runs;
      default:
        return true;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Artist Technical Requirements Form</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Read-only Information */}
            <div className="space-y-4">
              <div>
                <Label>Artist/Band Name</Label>
                <Input value={formData.name} readOnly className="bg-muted" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Stage</Label>
                  <Input value={formData.stage} readOnly className="bg-muted" />
                </div>
                <div>
                  <Label>Date</Label>
                  <Input value={formData.date} readOnly className="bg-muted" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Show Start</Label>
                  <Input value={formData.show_start} readOnly className="bg-muted" />
                </div>
                <div>
                  <Label>Show End</Label>
                  <Input value={formData.show_end} readOnly className="bg-muted" />
                </div>
              </div>
              {formData.soundcheck && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Soundcheck Start</Label>
                    <Input value={formData.soundcheck_start} readOnly className="bg-muted" />
                  </div>
                  <div>
                    <Label>Soundcheck End</Label>
                    <Input value={formData.soundcheck_end} readOnly className="bg-muted" />
                  </div>
                </div>
              )}
            </div>

            {/* Console Setup Section */}
            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="text-lg font-semibold">Console Setup</h3>
              <div className="grid grid-cols-2 gap-6">
                {/* FOH Console */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">FOH Console</h4>
                    <RadioGroup
                      value={formData.foh_console_provided_by || 'festival'}
                      onValueChange={(value: 'festival' | 'band') => 
                        setFormData(prev => ({ ...prev, foh_console_provided_by: value }))
                      }
                      className="flex space-x-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="festival" id="foh-festival" />
                        <Label htmlFor="foh-festival">Festival</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="band" id="foh-band" />
                        <Label htmlFor="foh-band">Band</Label>
                      </div>
                    </RadioGroup>
                  </div>
                  
                  {formData.foh_console_provided_by === 'festival' ? (
                    <Select
                      value={formData.foh_console}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, foh_console: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select console" />
                      </SelectTrigger>
                      <SelectContent>
                        {gearSetup?.foh_consoles.map((console) => (
                          <SelectItem key={console.model} value={console.model}>
                            {console.model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Select
                      value={formData.foh_console}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, foh_console: value }))}
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
                  )}
                </div>

                {/* Monitor Console */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Monitor Console</h4>
                    <RadioGroup
                      value={formData.mon_console_provided_by || 'festival'}
                      onValueChange={(value: 'festival' | 'band') => 
                        setFormData(prev => ({ ...prev, mon_console_provided_by: value }))
                      }
                      className="flex space-x-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="festival" id="mon-festival" />
                        <Label htmlFor="mon-festival">Festival</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="band" id="mon-band" />
                        <Label htmlFor="mon-band">Band</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {formData.mon_console_provided_by === 'festival' ? (
                    <Select
                      value={formData.mon_console}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, mon_console: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select console" />
                      </SelectTrigger>
                      <SelectContent>
                        {gearSetup?.mon_consoles.map((console) => (
                          <SelectItem key={console.model} value={console.model}>
                            {console.model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Select
                      value={formData.mon_console}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, mon_console: value }))}
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
                  )}
                </div>
              </div>
            </div>

            {/* RF & Wireless Setup */}
            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="text-lg font-semibold">RF & Wireless Setup</h3>
              <div className="grid grid-cols-2 gap-6">
                {/* Wireless Systems */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Wireless Systems</h4>
                    <RadioGroup
                      value={formData.wireless_provided_by || 'festival'}
                      onValueChange={(value: 'festival' | 'band') => 
                        setFormData(prev => ({ ...prev, wireless_provided_by: value }))
                      }
                      className="flex space-x-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="festival" id="wireless-festival" />
                        <Label htmlFor="wireless-festival">Festival</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="band" id="wireless-band" />
                        <Label htmlFor="wireless-band">Band</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {formData.wireless_provided_by === 'festival' ? (
                    <Select
                      value={formData.wireless_model}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, wireless_model: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select wireless system" />
                      </SelectTrigger>
                      <SelectContent>
                        {gearSetup?.wireless_systems.map((system) => (
                          <SelectItem key={system.model} value={system.model}>
                            {system.model} ({system.quantity} available)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Select
                      value={formData.wireless_model}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, wireless_model: value }))}
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
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="wireless-hh">Handheld Qty</Label>
                      <Input
                        id="wireless-hh"
                        type="number"
                        min="0"
                        value={formData.wireless_quantity_hh || 0}
                        onChange={(e) => setFormData(prev => ({ 
                          ...prev, 
                          wireless_quantity_hh: parseInt(e.target.value) || 0 
                        }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="wireless-bp">Bodypack Qty</Label>
                      <Input
                        id="wireless-bp"
                        type="number"
                        min="0"
                        value={formData.wireless_quantity_bp || 0}
                        onChange={(e) => setFormData(prev => ({ 
                          ...prev, 
                          wireless_quantity_bp: parseInt(e.target.value) || 0 
                        }))}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="wireless-band">Frequency Band</Label>
                    <Input
                      id="wireless-band"
                      value={formData.wireless_band || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, wireless_band: e.target.value }))}
                      placeholder="e.g., G50, H50"
                    />
                  </div>
                </div>

                {/* IEM Systems */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">IEM Systems</h4>
                    <RadioGroup
                      value={formData.iem_provided_by || 'festival'}
                      onValueChange={(value: 'festival' | 'band') => 
                        setFormData(prev => ({ ...prev, iem_provided_by: value }))
                      }
                      className="flex space-x-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="festival" id="iem-festival" />
                        <Label htmlFor="iem-festival">Festival</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="band" id="iem-band" />
                        <Label htmlFor="iem-band">Band</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {formData.iem_provided_by === 'festival' ? (
                    <Select
                      value={formData.iem_model}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, iem_model: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select IEM system" />
                      </SelectTrigger>
                      <SelectContent>
                        {gearSetup?.iem_systems.map((system) => (
                          <SelectItem key={system.model} value={system.model}>
                            {system.model} ({system.quantity} available)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Select
                      value={formData.iem_model}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, iem_model: value }))}
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
                  )}

                  <div>
                    <Label htmlFor="iem-quantity">Quantity</Label>
                    <Input
                      id="iem-quantity"
                      type="number"
                      min="0"
                      value={formData.iem_quantity || 0}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        iem_quantity: parseInt(e.target.value) || 0 
                      }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="iem-band">Frequency Band</Label>
                    <Input
                      id="iem-band"
                      value={formData.iem_band || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, iem_band: e.target.value }))}
                      placeholder="e.g., G50, H50"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Monitor Setup */}
            <div className="space-y-4 border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Monitor Setup</h3>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="monitors-enabled"
                    checked={formData.monitors_enabled}
                    onCheckedChange={(checked) => 
                      setFormData(prev => ({ ...prev, monitors_enabled: checked }))
                    }
                  />
                  <Label htmlFor="monitors-enabled">Enable Stage Monitors</Label>
                </div>
              </div>

              {formData.monitors_enabled && (
                <div>
                  <Label htmlFor="monitors-quantity">Number of Monitors</Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      id="monitors-quantity"
                      type="number"
                      min="0"
                      value={formData.monitors_quantity || 0}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        monitors_quantity: parseInt(e.target.value) || 0 
                      }))}
                      className={cn(
                        !validateFestivalEquipment('monitors', formData.monitors_quantity || 0) && 
                        "border-red-500"
                      )}
                    />
                    {gearSetup && (
                      <Badge variant="secondary">
                        {gearSetup.available_monitors} available
                      </Badge>
                    )}
                  </div>
                  {!validateFestivalEquipment('monitors', formData.monitors_quantity || 0) && (
                    <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                      <AlertCircle className="h-4 w-4" />
                      Exceeds available monitors
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Extra Requirements */}
            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="text-lg font-semibold">Extra Requirements</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="extras-sf"
                    checked={formData.extras_sf}
                    onCheckedChange={(checked) => 
                      setFormData(prev => ({ ...prev, extras_sf: checked }))
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
                      setFormData(prev => ({ ...prev, extras_df: checked }))
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
                      setFormData(prev => ({ ...prev, extras_djbooth: checked }))
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
                  onChange={(e) => setFormData(prev => ({ ...prev, extras_wired: e.target.value }))}
                />
              </div>
            </div>

            {/* Infrastructure */}
            <div className="space-y-4 border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Infrastructure</h3>
                <RadioGroup
                  value={formData.infrastructure_provided_by || 'festival'}
                  onValueChange={(value: 'festival' | 'band') => 
                    setFormData(prev => ({ ...prev, infrastructure_provided_by: value }))
                  }
                  className="flex space-x-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="festival" id="infra-festival" />
                    <Label htmlFor="infra-festival">Festival Provided</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="band" id="infra-band" />
                    <Label htmlFor="infra-band">Band Provided</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* CAT6 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="infra-cat6"
                        checked={formData.infra_cat6}
                        onCheckedChange={(checked) => 
                          setFormData(prev => ({
                            ...prev,
                            infra_cat6: checked,
                            infra_cat6_quantity: checked ? 1 : 0
                          }))
                        }
                      />
                      <Label htmlFor="infra-cat6">CAT6</Label>
                    </div>
                    {formData.infra_cat6 && (
                      <div className="flex gap-2 items-center">
                        <Input
                          type="number"
                          min="1"
                          className={cn(
                            "w-24",
                            formData.infrastructure_provided_by === 'festival' &&
                            !validateFestivalEquipment('cat6', formData.infra_cat6_quantity || 0) &&
                            "border-red-500"
                          )}
                          value={formData.infra_cat6_quantity || 0}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            infra_cat6_quantity: parseInt(e.target.value) || 0
                          }))}
                        />
                        {gearSetup && (
                          <Badge variant="secondary">
                            {gearSetup.available_cat6_runs} available
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* HMA */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="infra-hma"
                        checked={formData.infra_hma}
                        onCheckedChange={(checked) => 
                          setFormData(prev => ({
                            ...prev,
                            infra_hma: checked,
                            infra_hma_quantity: checked ? 1 : 0
                          }))
                        }
                      />
                      <Label htmlFor="infra-hma">HMA</Label>
                    </div>
                    {formData.infra_hma && (
                      <div className="flex gap-2 items-center">
                        <Input
                          type="number"
                          min="1"
                          className={cn(
                            "w-24",
                            formData.infrastructure_provided_by === 'festival' &&
                            !validateFestivalEquipment('hma', formData.infra_hma_quantity || 0) &&
                            "border-red-500"
                          )}
                          value={formData.infra_hma_quantity || 0}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            infra_hma_quantity: parseInt(e.target.value) || 0
                          }))}
                        />
                        {gearSetup && (
                          <Badge variant="secondary">
                            {gearSetup.available_hma_runs} available
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Coax */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="infra-coax"
                        checked={formData.infra_coax}
                        onCheckedChange={(checked) => 
                          setFormData(prev => ({
                            ...prev,
                            infra_coax: checked,
                            infra_coax_quantity: checked ? 1 : 0
                          }))
                        }
                      />
                      <Label htmlFor="infra-coax">Coax</Label>
                    </div>
                    {formData.infra_coax && (
                      <div className="flex gap-2 items-center">
                        <Input
                          type="number"
                          min="1"
                          className={cn(
                            "w-24",
                            formData.infrastructure_provided_by === 'festival' &&
                            !validateFestivalEquipment('coax', formData.infra_coax_quantity || 0) &&
                            "border-red-500"
                          )}
                          value={formData.infra_coax_quantity || 0}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            infra_coax_quantity: parseInt(e.target.value) || 0
                          }))}
                        />
                        {gearSetup && (
                          <Badge variant="secondary">
                            {gearSetup.available_coax_runs} available
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* OpticalCon Duo */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="infra-opticalcon"
                        checked={formData.infra_opticalcon_duo}
                        onCheckedChange={(checked) => 
                          setFormData(prev => ({
                            ...prev,
                            infra_opticalcon_duo: checked,
                            infra_opticalcon_duo_quantity: checked ? 1 : 0
                          }))
                        }
                      />
                      <Label htmlFor="infra-opticalcon">OpticalCon Duo</Label>
                    </div>
                    {formData.infra_opticalcon_duo && (
                      <div className="flex gap-2 items-center">
                        <Input
                          type="number"
                          min="1"
                          className={cn(
                            "w-24",
                            formData.infrastructure_provided_by === 'festival' &&
                            !validateFestivalEquipment('opticalcon', formData.infra_opticalcon_duo_quantity || 0) &&
                            "border-red-500"
                          )}
                          value={formData.infra_opticalcon_duo_quantity || 0}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            infra_opticalcon_duo_quantity: parseInt(e.target.value) || 0
                          }))}
                        />
                        {gearSetup && (
                          <Badge variant="secondary">
                            {gearSetup.available_opticalcon_duo_runs} available
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Analog Lines */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="infra-analog">Analog Lines</Label>
                    <div className="flex gap-2 items-center">
                      <Input
                        id="infra-analog"
                        type="number"
                        min="0"
                        className={cn(
                          "w-24",
                          formData.infrastructure_provided_by === 'festival' &&
                          !validateFestivalEquipment('analog', formData.infra_analog || 0) &&
                          "border-red-500"
                        )}
                        value={formData.infra_analog || 0}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          infra_analog: parseInt(e.target.value) || 0
                        }))}
                      />
                      {gearSetup && (
                        <Badge variant="secondary">
                          {gearSetup.available_analog_runs} available
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="other-infrastructure">Other Infrastructure Requirements</Label>
                <Input
                  id="other-infrastructure"
                  value={formData.other_infrastructure || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    other_infrastructure: e.target.value
                  }))}
                  placeholder="Enter any additional infrastructure requirements"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes</Label>
              <Input
                id="notes"
                value={formData.notes || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  notes: e.target.value
                }))}
                placeholder="Enter any additional notes or requirements"
              />
            </div>

            {/* Submit Button */}
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Submitting..." : "Submit Requirements"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ArtistRequirementsForm;
