
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { ArtistFormLinkDialog } from "./ArtistFormLinkDialog";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ArtistManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  artist?: any;
  jobId?: string;
  selectedDate?: string;
  dayStartTime?: string;
}

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

export const ArtistManagementDialog = ({
  open,
  onOpenChange,
  artist,
  jobId,
  selectedDate,
  dayStartTime = "07:00"
}: ArtistManagementDialogProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formLinkDialogOpen, setFormLinkDialogOpen] = useState(false);
  const [showStartHour, setShowStartHour] = useState<number | null>(null);
  const [showEndHour, setShowEndHour] = useState<number | null>(null);
  const [dayStartHour] = useState<number>(parseInt(dayStartTime.split(':')[0]) || 7);

  const [formData, setFormData] = useState({
    name: "",
    stage: "",
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
    infra_analog: 0,
    infra_opticalcon_duo: false,
    infra_opticalcon_duo_quantity: 0,
    infrastructure_provided_by: "festival",
    other_infrastructure: "",
    notes: "",
    date: selectedDate || "",
  });

  useEffect(() => {
    if (artist) {
      setFormData({
        ...artist,
        date: artist.date || selectedDate || "",
      });
      
      // Set hours for after-midnight detection
      if (artist.show_start) {
        setShowStartHour(parseInt(artist.show_start.split(':')[0]));
      }
      if (artist.show_end) {
        setShowEndHour(parseInt(artist.show_end.split(':')[0]));
      }
    } else {
      setFormData(prev => ({
        ...prev,
        date: selectedDate || "",
      }));
      setShowStartHour(null);
      setShowEndHour(null);
    }
  }, [artist, selectedDate]);

  const handleTimeChange = (timeField: 'show_start' | 'show_end', value: string) => {
    setFormData({ ...formData, [timeField]: value });
    
    if (value) {
      const hour = parseInt(value.split(':')[0]);
      if (timeField === 'show_start') {
        setShowStartHour(hour);
      } else {
        setShowEndHour(hour);
      }
    } else {
      if (timeField === 'show_start') {
        setShowStartHour(null);
      } else {
        setShowEndHour(null);
      }
    }
  };

  // Check if a time is after midnight but before the festival day start
  const isAfterMidnight = (hour: number | null) => {
    return hour !== null && hour < dayStartHour;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!jobId) {
      toast({
        title: "Error",
        description: "Job ID is missing",
        variant: "destructive",
      });
      return;
    }

    if (!formData.date) {
      toast({
        title: "Error",
        description: "Performance date is required",
        variant: "destructive",
      });
      return;
    }

    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Artist name is required",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const data = {
        ...formData,
        job_id: jobId,
        // Only parse stage as integer if it's provided
        stage: formData.stage ? parseInt(formData.stage) : null,
        show_start: formData.show_start || null,
        show_end: formData.show_end || null,
        soundcheck_start: formData.soundcheck_start || null,
        soundcheck_end: formData.soundcheck_end || null,
        // Add a flag to indicate if this is an after-midnight performance
        isAfterMidnight: isAfterMidnight(showStartHour),
      };

      const { error } = artist?.id
        ? await supabase
            .from("festival_artists")
            .update(data)
            .eq("id", artist.id)
        : await supabase.from("festival_artists").insert(data);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Artist ${artist?.id ? "updated" : "added"} successfully`,
      });
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error saving artist:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const ProviderRadioGroup = ({ value, onChange, label }: { value: string, onChange: (value: string) => void, label: string }) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <RadioGroup
        value={value}
        onValueChange={onChange}
        className="flex space-x-4"
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="festival" id={`${label}-festival`} />
          <Label htmlFor={`${label}-festival`}>Festival</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="band" id={`${label}-band`} />
          <Label htmlFor={`${label}-band`}>Band</Label>
        </div>
      </RadioGroup>
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {artist?.id ? "Edit Artist" : "Add New Artist"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Artist Name*</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="stage">Stage Number</Label>
                  <Input
                    id="stage"
                    type="number"
                    min="1"
                    value={formData.stage}
                    onChange={(e) =>
                      setFormData({ ...formData, stage: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="date">Performance Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    readOnly
                    className="bg-gray-100"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="show_start">Show Start</Label>
                      {isAfterMidnight(showStartHour) && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge className="bg-blue-500 hover:bg-blue-600 flex items-center gap-1">
                                <Clock className="h-3 w-3" /> AM
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>This time is after midnight (early morning)</p>
                              <p>On the {dayStartTime} to {dayStartTime} festival day schedule</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                    <Input
                      id="show_start"
                      type="time"
                      value={formData.show_start}
                      onChange={(e) => handleTimeChange('show_start', e.target.value)}
                      className={isAfterMidnight(showStartHour) ? "border-blue-500" : ""}
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="show_end">Show End</Label>
                      {isAfterMidnight(showEndHour) && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge className="bg-blue-500 hover:bg-blue-600 flex items-center gap-1">
                                <Clock className="h-3 w-3" /> AM
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>This time is after midnight (early morning)</p>
                              <p>On the {dayStartTime} to {dayStartTime} festival day schedule</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                    <Input
                      id="show_end"
                      type="time"
                      value={formData.show_end}
                      onChange={(e) => handleTimeChange('show_end', e.target.value)}
                      className={isAfterMidnight(showEndHour) ? "border-blue-500" : ""}
                    />
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="soundcheck">Soundcheck</Label>
                    <Switch
                      id="soundcheck"
                      checked={formData.soundcheck}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, soundcheck: checked })
                      }
                    />
                  </div>
                  {formData.soundcheck && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="soundcheck_start">Soundcheck Start</Label>
                        <Input
                          id="soundcheck_start"
                          type="time"
                          value={formData.soundcheck_start}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              soundcheck_start: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="soundcheck_end">Soundcheck End</Label>
                        <Input
                          id="soundcheck_end"
                          type="time"
                          value={formData.soundcheck_end}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              soundcheck_end: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="foh_tech">FOH Tech</Label>
                    <Switch
                      id="foh_tech"
                      checked={formData.foh_tech}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, foh_tech: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="mon_tech">Monitor Tech</Label>
                    <Switch
                      id="mon_tech"
                      checked={formData.mon_tech}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, mon_tech: checked })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="foh_console">FOH Console</Label>
                  <Select
                    value={formData.foh_console}
                    onValueChange={(value) =>
                      setFormData({ ...formData, foh_console: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select FOH console" />
                    </SelectTrigger>
                    <SelectContent>
                      {consoleOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <ProviderRadioGroup
                    value={formData.foh_console_provided_by}
                    onChange={(value) => setFormData({ ...formData, foh_console_provided_by: value })}
                    label="FOH Console Provided By"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mon_console">Monitor Console</Label>
                  <Select
                    value={formData.mon_console}
                    onValueChange={(value) =>
                      setFormData({ ...formData, mon_console: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select monitor console" />
                    </SelectTrigger>
                    <SelectContent>
                      {consoleOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <ProviderRadioGroup
                    value={formData.mon_console_provided_by}
                    onChange={(value) => setFormData({ ...formData, mon_console_provided_by: value })}
                    label="Monitor Console Provided By"
                  />
                </div>
              </div>
            </div>

            <div className="border rounded-lg p-4 space-y-4">
              <h3 className="text-lg font-medium">RF & Wireless Setup</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="wireless_model">Wireless Microphone Model</Label>
                    <Select
                      value={formData.wireless_model}
                      onValueChange={(value) =>
                        setFormData({ ...formData, wireless_model: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select wireless model" />
                      </SelectTrigger>
                      <SelectContent>
                        {wirelessOptions.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <ProviderRadioGroup
                      value={formData.wireless_provided_by}
                      onChange={(value) => setFormData({ ...formData, wireless_provided_by: value })}
                      label="Wireless System Provided By"
                    />
                  </div>
                  <div>
                    <Label htmlFor="wireless_quantity_hh">Handheld Quantity</Label>
                    <Input
                      id="wireless_quantity_hh"
                      type="number"
                      min="0"
                      value={formData.wireless_quantity_hh}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          wireless_quantity_hh: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="wireless_quantity_bp">Bodypack Quantity</Label>
                    <Input
                      id="wireless_quantity_bp"
                      type="number"
                      min="0"
                      value={formData.wireless_quantity_bp}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          wireless_quantity_bp: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="wireless_band">Frequency Band</Label>
                    <Input
                      id="wireless_band"
                      value={formData.wireless_band}
                      onChange={(e) =>
                        setFormData({ ...formData, wireless_band: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="iem_model">IEM Model</Label>
                    <Select
                      value={formData.iem_model}
                      onValueChange={(value) =>
                        setFormData({ ...formData, iem_model: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select IEM model" />
                      </SelectTrigger>
                      <SelectContent>
                        {iemOptions.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <ProviderRadioGroup
                      value={formData.iem_provided_by}
                      onChange={(value) => setFormData({ ...formData, iem_provided_by: value })}
                      label="IEM System Provided By"
                    />
                  </div>
                  <div>
                    <Label htmlFor="iem_quantity">IEM Quantity</Label>
                    <Input
                      id="iem_quantity"
                      type="number"
                      min="0"
                      value={formData.iem_quantity}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          iem_quantity: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="iem_band">IEM Band</Label>
                    <Input
                      id="iem_band"
                      value={formData.iem_band}
                      onChange={(e) =>
                        setFormData({ ...formData, iem_band: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Monitor Setup</h3>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={formData.monitors_enabled}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, monitors_enabled: checked })
                    }
                  />
                  <Label>Enabled</Label>
                </div>
              </div>
              {formData.monitors_enabled && (
                <div>
                  <Label htmlFor="monitors_quantity">Number of Monitors</Label>
                  <Input
                    id="monitors_quantity"
                    type="number"
                    min="0"
                    value={formData.monitors_quantity}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        monitors_quantity: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              )}
            </div>

            <div className="border rounded-lg p-4 space-y-4">
              <h3 className="text-lg font-medium">Extra Requirements</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={formData.extras_sf}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, extras_sf: checked })
                    }
                  />
                  <Label>Side Fill</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={formData.extras_df}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, extras_df: checked })
                    }
                  />
                  <Label>Drum Fill</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={formData.extras_djbooth}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, extras_djbooth: checked })
                    }
                  />
                  <Label>DJ Booth</Label>
                </div>
              </div>
              <div>
                <Label htmlFor="extras_wired">Additional Wired Requirements</Label>
                <Input
                  id="extras_wired"
                  value={formData.extras_wired}
                  onChange={(e) =>
                    setFormData({ ...formData, extras_wired: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Infrastructure</h3>
                <ProviderRadioGroup
                  value={formData.infrastructure_provided_by}
                  onChange={(value) => setFormData({ ...formData, infrastructure_provided_by: value })}
                  label="Infrastructure Provided By"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={formData.infra_cat6}
                        onCheckedChange={(checked) =>
                          setFormData({
                            ...formData,
                            infra_cat6: checked,
                            infra_cat6_quantity: checked ? 1 : 0
                          })
                        }
                      />
                      <Label>CAT6</Label>
                    </div>
                    {formData.infra_cat6 && (
                      <Input
                        type="number"
                        min="1"
                        className="w-24"
                        value={formData.infra_cat6_quantity}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            infra_cat6_quantity: parseInt(e.target.value) || 0
                          })
                        }
                      />
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={formData.infra_hma}
                        onCheckedChange={(checked) =>
                          setFormData({
                            ...formData,
                            infra_hma: checked,
                            infra_hma_quantity: checked ? 1 : 0
                          })
                        }
                      />
                      <Label>HMA</Label>
                    </div>
                    {formData.infra_hma && (
                      <Input
                        type="number"
                        min="1"
                        className="w-24"
                        value={formData.infra_hma_quantity}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            infra_hma_quantity: parseInt(e.target.value) || 0
                          })
                        }
                      />
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={formData.infra_coax}
                        onCheckedChange={(checked) =>
                          setFormData({
                            ...formData,
                            infra_coax: checked,
                            infra_coax_quantity: checked ? 1 : 0
                          })
                        }
                      />
                      <Label>Coax</Label>
                    </div>
                    {formData.infra_coax && (
                      <Input
                        type="number"
                        min="1"
                        className="w-24"
                        value={formData.infra_coax_quantity}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            infra_coax_quantity: parseInt(e.target.value) || 0
                          })
                        }
                      />
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={formData.infra_opticalcon_duo}
                        onCheckedChange={(checked) =>
                          setFormData({
                            ...formData,
                            infra_opticalcon_duo: checked,
                            infra_opticalcon_duo_quantity: checked ? 1 : 0
                          })
                        }
                      />
                      <Label>OpticalCon Duo</Label>
                    </div>
                    {formData.infra_opticalcon_duo && (
                      <Input
                        type="number"
                        min="1"
                        className="w-24"
                        value={formData.infra_opticalcon_duo_quantity}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            infra_opticalcon_duo_quantity: parseInt(e.target.value) || 0
                          })
                        }
                      />
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor="infra_analog">Analog Lines</Label>
                  <Input
                    id="infra_analog"
                    type="number"
                    min="0"
                    value={formData.infra_analog}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        infra_analog: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="other_infrastructure">Other Infrastructure</Label>
                <Input
                  id="other_infrastructure"
                  value={formData.other_infrastructure}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      other_infrastructure: e.target.value,
                    })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                className="w-full min-h-[100px] px-3 py-2 border rounded-md"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
              />
            </div>

            <div className="flex justify-end gap-2">
              {artist?.id && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setFormLinkDialogOpen(true)}
                >
                  Generate Form Link
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {artist && (
        <ArtistFormLinkDialog
          open={formLinkDialogOpen}
          onOpenChange={setFormLinkDialogOpen}
          artistId={artist.id}
          artistName={artist.name}
        />
      )}
    </>
  );
};
