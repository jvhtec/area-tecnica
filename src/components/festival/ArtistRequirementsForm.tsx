
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

            {/* FOH Console Section */}
            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="text-lg font-semibold">FOH Console</h3>
              <RadioGroup
                value={formData.foh_console_provided_by || 'festival'}
                onValueChange={(value: 'festival' | 'band') => 
                  setFormData(prev => ({ ...prev, foh_console_provided_by: value }))
                }
                className="flex space-x-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="festival" id="foh-festival" />
                  <Label htmlFor="foh-festival">Festival Provided</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="band" id="foh-band" />
                  <Label htmlFor="foh-band">Band Provided</Label>
                </div>
              </RadioGroup>
              
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
                <Input
                  value={formData.foh_console || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, foh_console: e.target.value }))}
                  placeholder="Enter console model"
                />
              )}
            </div>

            {/* Monitor Console Section */}
            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="text-lg font-semibold">Monitor Console</h3>
              <RadioGroup
                value={formData.mon_console_provided_by || 'festival'}
                onValueChange={(value: 'festival' | 'band') => 
                  setFormData(prev => ({ ...prev, mon_console_provided_by: value }))
                }
                className="flex space-x-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="festival" id="mon-festival" />
                  <Label htmlFor="mon-festival">Festival Provided</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="band" id="mon-band" />
                  <Label htmlFor="mon-band">Band Provided</Label>
                </div>
              </RadioGroup>

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
                <Input
                  value={formData.mon_console || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, mon_console: e.target.value }))}
                  placeholder="Enter console model"
                />
              )}
            </div>

            {/* Wireless Systems */}
            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="text-lg font-semibold">Wireless Systems</h3>
              <RadioGroup
                value={formData.wireless_provided_by || 'festival'}
                onValueChange={(value: 'festival' | 'band') => 
                  setFormData(prev => ({ ...prev, wireless_provided_by: value }))
                }
                className="flex space-x-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="festival" id="wireless-festival" />
                  <Label htmlFor="wireless-festival">Festival Provided</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="band" id="wireless-band" />
                  <Label htmlFor="wireless-band">Band Provided</Label>
                </div>
              </RadioGroup>

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
                <Input
                  value={formData.wireless_model || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, wireless_model: e.target.value }))}
                  placeholder="Enter wireless system model"
                />
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="wireless-hh">Handheld Quantity</Label>
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
                  <Label htmlFor="wireless-bp">Bodypack Quantity</Label>
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
            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="text-lg font-semibold">IEM Systems</h3>
              <RadioGroup
                value={formData.iem_provided_by || 'festival'}
                onValueChange={(value: 'festival' | 'band') => 
                  setFormData(prev => ({ ...prev, iem_provided_by: value }))
                }
                className="flex space-x-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="festival" id="iem-festival" />
                  <Label htmlFor="iem-festival">Festival Provided</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="band" id="iem-band" />
                  <Label htmlFor="iem-band">Band Provided</Label>
                </div>
              </RadioGroup>

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
                <Input
                  value={formData.iem_model || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, iem_model: e.target.value }))}
                  placeholder="Enter IEM system model"
                />
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
                  <Label htmlFor="monitors-enabled">Enabled</Label>
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
                            infra_cat6_quantity: