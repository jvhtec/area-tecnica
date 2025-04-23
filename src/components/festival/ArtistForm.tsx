
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

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
  const [formData, setFormData] = useState({
    name: "",
    foh_console: "",
    foh_console_provided_by: "festival",
    foh_tech: false,
    mon_console: "",
    mon_console_provided_by: "festival",
    mon_tech: false,
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
    infra_analog: 0,
    infra_opticalcon_duo: false,
    infra_opticalcon_duo_quantity: 0,
    infrastructure_provided_by: "festival",
    other_infrastructure: "",
    notes: "",
  });

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

      // Create form submission using the actual form ID
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

      // Mark the form as completed
      const { error: updateError } = await supabase
        .from('festival_artist_forms')
        .update({ status: 'completed' })
        .eq('id', formInfo.id);

      if (updateError) throw updateError;

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
            <div className="space-y-2">
              <Label>Artist/Band Name</Label>
              <Input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>

            {/* FOH Console Section */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">FOH Console</h2>
              <div className="space-y-2">
                <Label>Console Model</Label>
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
              </div>
            </div>

            {/* Monitor Console Section */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Monitor Console</h2>
              <div className="space-y-2">
                <Label>Console Model</Label>
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
              </div>
            </div>

            {/* Notes Section */}
            <div className="space-y-2">
              <Label>Additional Notes</Label>
              <Input
                type="text"
                value={formData.notes}
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
