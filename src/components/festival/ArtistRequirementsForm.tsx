
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { BasicInfoSection } from "./form/sections/BasicInfoSection";
import { ConsoleSetupSection } from "./form/sections/ConsoleSetupSection";
import { WirelessSetupSection } from "./form/sections/WirelessSetupSection";
import { MonitorSetupSection } from "./form/sections/MonitorSetupSection";
import { ExtraRequirementsSection } from "./form/sections/ExtraRequirementsSection";
import { InfrastructureSection } from "./form/sections/InfrastructureSection";
import { NotesSection } from "./form/sections/NotesSection";
import { FestivalGearSetup } from "@/types/festival";

export const ArtistRequirementsForm = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [gearSetup, setGearSetup] = useState<FestivalGearSetup | null>(null);
  const [formData, setFormData] = useState<any>({});

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

  const handleFormChange = (changes: Partial<any>) => {
    setFormData(prev => ({ ...prev, ...changes }));
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

  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Artist Technical Requirements Form</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-8">
            <BasicInfoSection 
              formData={formData} 
              onChange={handleFormChange} 
              gearSetup={gearSetup}
            />

            <ConsoleSetupSection 
              formData={formData} 
              onChange={handleFormChange} 
              gearSetup={gearSetup}
            />

            <WirelessSetupSection 
              formData={formData} 
              onChange={handleFormChange} 
              gearSetup={gearSetup}
            />

            <MonitorSetupSection 
              formData={formData} 
              onChange={handleFormChange} 
              gearSetup={gearSetup}
            />

            <ExtraRequirementsSection 
              formData={formData} 
              onChange={handleFormChange} 
              gearSetup={gearSetup}
            />

            <InfrastructureSection 
              formData={formData} 
              onChange={handleFormChange} 
              gearSetup={gearSetup}
            />

            <NotesSection 
              formData={formData} 
              onChange={handleFormChange} 
              gearSetup={gearSetup}
            />

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
