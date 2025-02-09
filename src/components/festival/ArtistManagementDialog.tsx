
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

interface ArtistManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  artist?: any;
  jobId?: string;
  start_time?: string;
  end_time?: string;
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
  start_time,
  end_time
}: ArtistManagementDialogProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: artist?.name || "",
    stage: artist?.stage || "",
    show_start: artist?.show_start || "",
    show_end: artist?.show_end || "",
    soundcheck: artist?.soundcheck || false,
    soundcheck_start: artist?.soundcheck_start || "",
    soundcheck_end: artist?.soundcheck_end || "",
    foh_console: artist?.foh_console || "",
    mon_console: artist?.mon_console || "",
    wireless_model: artist?.wireless_model || "",
    wireless_quantity_hh: artist?.wireless_quantity_hh || 0,
    wireless_quantity_bp: artist?.wireless_quantity_bp || 0,
    wireless_band: artist?.wireless_band || "",
    iem_model: artist?.iem_model || "",
    iem_quantity: artist?.iem_quantity || 0,
    iem_band: artist?.iem_band || "",
    monitors_enabled: artist?.monitors_enabled || false,
    monitors_quantity: artist?.monitors_quantity || 0,
    extras_sf: artist?.extras_sf || false,
    extras_df: artist?.extras_df || false,
    extras_djbooth: artist?.extras_djbooth || false,
    extras_wired: artist?.extras_wired || "",
    infra_cat6: artist?.infra_cat6 || false,
    infra_cat6_quantity: artist?.infra_cat6_quantity || 0,
    infra_hma: artist?.infra_hma || false,
    infra_hma_quantity: artist?.infra_hma_quantity || 0,
    infra_coax: artist?.infra_coax || false,
    infra_coax_quantity: artist?.infra_coax_quantity || 0,
    infra_analog: artist?.infra_analog || 0,
    infra_opticalcon_duo: artist?.infra_opticalcon_duo || false,
    infra_opticalcon_duo_quantity: artist?.infra_opticalcon_duo_quantity || 0,
    other_infrastructure: artist?.other_infrastructure || "",
    notes: artist?.notes || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobId) return;

    setIsLoading(true);
    try {
      console.log("Submitting artist data:", formData);
      const data = {
        ...formData,
        job_id: jobId,
        stage: formData.stage ? parseInt(formData.stage) : null,
        show_start: formData.show_start || null,
        show_end: formData.show_end || null,
        soundcheck_start: formData.soundcheck_start || null,
        soundcheck_end: formData.soundcheck_end || null,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {artist?.id ? "Edit Artist" : "Add New Artist"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Basic Information */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Artist Name</Label>
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
                <Label htmlFor="stage">Stage Number (1-4)</Label>
                <Input
                  id="stage"
                  type="number"
                  min="1"
                  max="4"
                  value={formData.stage}
                  onChange={(e) =>
                    setFormData({ ...formData, stage: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="show_start">Show Start</Label>
                  <Input
                    id="show_start"
                    type="time"
                    value={formData.show_start}
                    onChange={(e) =>
                      setFormData({ ...formData, show_start: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="show_end">Show End</Label>
                  <Input
                    id="show_end"
                    type="time"
                    value={formData.show_end}
                    onChange={(e) =>
                      setFormData({ ...formData, show_end: e.target.value })
                    }
                  />
                </div>
              </div>
              
              {/* Soundcheck Section */}
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

            {/* Technical Setup */}
            <div className="space-y-4">
              <div>
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
              </div>
              <div>
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
              </div>
            </div>
          </div>

          {/* RF and Wireless Section */}
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

          {/* Monitor Setup */}
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

          {/* Extra Requirements */}
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

          {/* Infrastructure */}
          <div className="border rounded-lg p-4 space-y-4">
            <h3 className="text-lg font-medium">Infrastructure</h3>
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

          {/* Notes */}
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
  );
};
