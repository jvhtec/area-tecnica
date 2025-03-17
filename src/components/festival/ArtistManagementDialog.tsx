
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useForm } from "react-hook-form";
import { addDays, format, parse, set, isAfter, subDays } from "date-fns";
import { ArtistFormData } from "@/types/festival";
import { Loader2 } from "lucide-react";

interface ArtistManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  artist: any | null;
  jobId: string | undefined;
  selectedDate: string;
  dayStartTime: string;
}

export const ArtistManagementDialog = ({
  open,
  onOpenChange,
  artist,
  jobId,
  selectedDate,
  dayStartTime
}: ArtistManagementDialogProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // Default empty values for required fields
  const defaultFormData: ArtistFormData = {
    name: "",
    stage: "",
    date: selectedDate,
    show_start: "",
    show_end: "",
    soundcheck: false,
    soundcheck_start: "",
    soundcheck_end: "",
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
    infra_opticalcon_duo: false,
    infra_opticalcon_duo_quantity: 0,
    infra_analog: 0,
    infrastructure_provided_by: "festival",
    other_infrastructure: "",
    notes: ""
  };

  const [formData, setFormData] = useState<ArtistFormData>(defaultFormData);

  useEffect(() => {
    if (artist) {
      // Convert existing artist data to form data format
      const artistFormData: ArtistFormData = {
        name: artist.name || "",
        stage: artist.stage?.toString() || "",
        date: artist.date || selectedDate,
        show_start: artist.show_start || "",
        show_end: artist.show_end || "",
        soundcheck: artist.soundcheck || false,
        soundcheck_start: artist.soundcheck_start || "",
        soundcheck_end: artist.soundcheck_end || "",
        foh_console: artist.foh_console || "",
        foh_console_provided_by: artist.foh_console_provided_by || "festival",
        foh_tech: artist.foh_tech || false,
        mon_console: artist.mon_console || "",
        mon_console_provided_by: artist.mon_console_provided_by || "festival",
        mon_tech: artist.mon_tech || false,
        wireless_model: artist.wireless_model || "",
        wireless_provided_by: artist.wireless_provided_by || "festival",
        wireless_quantity_hh: artist.wireless_quantity_hh || 0,
        wireless_quantity_bp: artist.wireless_quantity_bp || 0,
        wireless_band: artist.wireless_band || "",
        iem_model: artist.iem_model || "",
        iem_provided_by: artist.iem_provided_by || "festival",
        iem_quantity: artist.iem_quantity || 0,
        iem_band: artist.iem_band || "",
        monitors_enabled: artist.monitors_enabled || false,
        monitors_quantity: artist.monitors_quantity || 0,
        extras_sf: artist.extras_sf || false,
        extras_df: artist.extras_df || false,
        extras_djbooth: artist.extras_djbooth || false,
        extras_wired: artist.extras_wired || "",
        infra_cat6: artist.infra_cat6 || false,
        infra_cat6_quantity: artist.infra_cat6_quantity || 0,
        infra_hma: artist.infra_hma || false,
        infra_hma_quantity: artist.infra_hma_quantity || 0,
        infra_coax: artist.infra_coax || false,
        infra_coax_quantity: artist.infra_coax_quantity || 0,
        infra_opticalcon_duo: artist.infra_opticalcon_duo || false,
        infra_opticalcon_duo_quantity: artist.infra_opticalcon_duo_quantity || 0,
        infra_analog: artist.infra_analog || 0,
        infrastructure_provided_by: artist.infrastructure_provided_by || "festival",
        other_infrastructure: artist.other_infrastructure || "",
        notes: artist.notes || ""
      };
      setFormData(artistFormData);
    } else {
      // Reset form to defaults for new artist
      setFormData(defaultFormData);
    }
  }, [artist, selectedDate]);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
  
    try {
      const cleanData = { ...formData };
      
      // Ensure numeric values are proper numbers
      if (typeof cleanData.stage === 'string' && cleanData.stage) {
        cleanData.stage = parseInt(cleanData.stage, 10);
      }
      
      // Convert empty strings to defaults to prevent NULL constraint errors
      const processedData = {
        name: cleanData.name || "",
        stage: cleanData.stage || 1,
        date: cleanData.date || selectedDate,
        show_start: cleanData.show_start || "",
        show_end: cleanData.show_end || "",
        soundcheck: cleanData.soundcheck || false,
        soundcheck_start: cleanData.soundcheck ? cleanData.soundcheck_start || "" : null,
        soundcheck_end: cleanData.soundcheck ? cleanData.soundcheck_end || "" : null,
        foh_console: cleanData.foh_console || "",
        foh_console_provided_by: cleanData.foh_console_provided_by || "festival",
        foh_tech: cleanData.foh_tech || false,
        mon_console: cleanData.mon_console || "",
        mon_console_provided_by: cleanData.mon_console_provided_by || "festival",
        mon_tech: cleanData.mon_tech || false,
        wireless_model: cleanData.wireless_model || "",
        wireless_provided_by: cleanData.wireless_provided_by || "festival",
        wireless_quantity_hh: cleanData.wireless_quantity_hh || 0,
        wireless_quantity_bp: cleanData.wireless_quantity_bp || 0,
        wireless_band: cleanData.wireless_band || "",
        iem_model: cleanData.iem_model || "",
        iem_provided_by: cleanData.iem_provided_by || "festival",
        iem_quantity: cleanData.iem_quantity || 0,
        iem_band: cleanData.iem_band || "",
        monitors_enabled: cleanData.monitors_enabled || false,
        monitors_quantity: cleanData.monitors_quantity || 0,
        extras_sf: cleanData.extras_sf || false,
        extras_df: cleanData.extras_df || false,
        extras_djbooth: cleanData.extras_djbooth || false,
        extras_wired: cleanData.extras_wired || "",
        infra_cat6: cleanData.infra_cat6 || false,
        infra_cat6_quantity: cleanData.infra_cat6_quantity || 0,
        infra_hma: cleanData.infra_hma || false,
        infra_hma_quantity: cleanData.infra_hma_quantity || 0,
        infra_coax: cleanData.infra_coax || false,
        infra_coax_quantity: cleanData.infra_coax_quantity || 0,
        infra_opticalcon_duo: cleanData.infra_opticalcon_duo || false,
        infra_opticalcon_duo_quantity: cleanData.infra_opticalcon_duo_quantity || 0,
        infra_analog: cleanData.infra_analog || 0,
        infrastructure_provided_by: cleanData.infrastructure_provided_by || "festival",
        other_infrastructure: cleanData.other_infrastructure || "",
        notes: cleanData.notes || "",
        job_id: jobId
      };
      
      // Calculate if this is an after-midnight show
      let isAfterMidnight = false;
      if (processedData.show_start) {
        // Check if the show time is before the festival day start time
        const [startHour, startMinute] = dayStartTime.split(':').map(Number);
        const [showHour, showMinute] = processedData.show_start.split(':').map(Number);
        
        // If the show starts before the festival day start time, it's an after-midnight show
        isAfterMidnight = showHour < startHour || (showHour === startHour && showMinute < startMinute);
      }
      
      console.log("Saving artist with data:", { ...processedData, isAfterMidnight });
      
      if (artist?.id) {
        // Update existing artist
        const { error } = await supabase
          .from("festival_artists")
          .update({ ...processedData, isAfterMidnight })
          .eq("id", artist.id);

        if (error) throw error;
        
        toast({
          title: "Success",
          description: "Artist updated successfully",
        });
      } else {
        // Create new artist
        const { error } = await supabase
          .from("festival_artists")
          .insert({ ...processedData, isAfterMidnight });

        if (error) throw error;
        
        toast({
          title: "Success",
          description: "Artist added successfully",
        });
      }
      
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error saving artist:", error);
      toast({
        title: "Error",
        description: `Failed to save artist: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{artist ? "Edit Artist" : "Add Artist"}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Artist Name</Label>
              <Input 
                id="name" 
                value={formData.name} 
                onChange={(e) => handleChange("name", e.target.value)} 
                required 
              />
            </div>
            
            <div>
              <Label htmlFor="stage">Stage</Label>
              <Input 
                id="stage" 
                type="number"
                min="1"
                value={formData.stage} 
                onChange={(e) => handleChange("stage", e.target.value)} 
                required 
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="show_start">Show Start Time</Label>
              <Input 
                id="show_start" 
                type="time"
                value={formData.show_start} 
                onChange={(e) => handleChange("show_start", e.target.value)} 
                required 
              />
            </div>
            
            <div>
              <Label htmlFor="show_end">Show End Time</Label>
              <Input 
                id="show_end" 
                type="time"
                value={formData.show_end} 
                onChange={(e) => handleChange("show_end", e.target.value)} 
                required 
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="soundcheck" 
              checked={formData.soundcheck} 
              onCheckedChange={(checked) => handleChange("soundcheck", Boolean(checked))} 
            />
            <Label htmlFor="soundcheck" className="cursor-pointer">Has Soundcheck</Label>
          </div>
          
          {formData.soundcheck && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
              <div>
                <Label htmlFor="soundcheck_start">Soundcheck Start Time</Label>
                <Input 
                  id="soundcheck_start" 
                  type="time"
                  value={formData.soundcheck_start} 
                  onChange={(e) => handleChange("soundcheck_start", e.target.value)} 
                />
              </div>
              
              <div>
                <Label htmlFor="soundcheck_end">Soundcheck End Time</Label>
                <Input 
                  id="soundcheck_end" 
                  type="time"
                  value={formData.soundcheck_end} 
                  onChange={(e) => handleChange("soundcheck_end", e.target.value)} 
                />
              </div>
            </div>
          )}
          
          <div className="border-t pt-4">
            <h3 className="text-lg font-medium mb-4">Console Setup</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <Label htmlFor="foh_console">FOH Console</Label>
                <Input 
                  id="foh_console" 
                  value={formData.foh_console} 
                  onChange={(e) => handleChange("foh_console", e.target.value)} 
                />
                
                <div className="space-y-2">
                  <Label>Provided By</Label>
                  <RadioGroup 
                    value={formData.foh_console_provided_by} 
                    onValueChange={(value) => handleChange("foh_console_provided_by", value as "festival" | "band")}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="festival" id="foh_festival" />
                      <Label htmlFor="foh_festival">Festival</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="band" id="foh_band" />
                      <Label htmlFor="foh_band">Band</Label>
                    </div>
                  </RadioGroup>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="foh_tech" 
                    checked={formData.foh_tech} 
                    onCheckedChange={(checked) => handleChange("foh_tech", Boolean(checked))} 
                  />
                  <Label htmlFor="foh_tech">Brings FOH Technician</Label>
                </div>
              </div>
              
              <div className="space-y-4">
                <Label htmlFor="mon_console">MON Console</Label>
                <Input 
                  id="mon_console" 
                  value={formData.mon_console} 
                  onChange={(e) => handleChange("mon_console", e.target.value)} 
                />
                
                <div className="space-y-2">
                  <Label>Provided By</Label>
                  <RadioGroup 
                    value={formData.mon_console_provided_by} 
                    onValueChange={(value) => handleChange("mon_console_provided_by", value as "festival" | "band")}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="festival" id="mon_festival" />
                      <Label htmlFor="mon_festival">Festival</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="band" id="mon_band" />
                      <Label htmlFor="mon_band">Band</Label>
                    </div>
                  </RadioGroup>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="mon_tech" 
                    checked={formData.mon_tech} 
                    onCheckedChange={(checked) => handleChange("mon_tech", Boolean(checked))} 
                  />
                  <Label htmlFor="mon_tech">Brings MON Technician</Label>
                </div>
              </div>
            </div>
          </div>
          
          <div className="border-t pt-4">
            <h3 className="text-lg font-medium mb-4">Wireless & IEM Setup</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <Label htmlFor="wireless_model">Wireless Model</Label>
                <Input 
                  id="wireless_model" 
                  value={formData.wireless_model} 
                  onChange={(e) => handleChange("wireless_model", e.target.value)} 
                />
                
                <div className="space-y-2">
                  <Label>Provided By</Label>
                  <RadioGroup 
                    value={formData.wireless_provided_by} 
                    onValueChange={(value) => handleChange("wireless_provided_by", value as "festival" | "band")}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="festival" id="wireless_festival" />
                      <Label htmlFor="wireless_festival">Festival</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="band" id="wireless_band" />
                      <Label htmlFor="wireless_band">Band</Label>
                    </div>
                  </RadioGroup>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="wireless_quantity_hh">HH Quantity</Label>
                    <Input 
                      id="wireless_quantity_hh" 
                      type="number"
                      min="0"
                      value={formData.wireless_quantity_hh} 
                      onChange={(e) => handleChange("wireless_quantity_hh", parseInt(e.target.value) || 0)} 
                    />
                  </div>
                  <div>
                    <Label htmlFor="wireless_quantity_bp">BP Quantity</Label>
                    <Input 
                      id="wireless_quantity_bp" 
                      type="number"
                      min="0"
                      value={formData.wireless_quantity_bp} 
                      onChange={(e) => handleChange("wireless_quantity_bp", parseInt(e.target.value) || 0)} 
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="wireless_band">Frequency Band</Label>
                  <Input 
                    id="wireless_band" 
                    value={formData.wireless_band} 
                    onChange={(e) => handleChange("wireless_band", e.target.value)} 
                  />
                </div>
              </div>
              
              <div className="space-y-4">
                <Label htmlFor="iem_model">IEM Model</Label>
                <Input 
                  id="iem_model" 
                  value={formData.iem_model} 
                  onChange={(e) => handleChange("iem_model", e.target.value)} 
                />
                
                <div className="space-y-2">
                  <Label>Provided By</Label>
                  <RadioGroup 
                    value={formData.iem_provided_by} 
                    onValueChange={(value) => handleChange("iem_provided_by", value as "festival" | "band")}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="festival" id="iem_festival" />
                      <Label htmlFor="iem_festival">Festival</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="band" id="iem_band" />
                      <Label htmlFor="iem_band">Band</Label>
                    </div>
                  </RadioGroup>
                </div>
                
                <div>
                  <Label htmlFor="iem_quantity">IEM Quantity</Label>
                  <Input 
                    id="iem_quantity" 
                    type="number"
                    min="0"
                    value={formData.iem_quantity} 
                    onChange={(e) => handleChange("iem_quantity", parseInt(e.target.value) || 0)} 
                  />
                </div>
                
                <div>
                  <Label htmlFor="iem_band">Frequency Band</Label>
                  <Input 
                    id="iem_band" 
                    value={formData.iem_band} 
                    onChange={(e) => handleChange("iem_band", e.target.value)} 
                  />
                </div>
              </div>
            </div>
          </div>
          
          <div className="border-t pt-4">
            <h3 className="text-lg font-medium mb-4">Monitor Setup</h3>
            
            <div className="flex items-center space-x-2 mb-4">
              <Checkbox 
                id="monitors_enabled" 
                checked={formData.monitors_enabled} 
                onCheckedChange={(checked) => handleChange("monitors_enabled", Boolean(checked))} 
              />
              <Label htmlFor="monitors_enabled">Needs Wedge Monitors</Label>
            </div>
            
            {formData.monitors_enabled && (
              <div>
                <Label htmlFor="monitors_quantity">Monitor Quantity</Label>
                <Input 
                  id="monitors_quantity" 
                  type="number"
                  min="0"
                  value={formData.monitors_quantity} 
                  onChange={(e) => handleChange("monitors_quantity", parseInt(e.target.value) || 0)} 
                />
              </div>
            )}
            
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="extras_sf" 
                  checked={formData.extras_sf} 
                  onCheckedChange={(checked) => handleChange("extras_sf", Boolean(checked))} 
                />
                <Label htmlFor="extras_sf">Side Fill</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="extras_df" 
                  checked={formData.extras_df} 
                  onCheckedChange={(checked) => handleChange("extras_df", Boolean(checked))} 
                />
                <Label htmlFor="extras_df">Drum Fill</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="extras_djbooth" 
                  checked={formData.extras_djbooth} 
                  onCheckedChange={(checked) => handleChange("extras_djbooth", Boolean(checked))} 
                />
                <Label htmlFor="extras_djbooth">DJ Booth</Label>
              </div>
            </div>
            
            <div className="mt-4">
              <Label htmlFor="extras_wired">Other Wired Equipment</Label>
              <Input 
                id="extras_wired" 
                value={formData.extras_wired} 
                onChange={(e) => handleChange("extras_wired", e.target.value)} 
              />
            </div>
          </div>
          
          <div className="border-t pt-4">
            <h3 className="text-lg font-medium mb-4">Infrastructure Needs</h3>
            
            <div className="space-y-2 mb-4">
              <Label>Provided By</Label>
              <RadioGroup 
                value={formData.infrastructure_provided_by} 
                onValueChange={(value) => handleChange("infrastructure_provided_by", value as "festival" | "band")}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="festival" id="infra_festival" />
                  <Label htmlFor="infra_festival">Festival</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="band" id="infra_band" />
                  <Label htmlFor="infra_band">Band</Label>
                </div>
              </RadioGroup>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="infra_cat6" 
                    checked={formData.infra_cat6} 
                    onCheckedChange={(checked) => handleChange("infra_cat6", Boolean(checked))} 
                  />
                  <Label htmlFor="infra_cat6">CAT6</Label>
                </div>
                
                {formData.infra_cat6 && (
                  <Input 
                    id="infra_cat6_quantity" 
                    type="number"
                    min="0"
                    placeholder="Quantity"
                    value={formData.infra_cat6_quantity} 
                    onChange={(e) => handleChange("infra_cat6_quantity", parseInt(e.target.value) || 0)} 
                  />
                )}
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="infra_hma" 
                    checked={formData.infra_hma} 
                    onCheckedChange={(checked) => handleChange("infra_hma", Boolean(checked))} 
                  />
                  <Label htmlFor="infra_hma">HMA</Label>
                </div>
                
                {formData.infra_hma && (
                  <Input 
                    id="infra_hma_quantity" 
                    type="number"
                    min="0"
                    placeholder="Quantity"
                    value={formData.infra_hma_quantity} 
                    onChange={(e) => handleChange("infra_hma_quantity", parseInt(e.target.value) || 0)} 
                  />
                )}
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="infra_coax" 
                    checked={formData.infra_coax} 
                    onCheckedChange={(checked) => handleChange("infra_coax", Boolean(checked))} 
                  />
                  <Label htmlFor="infra_coax">Coax</Label>
                </div>
                
                {formData.infra_coax && (
                  <Input 
                    id="infra_coax_quantity" 
                    type="number"
                    min="0"
                    placeholder="Quantity"
                    value={formData.infra_coax_quantity} 
                    onChange={(e) => handleChange("infra_coax_quantity", parseInt(e.target.value) || 0)} 
                  />
                )}
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="infra_opticalcon_duo" 
                    checked={formData.infra_opticalcon_duo} 
                    onCheckedChange={(checked) => handleChange("infra_opticalcon_duo", Boolean(checked))} 
                  />
                  <Label htmlFor="infra_opticalcon_duo">OpticalCON DUO</Label>
                </div>
                
                {formData.infra_opticalcon_duo && (
                  <Input 
                    id="infra_opticalcon_duo_quantity" 
                    type="number"
                    min="0"
                    placeholder="Quantity"
                    value={formData.infra_opticalcon_duo_quantity} 
                    onChange={(e) => handleChange("infra_opticalcon_duo_quantity", parseInt(e.target.value) || 0)} 
                  />
                )}
              </div>
            </div>
            
            <div className="mt-4">
              <Label htmlFor="infra_analog">Analog Multicore (Channels)</Label>
              <Input 
                id="infra_analog" 
                type="number"
                min="0"
                value={formData.infra_analog} 
                onChange={(e) => handleChange("infra_analog", parseInt(e.target.value) || 0)} 
              />
            </div>
            
            <div className="mt-4">
              <Label htmlFor="other_infrastructure">Other Infrastructure</Label>
              <Input 
                id="other_infrastructure" 
                value={formData.other_infrastructure} 
                onChange={(e) => handleChange("other_infrastructure", e.target.value)} 
              />
            </div>
          </div>
          
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea 
              id="notes" 
              value={formData.notes} 
              onChange={(e) => handleChange("notes", e.target.value)} 
              className="h-24"
            />
          </div>
          
          <div className="flex justify-end space-x-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : artist ? "Update Artist" : "Add Artist"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
