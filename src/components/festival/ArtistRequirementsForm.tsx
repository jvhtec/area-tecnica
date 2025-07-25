import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { BasicInfoSection } from "./form/sections/BasicInfoSection";
import { ConsoleSetupSection } from "./form/sections/ConsoleSetupSection";
import { ArtistWirelessSetupSection } from "./form/sections/ArtistWirelessSetupSection";
import { MonitorSetupSection } from "./form/sections/MonitorSetupSection";
import { ExtraRequirementsSection } from "./form/sections/ExtraRequirementsSection";
import { InfrastructureSection } from "./form/sections/InfrastructureSection";
import { NotesSection } from "./form/sections/NotesSection";
import { FestivalGearSetup } from "@/types/festival";
import { Loader2 } from "lucide-react";
import { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

interface FormData {
  status: string;
  [key: string]: any;
}

type RealtimeFormPayload = RealtimePostgresChangesPayload<FormData>;

export const ArtistRequirementsForm = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [gearSetup, setGearSetup] = useState<FestivalGearSetup | null>(null);
  const [festivalLogo, setFestivalLogo] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({
    foh_console_provided_by: 'festival',
    mon_console_provided_by: 'festival',
    wireless_provided_by: 'festival',
    iem_provided_by: 'festival',
    infrastructure_provided_by: 'festival',
    monitors_enabled: false,
    monitors_quantity: 0,
    wireless_quantity_hh: 0,
    wireless_quantity_bp: 0,
    iem_quantity: 0,
    extras_sf: false,
    extras_df: false,
    extras_djbooth: false,
    infra_cat6: false,
    infra_cat6_quantity: 0,
    infra_hma: false,
    infra_hma_quantity: 0,
    infra_coax: false,
    infra_coax_quantity: 0,
    infra_opticalcon_duo: false,
    infra_opticalcon_duo_quantity: 0,
    infra_analog: 0
  });

  useEffect(() => {
    const fetchFormData = async () => {
      if (!token) {
        toast({
          title: "Error",
          description: "Invalid form token",
          variant: "destructive"
        });
        return;
      }
      
      try {
        const { data: formInfo, error: formError } = await supabase
          .from('festival_artist_forms')
          .select('artist_id, status')
          .eq('token', token)
          .maybeSingle();

        if (formError) throw formError;
        if (!formInfo) {
          toast({
            title: "Error",
            description: "Invalid form token",
            variant: "destructive"
          });
          return;
        }
        
        if (formInfo.status === 'completed') {
          toast({
            title: "Form Already Submitted",
            description: "This form has already been completed.",
            variant: "destructive"
          });
          return;
        }

        const { data: artistData, error: artistError } = await supabase
          .from('festival_artists')
          .select(`
            *,
            jobs:job_id (*)
          `)
          .eq('id', formInfo.artist_id)
          .maybeSingle();

        if (artistError) throw artistError;
        if (!artistData) {
          toast({
            title: "Error",
            description: "Artist not found",
            variant: "destructive"
          });
          return;
        }

        const { data: logoData, error: logoError } = await supabase
          .from('festival_logos')
          .select('file_path')
          .eq('job_id', artistData.job_id)
          .maybeSingle();

        if (logoError) {
          console.error('Error fetching festival logo:', logoError);
        } else if (logoData?.file_path) {
          const { data: { publicUrl } } = supabase
            .storage
            .from('festival-logos')
            .getPublicUrl(logoData.file_path);
          setFestivalLogo(publicUrl);
        }

        setFormData(prev => ({
          ...prev,
          name: artistData.name,
          stage: artistData.stage,
          date: artistData.date,
          show_start: artistData.show_start,
          show_end: artistData.show_end,
          soundcheck: artistData.soundcheck,
          soundcheck_start: artistData.soundcheck_start,
          soundcheck_end: artistData.soundcheck_end,
        }));

        const { data: gearSetupData, error: gearError } = await supabase
          .from('festival_gear_setups')
          .select('*')
          .eq('job_id', artistData.job_id)
          .eq('date', artistData.date)
          .maybeSingle();

        if (gearError) throw gearError;
        if (gearSetupData) {
          setGearSetup(gearSetupData);
        } else {
          console.warn('No gear setup found for this date');
        }
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

  useEffect(() => {
    if (!token) return;

    const channel = supabase
      .channel('form-status-changes')
      .on<FormData>(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'festival_artist_forms',
          filter: `token=eq.${token}`,
        },
        (payload: RealtimeFormPayload) => {
          console.log('Form status changed:', payload);
          const newData = payload.new as FormData;
          if (newData && newData.status === 'completed') {
            toast({
              title: "Form Status Updated",
              description: "Your form has been submitted successfully",
            });
            navigate('/festival/form-submitted');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [token, navigate, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !formData) return;

    setIsLoading(true);
    try {
      const { data: formInfo, error: formError } = await supabase
        .from('festival_artist_forms')
        .select('id, artist_id, status')
        .eq('token', token)
        .maybeSingle();

      if (formError) throw formError;
      if (!formInfo) {
        throw new Error('Form not found');
      }

      if (formInfo.status === 'completed') {
        throw new Error('This form has already been submitted');
      }

      const { error: submissionError } = await supabase
        .from('festival_artist_form_submissions')
        .insert({
          form_id: formInfo.id,
          artist_id: formInfo.artist_id,
          form_data: formData,
          status: 'submitted',
          submitted_at: new Date().toISOString(),
        });

      if (submissionError) throw submissionError;

      const { error: updateError } = await supabase
        .from('festival_artist_forms')
        .update({ status: 'submitted' })
        .eq('id', formInfo.id);

      if (updateError) throw updateError;

      toast({
        title: "Success",
        description: "Your technical requirements have been submitted successfully.",
      });

      navigate('/festival/form-submitted');
    } catch (error: any) {
      console.error('Error submitting form:', error);
      toast({
        title: "Error",
        description: error.message || "Could not submit form. Please try again later.",
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
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex flex-col items-center space-y-8">
          {festivalLogo && (
            <img 
              src={festivalLogo} 
              alt="Festival Logo" 
              className="h-16 object-contain"
            />
          )}
          
          <Card>
            <CardHeader>
              <CardTitle>Artist Technical Requirements Form</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-8">
                <BasicInfoSection 
                  formData={formData} 
                  onChange={handleFormChange}
                />

                <ConsoleSetupSection 
                  formData={formData} 
                  onChange={handleFormChange} 
                  gearSetup={gearSetup}
                />

                <ArtistWirelessSetupSection 
                  formData={formData} 
                  onChange={handleFormChange}
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
                />

                <Button type="submit" disabled={isLoading} className="w-full">
                  {isLoading ? "Submitting..." : "Submit Requirements"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <img 
            src="/sector%20pro%20logo.png" 
            alt="Company Logo" 
            className="h-16 object-contain mt-8"
          />
        </div>
      </div>
    </div>
  );
};

export default ArtistRequirementsForm;
