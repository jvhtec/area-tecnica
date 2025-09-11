import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ArtistWirelessSetupSection } from "./form/sections/ArtistWirelessSetupSection";
import { MicKitSection } from "./form/sections/MicKitSection";
import { ArtistFormData } from "@/types/festival";
import { useEquipmentModels } from "@/hooks/useEquipmentModels";
import { WiredMic } from "./gear-setup/WiredMicConfig";

const consoleOptions = [
  'Yamaha CL5', 'Yamaha PMx', 'Yamaha DM7','Yamaha DM3', 'DiGiCo SD5', 'DiGiCo SD7', 'DiGiCo SD8', 
  'DiGiCo SD10', 'DiGiCo SD11', 'DiGiCo SD12', 'DiGiCo SD5Q', 'DiGiCo SD7Q',
  'DiGiCo Q225', 'DiGiCo Q326', 'DiGiCo Q338', 'DiGiCo Q852', 'Avid S6L',
  'A&H C1500', 'A&H C2500', 'A&H S3000', 'A&H S5000', 'A&H S7000',
  'Waves LV1 (homemade)', 'Waves LV1 Classic', 'SSL', 'Midas HD96', 'Other'
];

export const ArtistForm = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const { models } = useEquipmentModels();
  
  const [formData, setFormData] = useState<ArtistFormData & { 
    mic_kit: 'festival' | 'band' | 'mixed'; 
    wired_mics: WiredMic[];
    foh_tech: boolean;
    mon_tech: boolean;
    isaftermidnight: boolean;
    rider_missing: boolean;
  }>({
    name: "",
    stage: 1,
    date: "",
    show_start: "20:00",
    show_end: "21:00",
    soundcheck: false,
    soundcheck_start: "18:00",
    soundcheck_end: "19:00",
    foh_console: "",
    foh_console_provided_by: "festival",
    foh_tech: false,
    mon_console: "",
    mon_console_provided_by: "festival",
    mon_tech: false,
    wireless_systems: [],
    iem_systems: [],
    wireless_provided_by: "festival",
    iem_provided_by: "festival",
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
    infra_analog: 0,
    infra_opticalcon_duo: false,
    infra_opticalcon_duo_quantity: 0,
    infrastructure_provided_by: "festival",
    other_infrastructure: "",
    notes: "",
    mic_kit: "band",
    wired_mics: [],
    isaftermidnight: false,
    rider_missing: false
  });

  // Get console options from database with fallback
  const fohConsoleOptions = models
    .filter(model => model.category === 'foh_console')
    .map(model => model.name);
  const monConsoleOptions = models
    .filter(model => model.category === 'mon_console')
    .map(model => model.name);
    
  const fohOptions = fohConsoleOptions.length > 0 ? fohConsoleOptions : consoleOptions;
  const monOptions = monConsoleOptions.length > 0 ? monConsoleOptions : consoleOptions;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      toast({
        title: "Error",
        description: "Invalid form URL",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // First verify the form token is valid and get the form details
      const { data: formInfo, error: formError } = await supabase
        .from('festival_artist_forms')
        .select('id, artist_id, status, expires_at')
        .eq('token', token)
        .single();

      if (formError) {
        throw new Error('Invalid form link');
      }

      if (!formInfo) {
        throw new Error('Form not found');
      }

      // Check if form is expired
      if (new Date(formInfo.expires_at) < new Date()) {
        throw new Error('This form link has expired');
      }

      // Check if form is already completed
      if (formInfo.status !== 'pending') {
        throw new Error('This form has already been submitted');
      }

      // Ensure wired_mics is properly serialized
      const submissionData = {
        ...formData,
        wired_mics: JSON.stringify(formData.wired_mics || [])
      };

      console.log('Submitting form data:', submissionData);

      // Create form submission using the actual form ID
      const { error: submissionError } = await supabase
        .from('festival_artist_form_submissions')
        .insert({
          form_id: formInfo.id,
          artist_id: formInfo.artist_id,
          form_data: submissionData,
          status: 'submitted',
          submitted_at: new Date().toISOString(),
        });

      if (submissionError) {
        console.error('Submission error:', submissionError);
        throw submissionError;
      }

      // Update the artist record with the form data (only fields that exist in the table)
      const { error: updateError } = await supabase
        .from('festival_artists')
        .update({
          name: formData.name,
          stage: formData.stage,
          show_start: formData.show_start,
          show_end: formData.show_end,
          soundcheck: formData.soundcheck,
          soundcheck_start: formData.soundcheck_start,
          soundcheck_end: formData.soundcheck_end,
          foh_console: formData.foh_console,
          foh_console_provided_by: formData.foh_console_provided_by,
          foh_tech: formData.foh_tech,
          mon_console: formData.mon_console,
          mon_console_provided_by: formData.mon_console_provided_by,
          mon_tech: formData.mon_tech,
          wireless_systems: formData.wireless_systems,
          wireless_provided_by: formData.wireless_provided_by,
          iem_systems: formData.iem_systems,
          iem_provided_by: formData.iem_provided_by,
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
          infra_analog: formData.infra_analog,
          infra_opticalcon_duo: formData.infra_opticalcon_duo,
          infra_opticalcon_duo_quantity: formData.infra_opticalcon_duo_quantity,
          infrastructure_provided_by: formData.infrastructure_provided_by,
          other_infrastructure: formData.other_infrastructure,
          notes: formData.notes,
          isaftermidnight: formData.isaftermidnight,
          rider_missing: formData.rider_missing,
          mic_kit: formData.mic_kit,
          wired_mics: JSON.stringify(formData.wired_mics || []), // Properly serialize as JSON
        })
        .eq('id', formInfo.artist_id);

      if (updateError) {
        console.error('Update error:', updateError);
        throw updateError;
      }

      // Mark the form as completed
      const { error: updateFormError } = await supabase
        .from('festival_artist_forms')
        .update({ status: 'completed' })
        .eq('id', formInfo.id);

      if (updateFormError) throw updateFormError;

      toast({
        title: "Success",
        description: "Form submitted successfully",
      });

      // Redirect to a thank you page
      navigate('/festival/form-submitted');
    } catch (error: any) {
      console.error('Error submitting form:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-2xl font-bold">Artist Technical Requirements Form</h1>
        
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid gap-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Basic Information</h2>
              <div className="space-y-2">
                <Label>Artist/Band Name</Label>
                <Input
                  type="text"
                  value={formData.name || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Show Start Time</Label>
                  <Input
                    type="time"
                    value={formData.show_start || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, show_start: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Show End Time</Label>
                  <Input
                    type="time"
                    value={formData.show_end || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, show_end: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="soundcheck"
                    checked={formData.soundcheck}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, soundcheck: !!checked }))}
                  />
                  <Label htmlFor="soundcheck">Soundcheck Required</Label>
                </div>

                {formData.soundcheck && (
                  <div className="grid grid-cols-2 gap-4 ml-6">
                    <div className="space-y-2">
                      <Label>Soundcheck Start</Label>
                      <Input
                        type="time"
                        value={formData.soundcheck_start || ""}
                        onChange={(e) => setFormData(prev => ({ ...prev, soundcheck_start: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Soundcheck End</Label>
                      <Input
                        type="time"
                        value={formData.soundcheck_end || ""}
                        onChange={(e) => setFormData(prev => ({ ...prev, soundcheck_end: e.target.value }))}
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="after-midnight"
                    checked={formData.isaftermidnight}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isaftermidnight: !!checked }))}
                  />
                  <Label htmlFor="after-midnight">Show is after midnight</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="rider-missing"
                    checked={formData.rider_missing}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, rider_missing: !!checked }))}
                  />
                  <Label htmlFor="rider-missing">Rider is missing</Label>
                </div>
              </div>
            </div>

            {/* FOH Console Section */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">FOH Console</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Console Model</Label>
                  <Select
                    value={formData.foh_console || ""}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, foh_console: value }))}
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
                <div className="space-y-2">
                  <Label>Provided By</Label>
                  <Select
                    value={formData.foh_console_provided_by || "festival"}
                    onValueChange={(value: "festival" | "band") => setFormData(prev => ({ ...prev, foh_console_provided_by: value }))}
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
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, foh_tech: !!checked }))}
                />
                <Label htmlFor="foh-tech">FOH Technician Required</Label>
              </div>
            </div>

            {/* Monitor Console Section */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Monitor Console</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Console Model</Label>
                  <Select
                    value={formData.mon_console || ""}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, mon_console: value }))}
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
                <div className="space-y-2">
                  <Label>Provided By</Label>
                  <Select
                    value={formData.mon_console_provided_by || "festival"}
                    onValueChange={(value: "festival" | "band") => setFormData(prev => ({ ...prev, mon_console_provided_by: value }))}
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
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, mon_tech: !!checked }))}
                />
                <Label htmlFor="mon-tech">Monitor Technician Required</Label>
              </div>
            </div>

            {/* Microphone Kit Section */}
            <MicKitSection
              micKit={formData.mic_kit}
              wiredMics={formData.wired_mics}
              onMicKitChange={(provider) => setFormData(prev => ({ ...prev, mic_kit: provider }))}
              onWiredMicsChange={(mics) => setFormData(prev => ({ ...prev, wired_mics: mics }))}
            />

            {/* RF & Wireless Setup Section */}
            <ArtistWirelessSetupSection
              formData={formData}
              onChange={(data) => setFormData(prev => ({ ...prev, ...data }))}
            />

            {/* Notes Section */}
            <div className="space-y-2">
              <Label>Additional Notes</Label>
              <Input
                type="text"
                value={formData.notes || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Any additional requirements or comments"
              />
            </div>
          </div>

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? "Submitting..." : "Submit Form"}
          </Button>
        </form>
      </div>
    </div>
  );
};
