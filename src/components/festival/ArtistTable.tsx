import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Edit2, Loader2, Mic, Headphones, FileText, Trash2, ChevronDown, ChevronUp, Printer, Link2 } from "lucide-react";
import { format } from "date-fns";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { ArtistFileDialog } from "./ArtistFileDialog";
import { cn } from "@/lib/utils";
import { ArtistPdfData, exportArtistPDF } from "@/utils/artistPdfExport";
import { useToast } from "@/hooks/use-toast";
import { FestivalGearSetup } from "@/types/festival";
import { supabase } from "@/lib/supabase";
import { ArtistFormLinkDialog } from "./ArtistFormLinkDialog";
import { FormStatusBadge } from "./FormStatusBadge";
import { ArtistFormSubmissionDialog } from "./ArtistFormSubmissionDialog";
import { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

interface ArtistTableProps {
  artists: any[];
  isLoading: boolean;
  onEditArtist: (artist: any) => void;
  onDeleteArtist: (artist: any) => void;
  searchTerm: string;
  stageFilter: string;
  equipmentFilter: string;
}

type FormStatus = "pending" | "submitted" | "expired";

type FormStatusType = {
  [key: string]: { 
    status: FormStatus;
    hasSubmission: boolean;
  };
};

type FormStatusPayload = RealtimePostgresChangesPayload<{
  artist_id: string;
  status: string;
  id: string;
}>;

type SubmissionPayload = RealtimePostgresChangesPayload<{
  form_id: string;
  id: string;
}>;

export const ArtistTable = ({ 
  artists, 
  isLoading, 
  onEditArtist,
  onDeleteArtist,
  searchTerm,
  stageFilter,
  equipmentFilter
}: ArtistTableProps) => {
  const { toast } = useToast();
  const [expandedRows, setExpandedRows] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState<any>(null);
  const [fileDialogOpen, setFileDialogOpen] = useState(false);
  const [selectedArtistForFiles, setSelectedArtistForFiles] = useState<string>("");
  const [gearSetup, setGearSetup] = useState<FestivalGearSetup | null>(null);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [selectedArtistForForm, setSelectedArtistForForm] = useState<string>("");
  const [submissionDialogOpen, setSubmissionDialogOpen] = useState(false);
  const [selectedArtistForSubmission, setSelectedArtistForSubmission] = useState<string>("");
  const [formStatuses, setFormStatuses] = useState<FormStatusType>({});

  useEffect(() => {
    const fetchGearSetup = async () => {
      if (artists.length > 0) {
        const { data, error } = await supabase
          .from('festival_gear_setups')
          .select('*')
          .eq('job_id', artists[0].job_id)
          .eq('date', artists[0].date)
          .maybeSingle();

        if (error) {
          console.error('Error fetching gear setup:', error);
          return;
        }

        if (data) {
          setGearSetup(data as FestivalGearSetup);
        }
      }
    };

    fetchGearSetup();
  }, [artists]);

  useEffect(() => {
    const fetchFormStatuses = async () => {
      const artistIds = artists.map(artist => artist.id);
      if (artistIds.length === 0) return;

      const { data: formsData, error: formsError } = await supabase
        .from('festival_artist_forms')
        .select(`
          artist_id,
          status,
          id,
          submissions:festival_artist_form_submissions(id)
        `)
        .in('artist_id', artistIds)
        .order('created_at', { ascending: false });

      if (formsError) {
        console.error('Error fetching form statuses:', formsError);
        return;
      }

      const statusMap: FormStatusType = {};
      formsData?.forEach(form => {
        if (!statusMap[form.artist_id]) {
          const status = (form.status as FormStatus) || "pending";
          statusMap[form.artist_id] = {
            status,
            hasSubmission: form.submissions && form.submissions.length > 0
          };
        }
      });

      setFormStatuses(statusMap);
    };

    fetchFormStatuses();
  }, [artists]);

  useEffect(() => {
    const artistIds = artists.map(artist => artist.id);
    if (artistIds.length === 0) return;

    const formChannel = supabase
      .channel('form-status-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'festival_artist_forms',
          filter: `artist_id=in.(${artistIds.join(',')})`,
        },
        async (payload: FormStatusPayload) => {
          console.log('Form status changed:', payload);
          if (!payload.new || !('artist_id' in payload.new)) return;
          
          const { data: formsData } = await supabase
            .from('festival_artist_forms')
            .select(`
              artist_id,
              status,
              id,
              submissions:festival_artist_form_submissions(id)
            `)
            .eq('artist_id', payload.new.artist_id)
            .single();

          if (formsData) {
            setFormStatuses(prev => ({
              ...prev,
              [formsData.artist_id]: {
                status: formsData.status as FormStatus,
                hasSubmission: formsData.submissions && formsData.submissions.length > 0
              }
            }));
          }
        }
      )
      .subscribe();

    const submissionChannel = supabase
      .channel('submission-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'festival_artist_form_submissions',
        },
        async (payload: SubmissionPayload) => {
          console.log('Form submission changed:', payload);
          if (!payload.new || !('form_id' in payload.new)) return;

          const { data: formData } = await supabase
            .from('festival_artist_forms')
            .select(`
              artist_id,
              status,
              id,
              submissions:festival_artist_form_submissions(id)
            `)
            .eq('id', payload.new.form_id)
            .single();

          if (formData) {
            setFormStatuses(prev => ({
              ...prev,
              [formData.artist_id]: {
                status: formData.status,
                hasSubmission: true
              }
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(formChannel);
      supabase.removeChannel(submissionChannel);
    };
  }, [artists]);

  const toggleRowExpansion = (artistId: string) => {
    setExpandedRows(prev => 
      prev.includes(artistId) 
        ? prev.filter(id => id !== artistId)
        : [...prev, artistId]
    );
  };

  const handleDeleteClick = (artist: any) => {
    setSelectedArtist(artist);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (selectedArtist) {
      onDeleteArtist(selectedArtist);
    }
    setDeleteDialogOpen(false);
    setSelectedArtist(null);
  };

  const handlePrintArtist = async (artist: any) => {
    try {
      const artistData: ArtistPdfData = {
        name: artist.name,
        stage: artist.stage,
        date: artist.date,
        schedule: {
          show: {
            start: artist.show_start,
            end: artist.show_end
          },
          soundcheck: artist.soundcheck ? {
            start: artist.soundcheck_start,
            end: artist.soundcheck_end
          } : undefined
        },
        technical: {
          fohTech: artist.foh_tech,
          monTech: artist.mon_tech,
          fohConsole: {
            model: artist.foh_console,
            providedBy: artist.foh_console_provided_by
          },
          monConsole: {
            model: artist.mon_console,
            providedBy: artist.mon_console_provided_by
          },
          wireless: {
            model: artist.wireless_model,
            providedBy: artist.wireless_provided_by,
            handhelds: artist.wireless_quantity_hh,
            bodypacks: artist.wireless_quantity_bp,
            band: artist.wireless_band
          },
          iem: {
            model: artist.iem_model,
            providedBy: artist.iem_provided_by,
            quantity: artist.iem_quantity,
            band: artist.iem_band
          },
          monitors: {
            enabled: artist.monitors_enabled,
            quantity: artist.monitors_quantity || 0
          }
        },
        infrastructure: {
          providedBy: artist.infrastructure_provided_by,
          cat6: {
            enabled: artist.infra_cat6,
            quantity: artist.infra_cat6_quantity || 0
          },
          hma: {
            enabled: artist.infra_hma,
            quantity: artist.infra_hma_quantity || 0
          },
          coax: {
            enabled: artist.infra_coax,
            quantity: artist.infra_coax_quantity || 0
          },
          opticalconDuo: {
            enabled: artist.infra_opticalcon_duo,
            quantity: artist.infra_opticalcon_duo_quantity || 0
          },
          analog: artist.infra_analog || 0,
          other: artist.other_infrastructure || ''
        },
        extras: {
          sideFill: artist.extras_sf,
          drumFill: artist.extras_df,
          djBooth: artist.extras_djbooth,
          wired: artist.extras_wired || ''
        },
        notes: artist.notes
      };

      const blob = await exportArtistPDF(artistData);

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${artist.name}_technical_requirements.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: "PDF generated successfully",
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Error",
        description: "Could not generate PDF",
        variant: "destructive",
      });
    }
  };

  const checkGearRequirements = (artist: any) => {
    if (!gearSetup) return {};

    const issues: { [key: string]: boolean } = {};

    if (artist.monitors_enabled && artist.monitors_quantity > gearSetup.available_monitors) {
      issues.monitors = true;
    }

    if (artist.infra_cat6 && artist.infra_cat6_quantity > gearSetup.available_cat6_runs) {
      issues.cat6 = true;
    }
    if (artist.infra_hma && artist.infra_hma_quantity > gearSetup.available_hma_runs) {
      issues.hma = true;
    }
    if (artist.infra_coax && artist.infra_coax_quantity > gearSetup.available_coax_runs) {
      issues.coax = true;
    }
    if (artist.infra_opticalcon_duo && artist.infra_opticalcon_duo_quantity > gearSetup.available_opticalcon_duo_runs) {
      issues.opticalconDuo = true;
    }
    if (artist.infra_analog > gearSetup.available_analog_runs) {
      issues.analog = true;
    }

    if (artist.extras_sf && !gearSetup.has_side_fills) {
      issues.sideFills = true;
    }
    if (artist.extras_df && !gearSetup.has_drum_fills) {
      issues.drumFills = true;
    }
    if (artist.extras_djbooth && !gearSetup.has_dj_booths) {
      issues.djBooth = true;
    }

    return issues;
  };

  const filteredArtists = artists.filter(artist => {
    const matchesSearch = artist.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStage = !stageFilter || artist.stage?.toString() === stageFilter;
    const matchesEquipment = !equipmentFilter || (
      (equipmentFilter === 'wireless' && (artist.wireless_quantity_hh > 0 || artist.wireless_quantity_bp > 0)) ||
      (equipmentFilter === 'iem' && artist.iem_quantity > 0) ||
      (equipmentFilter === 'monitors' && artist.monitors_enabled)
    );
    return matchesSearch && matchesStage && matchesEquipment;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!filteredArtists.length) {
    return (
      <div className="text-center p-4 text-muted-foreground">
        No artists found matching the current filters.
      </div>
    );
  }

  const renderProviderBadge = (provider: string) => (
    <Badge variant={provider === 'festival' ? 'default' : 'secondary'}>
      {provider === 'festival' ? 'Festival' : 'Band'}
    </Badge>
  );

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead></TableHead>
            <TableHead>Artist</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead>Show Time</TableHead>
            <TableHead>Soundcheck</TableHead>
            <TableHead>Technical Setup</TableHead>
            <TableHead>RF/IEM</TableHead>
            <TableHead>Files</TableHead>
            <TableHead>Form Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredArtists.map((artist) => {
            const issues = checkGearRequirements(artist);
            const hasIssues = Object.keys(issues).length > 0;
            const formStatus = formStatuses[artist.id];
            
            return (
              <>
                <TableRow key={artist.id} className={cn(
                  expandedRows.includes(artist.id) && "bg-muted/50",
                  hasIssues && "bg-red-50/50 dark:bg-red-950/20"
                )}>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleRowExpansion(artist.id)}
                    >
                      {expandedRows.includes(artist.id) ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </TableCell>
                  <TableCell className="font-medium">{artist.name}</TableCell>
                  <TableCell>{artist.stage}</TableCell>
                  <TableCell>
                    {artist.show_start && format(new Date(`2000-01-01T${artist.show_start}`), 'HH:mm')} - 
                    {artist.show_end && format(new Date(`2000-01-01T${artist.show_end}`), 'HH:mm')}
                  </TableCell>
                  <TableCell>
                    {artist.soundcheck && (
                      <>
                        {artist.soundcheck_start && format(new Date(`2000-01-01T${artist.soundcheck_start}`), 'HH:mm')} - 
                        {artist.soundcheck_end && format(new Date(`2000-01-01T${artist.soundcheck_end}`), 'HH:mm')}
                      </>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col text-sm gap-1">
                      <div className="flex items-center justify-between">
                        <span>FOH: {artist.foh_console}</span>
                        {renderProviderBadge(artist.foh_console_provided_by)}
                      </div>
                      <div className="flex items-center justify-between">
                        <span>MON: {artist.mon_console}</span>
                        {renderProviderBadge(artist.mon_console_provided_by)}
                      </div>
                      {artist.monitors_enabled && (
                        <span className={cn(
                          "text-xs",
                          issues.monitors ? "text-red-500 dark:text-red-400" : "text-muted-foreground"
                        )}>
                          {artist.monitors_quantity} monitors
                          {issues.monitors && " (exceeds available)"}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-2">
                      {(artist.wireless_quantity_hh > 0 || artist.wireless_quantity_bp > 0) && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1" title="Wireless Mics">
                            <Mic className="h-4 w-4" />
                            <span className="text-xs">
                              HH: {artist.wireless_quantity_hh} / BP: {artist.wireless_quantity_bp}
                            </span>
                          </div>
                          {renderProviderBadge(artist.wireless_provided_by)}
                        </div>
                      )}
                      {artist.iem_quantity > 0 && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1" title="IEM Systems">
                            <Headphones className="h-4 w-4" />
                            <span className="text-xs">{artist.iem_quantity}</span>
                          </div>
                          {renderProviderBadge(artist.iem_provided_by)}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedArtistForFiles(artist.id);
                        setFileDialogOpen(true);
                      }}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      <span className="text-xs">Manage</span>
                    </Button>
                  </TableCell>
                  <TableCell>
                    {formStatus && <FormStatusBadge status={formStatus.status} />}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEditArtist(artist)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteClick(artist)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePrintArtist(artist)}
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedArtistForForm(artist.id);
                          setFormDialogOpen(true);
                        }}
                      >
                        <Link2 className="h-4 w-4" />
                      </Button>
                      {formStatus?.hasSubmission && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedArtistForSubmission(artist.id);
                            setSubmissionDialogOpen(true);
                          }}
                        >
                          <FileText className="h-4 w-4" />
                          <span className="sr-only">View Submission</span>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
                {expandedRows.includes(artist.id) && (
                  <TableRow>
                    <TableCell colSpan={9} className="bg-muted/50">
                      <div className="p-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <h4 className="font-medium mb-2">Infrastructure</h4>
                            <div className="space-y-2">
                              {artist.infra_cat6 && (
                                <div className={cn(issues.cat6 && "text-red-500 dark:text-red-400")}>
                                  CAT6: {artist.infra_cat6_quantity}
                                  {issues.cat6 && " (exceeds available)"}
                                </div>
                              )}
                              {artist.infra_hma && (
                                <div className={cn(issues.hma && "text-red-500 dark:text-red-400")}>
                                  HMA: {artist.infra_hma_quantity}
                                  {issues.hma && " (exceeds available)"}
                                </div>
                              )}
                              {artist.infra_coax && (
                                <div className={cn(issues.coax && "text-red-500 dark:text-red-400")}>
                                  Coax: {artist.infra_coax_quantity}
                                  {issues.coax && " (exceeds available)"}
                                </div>
                              )}
                              {artist.infra_opticalcon_duo && (
                                <div className={cn(issues.opticalconDuo && "text-red-500 dark:text-red-400")}>
                                  OpticalCon Duo: {artist.infra_opticalcon_duo_quantity}
                                  {issues.opticalconDuo && " (exceeds available)"}
                                </div>
                              )}
                              {artist.infra_analog > 0 && (
                                <div className={cn(issues.analog && "text-red-500 dark:text-red-400")}>
                                  Analog Lines: {artist.infra_analog}
                                  {issues.analog && " (exceeds available)"}
                                </div>
                              )}
                            </div>
                          </div>
                          <div>
                            <h4 className="font-medium mb-2">Extra Requirements</h4>
                            <div className="space-y-2">
                              {artist.extras_sf && (
                                <div className={cn(issues.sideFills && "text-red-500 dark:text-red-400")}>
                                  Side Fill
                                  {issues.sideFills && " (not available)"}
                                </div>
                              )}
                              {artist.extras_df && (
                                <div className={cn(issues.drumFills && "text-red-500 dark:text-red-400")}>
                                  Drum Fill
                                  {issues.drumFills && " (not available)"}
                                </div>
                              )}
                              {artist.extras_djbooth && (
                                <div className={cn(issues.djBooth && "text-red-500 dark:text-red-400")}>
                                  DJ Booth
                                  {issues.djBooth && " (not available)"}
                                </div>
                              )}
                              {artist.extras_wired && (
                                <div>Additional Wired: {artist.extras_wired}</div>
                              )}
                            </div>
                          </div>
                        </div>
                        {artist.notes && (
                          <div>
                            <h4 className="font-medium mb-2">Notes</h4>
                            <p className="text-sm text-muted-foreground">{artist.notes}</p>
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            );
          })}
        </TableBody>
      </Table>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Artist</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedArtist?.name}? This action cannot be undone and will delete all associated files and forms.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ArtistFileDialog
        open={fileDialogOpen}
        onOpenChange={setFileDialogOpen}
        artistId={selectedArtistForFiles}
      />

      <ArtistFormLinkDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        artistId={selectedArtistForForm}
        artistName={artists.find(a => a.id === selectedArtistForForm)?.name || ''}
      />

      <ArtistFormSubmissionDialog
        open={submissionDialogOpen}
        onOpenChange={setSubmissionDialogOpen}
        artistId={selectedArtistForSubmission}
      />
    </>
  );
};
