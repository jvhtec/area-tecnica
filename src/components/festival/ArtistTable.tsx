import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, FileText, Loader2, Mic, Link, ExternalLink, Upload, Printer } from "lucide-react";
import { format, parseISO, isAfter, setHours, setMinutes } from "date-fns";
import { ArtistFormLinkDialog } from "./ArtistFormLinkDialog";
import { ArtistFormLinksDialog } from "./ArtistFormLinksDialog";
import { ArtistFileDialog } from "./ArtistFileDialog";
import { exportArtistPDF, ArtistPdfData } from "@/utils/artistPdfExport";
import { sortArtistsChronologically } from "@/utils/artistSorting";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { fetchJobLogo } from "@/utils/pdf/logoUtils";
import { compareArtistRequirements, ArtistGearComparison } from "@/utils/gearComparisonService";
import { GearMismatchIndicator } from "./GearMismatchIndicator";
import { FestivalGearSetup, StageGearSetup } from "@/types/festival";
import { buildReadableFilename } from "@/utils/fileName";

interface Artist {
  id: string;
  name: string;
  stage: number;
  date: string;
  show_start: string;
  show_end: string;
  soundcheck: boolean;
  soundcheck_start?: string;
  soundcheck_end?: string;
  foh_console: string;
  foh_console_provided_by?: 'festival' | 'band' | 'mixed';
  mon_console: string;
  mon_console_provided_by?: 'festival' | 'band' | 'mixed';
  wireless_systems: any[];
  wireless_provided_by?: 'festival' | 'band' | 'mixed';
  iem_systems: any[];
  iem_provided_by?: 'festival' | 'band' | 'mixed';
  monitors_enabled: boolean;
  monitors_quantity: number;
  extras_sf: boolean;
  extras_df: boolean;
  extras_djbooth: boolean;
  notes?: string;
  rider_missing?: boolean;
  foh_tech?: boolean;
  mon_tech?: boolean;
  isaftermidnight?: boolean;
  mic_kit?: 'festival' | 'band' | 'mixed';
  wired_mics?: Array<{
    model: string;
    quantity: number;
    exclusive_use?: boolean;
    notes?: string;
  }>;
  job_id?: string;
  // Infrastructure fields
  infra_cat6?: boolean;
  infra_cat6_quantity?: number;
  infra_hma?: boolean;
  infra_hma_quantity?: number;
  infra_coax?: boolean;
  infra_coax_quantity?: number;
  infra_opticalcon_duo?: boolean;
  infra_opticalcon_duo_quantity?: number;
  infra_analog?: number;
  other_infrastructure?: string;
  infrastructure_provided_by?: 'festival' | 'band' | 'mixed';
  artist_submitted?: boolean;
  form_language?: "es" | "en";
}

interface ArtistTableProps {
  artists: Artist[];
  isLoading: boolean;
  onEditArtist: (artist: Artist) => void;
  onDeleteArtist: (artist: Artist) => void;
  searchTerm: string;
  stageFilter: string;
  equipmentFilter: string;
  riderFilter: string;
  dayStartTime: string;
  jobId?: string;
  selectedDate?: string;
}

export const ArtistTable = ({
  artists,
  isLoading,
  onEditArtist,
  onDeleteArtist,
  searchTerm,
  stageFilter,
  equipmentFilter,
  riderFilter,
  dayStartTime,
  jobId,
  selectedDate
}: ArtistTableProps) => {
  const [deletingArtistId, setDeletingArtistId] = useState<string | null>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linksDialogOpen, setLinksDialogOpen] = useState(false);
  const [fileDialogOpen, setFileDialogOpen] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);
  const [printingArtistId, setPrintingArtistId] = useState<string | null>(null);
  const [stageNames, setStageNames] = useState<Record<number, string>>({});
  const [gearComparisons, setGearComparisons] = useState<Record<string, ArtistGearComparison>>({});
  const [festivalGearSetup, setFestivalGearSetup] = useState<FestivalGearSetup | null>(null);
  const [stageGearSetups, setStageGearSetups] = useState<Record<number, StageGearSetup>>({});

  // Fetch custom stage names
  useEffect(() => {
    const fetchStageNames = async () => {
      if (!jobId) return;
      
      const { data: stages, error } = await supabase
        .from('festival_stages')
        .select('number, name')
        .eq('job_id', jobId);
        
      if (error) {
        console.error('Error fetching stage names:', error);
        return;
      }
      
      const stageMap: Record<number, string> = {};
      stages?.forEach(stage => {
        stageMap[stage.number] = stage.name;
      });
      setStageNames(stageMap);
    };
    
    fetchStageNames();
  }, [jobId]);

  // Fetch festival gear setup and stage-specific setups
  useEffect(() => {
    const fetchGearSetups = async () => {
      if (!jobId) return;

      try {
        // Fetch main festival gear setup
        const { data: mainSetup, error: mainError } = await supabase
          .from('festival_gear_setups')
          .select('*')
          .eq('job_id', jobId)
          .single();

        if (mainError && mainError.code !== 'PGRST116') {
          console.error('Error fetching festival gear setup:', mainError);
          return;
        }

        setFestivalGearSetup(mainSetup);

        // Fetch stage-specific setups if main setup exists
        if (mainSetup) {
          const { data: stageSetups, error: stageError } = await supabase
            .from('festival_stage_gear_setups')
            .select('*')
            .eq('gear_setup_id', mainSetup.id);

          if (stageError) {
            console.error('Error fetching stage gear setups:', stageError);
          } else {
            const stageSetupsMap: Record<number, StageGearSetup> = {};
            stageSetups?.forEach(setup => {
              stageSetupsMap[setup.stage_number] = setup;
            });
            setStageGearSetups(stageSetupsMap);
          }
        }
      } catch (error) {
        console.error('Error fetching gear setups:', error);
      }
    };

    fetchGearSetups();
  }, [jobId]);

  // Run gear comparison for all artists when gear setups or artists change
  useEffect(() => {
    if (!festivalGearSetup || artists.length === 0) {
      setGearComparisons({});
      return;
    }

    const comparisons: Record<string, ArtistGearComparison> = {};
    
    artists.forEach(artist => {
      const stageSetup = stageGearSetups[artist.stage] || null;
      
      // Transform artist to match ArtistRequirements interface
      const artistRequirements = {
        name: artist.name,
        stage: artist.stage,
        foh_console: artist.foh_console,
        foh_console_provided_by: artist.foh_console_provided_by,
        mon_console: artist.mon_console,
        mon_console_provided_by: artist.mon_console_provided_by,
        wireless_systems: artist.wireless_systems || [],
        wireless_provided_by: artist.wireless_provided_by,
        iem_systems: artist.iem_systems || [],
        iem_provided_by: artist.iem_provided_by,
        monitors_enabled: artist.monitors_enabled,
        monitors_quantity: artist.monitors_quantity,
        extras_sf: artist.extras_sf,
        extras_df: artist.extras_df,
        extras_djbooth: artist.extras_djbooth,
        infra_cat6: artist.infra_cat6 || false,
        infra_cat6_quantity: artist.infra_cat6_quantity || 0,
        infra_hma: artist.infra_hma || false,
        infra_hma_quantity: artist.infra_hma_quantity || 0,
        infra_coax: artist.infra_coax || false,
        infra_coax_quantity: artist.infra_coax_quantity || 0,
        infra_opticalcon_duo: artist.infra_opticalcon_duo || false,
        infra_opticalcon_duo_quantity: artist.infra_opticalcon_duo_quantity || 0,
        infra_analog: artist.infra_analog || 0,
        infrastructure_provided_by: artist.infrastructure_provided_by,
        mic_kit: artist.mic_kit || 'band',
        wired_mics: artist.wired_mics || []
      };
      
      const comparison = compareArtistRequirements(artistRequirements, festivalGearSetup, stageSetup);
      comparisons[artist.id] = comparison;
    });

    setGearComparisons(comparisons);
  }, [artists, festivalGearSetup, stageGearSetups]);

  // Helper function to get stage display name
  const getStageDisplayName = (stageNumber: number) => {
    return stageNames[stageNumber] || `Stage ${stageNumber}`;
  };


  // Helper function to format infrastructure requirements
  const formatInfrastructure = (artist: Artist) => {
    const infraItems: string[] = [];
    
    if (artist.infra_cat6 && artist.infra_cat6_quantity) {
      infraItems.push(`${artist.infra_cat6_quantity}x CAT6`);
    }
    if (artist.infra_hma && artist.infra_hma_quantity) {
      infraItems.push(`${artist.infra_hma_quantity}x HMA`);
    }
    if (artist.infra_coax && artist.infra_coax_quantity) {
      infraItems.push(`${artist.infra_coax_quantity}x Coax`);
    }
    if (artist.infra_opticalcon_duo && artist.infra_opticalcon_duo_quantity) {
      infraItems.push(`${artist.infra_opticalcon_duo_quantity}x OpticalCON DUO`);
    }
    if (artist.infra_analog && artist.infra_analog > 0) {
      infraItems.push(`${artist.infra_analog}x Analog`);
    }
    if (artist.other_infrastructure) {
      infraItems.push(artist.other_infrastructure);
    }


    return infraItems.length > 0 ? infraItems.join(", ") : "Ninguno";
  };

  // Helper function to truncate notes for display
  const formatNotes = (notes?: string) => {
    if (!notes || notes.trim() === '') return "Sin notas";
    return notes.length > 50 ? `${notes.substring(0, 50)}...` : notes;
  };

  // Filtering logic
  const isTimeAfterDayStart = (time: string, date: string) => {
    const [hours, minutes] = dayStartTime.split(':').map(Number);
    const dayStart = setHours(setMinutes(parseISO(date), minutes), hours);
    const artistTime = parseISO(`${date}T${time}`);
    return isAfter(artistTime, dayStart);
  };
  const filteredArtists = artists.filter(artist => {
    const matchesSearch = artist.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStage = stageFilter === "all" || artist.stage?.toString() === stageFilter;
    const matchesEquipment = !equipmentFilter || artist.foh_console.toLowerCase().includes(equipmentFilter.toLowerCase()) || artist.mon_console.toLowerCase().includes(equipmentFilter.toLowerCase()) || artist.wired_mics && artist.wired_mics.some(mic => mic.model.toLowerCase().includes(equipmentFilter.toLowerCase()));
    const matchesRider = riderFilter === "all" || riderFilter === "missing" && artist.rider_missing || riderFilter === "complete" && !artist.rider_missing;
    return matchesSearch && matchesStage && matchesEquipment && matchesRider;
  });

  // Apply chronological sorting to filtered artists using imported utility
  const sortedFilteredArtists = sortArtistsChronologically(filteredArtists as any) as Artist[];
  const hasArtistSubmittedData = sortedFilteredArtists.some((artist) => artist.artist_submitted);
  const handleDeleteClick = async (artist: Artist) => {
    if (window.confirm(`¿Estás seguro de que quieres eliminar ${artist.name}?`)) {
      setDeletingArtistId(artist.id);
      await onDeleteArtist(artist);
      setDeletingArtistId(null);
    }
  };
  const formatWiredMics = (mics: Array<{
    model: string;
    quantity: number;
    exclusive_use?: boolean;
  }> = []) => {
    if (mics.length === 0) return "Ninguno";
    return mics.map(mic => {
      const exclusiveIndicator = mic.exclusive_use ? " (E)" : "";
      return `${mic.quantity}x ${mic.model}${exclusiveIndicator}`;
    }).join(", ");
  };
  const formatWirelessSystems = (systems: any[] = [], isIEM = false) => {
    if (systems.length === 0) return "Ninguno";
    return systems.map(system => {
      if (isIEM) {
        // For IEM: show channels and beltpacks
        const channels = system.quantity_hh || system.quantity || 0;
        const beltpacks = system.quantity_bp || 0;
        return `${system.model}: ${channels} ch${beltpacks > 0 ? `, ${beltpacks} bp` : ''}`;
      } else {
        // For wireless: show HH and BP
        const hh = system.quantity_hh || 0;
        const bp = system.quantity_bp || 0;
        const total = hh + bp;
        if (hh > 0 && bp > 0) {
          return `${system.model}: ${hh}x HH, ${bp}x BP`;
        } else if (total > 0) {
          return `${system.model}: ${total}x`;
        }
        return system.model;
      }
    }).join("; ");
  };
  const getProviderBadge = (provider: 'festival' | 'band' | 'mixed') => {
    const colors = {
      festival: "bg-blue-100 text-blue-800",
      band: "bg-green-100 text-green-800",
      mixed: "bg-purple-100 text-purple-800",
      artist: "bg-orange-100 text-orange-800"
    };
    return colors[provider] || "bg-gray-100 text-gray-800";
  };

  // Helper function to transform artist data for PDF with logo URL
  const transformArtistDataForPdf = async (artist: Artist): Promise<ArtistPdfData> => {
    let logoUrl: string | undefined;
    
    if (jobId) {
      try {
        logoUrl = await fetchJobLogo(jobId);
        console.log('Fetched logo URL for PDF:', logoUrl);
      } catch (error) {
        console.error('Error fetching logo for PDF:', error);
      }
    }

    return {
      name: artist.name,
      stage: artist.stage,
      date: artist.date,
      schedule: {
        show: {
          start: artist.show_start,
          end: artist.show_end
        },
        soundcheck: artist.soundcheck ? {
          start: artist.soundcheck_start || '',
          end: artist.soundcheck_end || ''
        } : undefined
      },
      technical: {
        fohTech: artist.foh_tech || false,
        monTech: artist.mon_tech || false,
        fohConsole: {
          model: artist.foh_console,
          providedBy: artist.foh_console_provided_by || 'festival'
        },
        monConsole: {
          model: artist.mon_console,
          providedBy: artist.mon_console_provided_by || 'festival'
        },
        wireless: {
          systems: artist.wireless_systems || [],
          providedBy: artist.wireless_provided_by || 'festival'
        },
        iem: {
          systems: artist.iem_systems || [],
          providedBy: artist.iem_provided_by || 'festival'
        },
        monitors: {
          enabled: artist.monitors_enabled,
          quantity: artist.monitors_quantity
        }
      },
      infrastructure: {
        providedBy: artist.infrastructure_provided_by || 'festival',
        cat6: {
          enabled: artist.infra_cat6 || false,
          quantity: artist.infra_cat6_quantity || 0
        },
        hma: {
          enabled: artist.infra_hma || false,
          quantity: artist.infra_hma_quantity || 0
        },
        coax: {
          enabled: artist.infra_coax || false,
          quantity: artist.infra_coax_quantity || 0
        },
        opticalconDuo: {
          enabled: artist.infra_opticalcon_duo || false,
          quantity: artist.infra_opticalcon_duo_quantity || 0
        },
        analog: artist.infra_analog || 0,
        other: artist.other_infrastructure || ''
      },
      extras: {
        sideFill: artist.extras_sf,
        drumFill: artist.extras_df,
        djBooth: artist.extras_djbooth,
        wired: ''
      },
      notes: artist.notes || '',
      wiredMics: artist.wired_mics || [],
      logoUrl: logoUrl,
      micKit: artist.mic_kit || 'band',
      riderMissing: artist.rider_missing || false
    };
  };

  const handlePrintArtist = async (artist: Artist) => {
    setPrintingArtistId(artist.id);
    try {
      const pdfData = await transformArtistDataForPdf(artist);
      
      // Remove the gearComparison assignment as it doesn't exist in ArtistPdfData
      const blob = await exportArtistPDF(pdfData, {
        language: artist.form_language === "en" ? "en" : "es",
      });

      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = buildReadableFilename([artist.name, "Requisitos técnicos"]);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);


      toast.success(`PDF generado para ${artist.name}`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Error al generar PDF');
    } finally {
      setPrintingArtistId(null);
    }
  };
  const handleGenerateLink = (artist: Artist) => {
    setSelectedArtist(artist);
    setLinkDialogOpen(true);
  };
  const handleViewLinks = () => {
    setLinksDialogOpen(true);
  };
  const handleManageFiles = (artist: Artist) => {
    setSelectedArtist(artist);
    setFileDialogOpen(true);
  };
  if (isLoading) {
    return <div className="w-full">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Cargando artistas...</span>
        </div>
      </div>;
  }
  return (
    <>
      <TooltipProvider>
        <div className="w-full space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between py-4 px-2">
            <h2 className="text-xl md:text-2xl font-semibold leading-none tracking-tight">
              Cronograma de artistas ({sortedFilteredArtists.length} artistas)
            </h2>
            <Button variant="outline" size="sm" onClick={handleViewLinks} className="hidden md:flex">
              <ExternalLink className="h-4 w-4 mr-2" />
              Ver todos los enlaces
            </Button>
            <Button variant="outline" size="icon" onClick={handleViewLinks} className="md:hidden">
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>

          {hasArtistSubmittedData && (
            <div className="px-2">
              <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Parte de la información mostrada fue enviada por artistas mediante formulario público.
              </div>
            </div>
          )}

          {/* Desktop Table */}
          <div className="hidden md:block w-full overflow-x-auto">
            <Table className="w-full min-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[140px]">Artista</TableHead>
                  <TableHead className="min-w-[80px]">Stage</TableHead>
                  <TableHead className="min-w-[100px]">Hora del show</TableHead>
                  <TableHead className="min-w-[100px]">Soundcheck</TableHead>
                  <TableHead className="min-w-[200px]">Consolas</TableHead>
                  <TableHead className="min-w-[180px]">Wireless/IEM</TableHead>
                  <TableHead className="min-w-[140px]">
                    <div className="flex items-center gap-1">
                      <Mic className="h-4 w-4" />
                      Micrófonos
                    </div>
                  </TableHead>
                  <TableHead className="min-w-[80px]">Monitores</TableHead>
                  <TableHead className="min-w-[160px]">Infraestructura</TableHead>
                  <TableHead className="min-w-[80px]">Extras</TableHead>
                  <TableHead className="min-w-[120px]">Notas</TableHead>
                  <TableHead className="min-w-[80px]">Estado</TableHead>
                  <TableHead className="min-w-[100px]">Estado del equipo</TableHead>
                  <TableHead className="min-w-[200px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedFilteredArtists.map(artist => {
                  const gearComparison = gearComparisons[artist.id];
                  
                  return (
                    <TableRow key={artist.id}>
                      <TableCell className="min-w-[140px]">
                        <div className="space-y-1">
                          <div className="font-medium">{artist.name}</div>
                          {artist.artist_submitted && (
                            <Badge variant="outline" className="text-xs bg-amber-100 text-amber-900 border-amber-300">
                              Enviado por artista
                            </Badge>
                          )}
                          {artist.isaftermidnight && <Badge variant="outline" className="text-xs bg-blue-700">Después de medianoche</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[80px]">
                        <Badge variant="outline">{getStageDisplayName(artist.stage)}</Badge>
                      </TableCell>
                      <TableCell className="min-w-[100px]">
                        <div className="text-sm">
                          {artist.show_start} - {artist.show_end}
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[100px]">
                        {artist.soundcheck ? (
                          <div className="text-sm">
                            <Badge variant="secondary">Sí</Badge>
                            <div className="text-xs text-muted-foreground">
                              {artist.soundcheck_start} - {artist.soundcheck_end}
                            </div>
                          </div>
                        ) : (
                          <Badge variant="outline">No</Badge>
                        )}
                      </TableCell>
                      
                      <TableCell className="min-w-[200px]">
                        <div className="text-sm space-y-1">
                          <div className="flex items-center gap-1 flex-wrap">
                            <span>FOH: {artist.foh_console || "No especificado"}</span>
                            {artist.foh_console_provided_by && (
                              <Badge variant="outline" className={`text-xs ${getProviderBadge(artist.foh_console_provided_by)}`}>
                                {artist.foh_console_provided_by}
                              </Badge>
                            )}
                            {artist.foh_tech && <Badge variant="outline" className="text-xs">Técnico</Badge>}
                          </div>
                          <div className="flex items-center gap-1 flex-wrap">
                            <span>MON: {artist.mon_console || "No especificado"}</span>
                            {artist.mon_console_provided_by && (
                              <Badge variant="outline" className={`text-xs ${getProviderBadge(artist.mon_console_provided_by)}`}>
                                {artist.mon_console_provided_by}
                              </Badge>
                            )}
                            {artist.mon_tech && <Badge variant="outline" className="text-xs">Técnico</Badge>}
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell className="min-w-[180px]">
                        <div className="text-sm space-y-1">
                          {artist.wireless_systems && artist.wireless_systems.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap">
                              <div className="text-xs" title={formatWirelessSystems(artist.wireless_systems)}>
                                Wireless: {formatWirelessSystems(artist.wireless_systems)}
                              </div>
                              {artist.wireless_provided_by && (
                                <Badge variant="outline" className={`text-xs ${getProviderBadge(artist.wireless_provided_by)}`}>
                                  {artist.wireless_provided_by === 'mixed' ? 'Mixed' : artist.wireless_provided_by}
                                </Badge>
                              )}
                            </div>
                          )}
                          {artist.iem_systems && artist.iem_systems.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap">
                              <div className="text-xs" title={formatWirelessSystems(artist.iem_systems, true)}>
                                IEM: {formatWirelessSystems(artist.iem_systems, true)}
                              </div>
                              {artist.iem_provided_by && (
                                <Badge variant="outline" className={`text-xs ${getProviderBadge(artist.iem_provided_by)}`}>
                                  {artist.iem_provided_by === 'mixed' ? 'Mixed' : artist.iem_provided_by}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="min-w-[140px]">
                        <div className="text-sm space-y-1">
                          <Badge variant={
                            artist.mic_kit === 'festival' ? 'default' : 
                            artist.mic_kit === 'mixed' ? 'secondary' : 
                            'outline'
                          } className={
                            artist.mic_kit === 'mixed' ? 'bg-purple-100 text-purple-800' : ''
                          }>
                            {artist.mic_kit === 'festival' ? 'Festival' : 
                             artist.mic_kit === 'mixed' ? 'Mixed' : 
                             'Band'}
                          </Badge>
                          {(artist.mic_kit === 'festival' || artist.mic_kit === 'mixed') && artist.wired_mics && artist.wired_mics.length > 0 && (
                            <div className="text-xs text-muted-foreground max-w-32 truncate" title={formatWiredMics(artist.wired_mics)}>
                              {formatWiredMics(artist.wired_mics)}
                            </div>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="min-w-[80px]">
                        {artist.monitors_enabled ? (
                          <div className="text-sm">
                            <Badge variant="secondary">{artist.monitors_quantity}x</Badge>
                          </div>
                        ) : (
                          <Badge variant="outline">Ninguno</Badge>
                        )}
                      </TableCell>

                      {/* Infrastructure Column */}
                      <TableCell className="min-w-[160px]">
                        <div className="text-sm space-y-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="text-xs text-muted-foreground max-w-36 truncate cursor-help">
                                {formatInfrastructure(artist)}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="max-w-sm">
                                <p className="font-medium">Requisitos de infraestructura:</p>
                                <p>{formatInfrastructure(artist)}</p>
                                {artist.infrastructure_provided_by && (
                                  <p className="text-xs mt-1">Provisto por: {artist.infrastructure_provided_by}</p>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                          {artist.infrastructure_provided_by && (
                            <Badge variant="outline" className={`text-xs ${getProviderBadge(artist.infrastructure_provided_by)}`}>
                              {artist.infrastructure_provided_by}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      
                      <TableCell className="min-w-[80px]">
                        <div className="text-xs space-y-1 flex flex-wrap gap-1">
                          {artist.extras_sf && <Badge variant="outline" className="text-xs">SF</Badge>}
                          {artist.extras_df && <Badge variant="outline" className="text-xs">DF</Badge>}
                          {artist.extras_djbooth && <Badge variant="outline" className="text-xs">DJ</Badge>}
                        </div>
                      </TableCell>

                      {/* Notes Column */}
                      <TableCell className="min-w-[120px]">
                        {artist.notes && artist.notes.trim() !== '' ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="text-xs text-muted-foreground max-w-28 truncate cursor-help">
                                {formatNotes(artist.notes)}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="max-w-sm">
                                <p className="font-medium">Notas:</p>
                                <p className="whitespace-pre-wrap">{artist.notes}</p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-xs text-muted-foreground">Sin notas</span>
                        )}
                      </TableCell>

                      <TableCell className="min-w-[80px]">
                        <Badge variant={artist.rider_missing ? "destructive" : "default"}>
                          {artist.rider_missing ? "Faltante" : "Completo"}
                        </Badge>
                      </TableCell>

                      {/* New Gear Status Column */}
                      <TableCell className="min-w-[100px]">
                        {gearComparison ? (
                          <GearMismatchIndicator mismatches={gearComparison.mismatches} compact />
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            Sin configuración
                          </Badge>
                        )}
                      </TableCell>
                      
                      <TableCell className="min-w-[200px]">
                        <div className="flex items-center gap-1 flex-wrap">
                          <Button variant="ghost" size="icon" onClick={() => handleGenerateLink(artist)} title="Generate form link">
                            <Link className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleManageFiles(artist)} title="Manage files/riders">
                            <FileText className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handlePrintArtist(artist)} disabled={printingArtistId === artist.id} title="Print artist details">
                            {printingArtistId === artist.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => onEditArtist(artist)} title="Edit artist">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(artist)} disabled={deletingArtistId === artist.id} title="Delete artist">
                            {deletingArtistId === artist.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card Layout */}
          <div className="md:hidden space-y-4">
            {sortedFilteredArtists.map(artist => {
              const gearComparison = gearComparisons[artist.id];
              
              return (
                <div key={artist.id} className="border rounded-lg p-4 space-y-3 bg-card">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base truncate">{artist.name}</h3>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {artist.artist_submitted && (
                          <Badge variant="outline" className="text-xs bg-amber-100 text-amber-900 border-amber-300">
                            Enviado por artista
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">{getStageDisplayName(artist.stage)}</Badge>
                        <Badge variant={artist.rider_missing ? "destructive" : "default"} className="text-xs">
                          {artist.rider_missing ? "Faltante" : "Completo"}
                        </Badge>
                        {artist.isaftermidnight && <Badge variant="outline" className="text-xs bg-blue-700">Después de medianoche</Badge>}
                      </div>
                    </div>
                  </div>

                  {/* Show Time */}
                  <div className="space-y-1">
                    <div className="text-sm font-medium">Hora del show</div>
                    <div className="text-sm">{artist.show_start} - {artist.show_end}</div>
                  </div>

                  {/* Soundcheck */}
                  {artist.soundcheck && (
                    <div className="space-y-1">
                      <div className="text-sm font-medium">Soundcheck</div>
                      <div className="text-sm">{artist.soundcheck_start} - {artist.soundcheck_end}</div>
                    </div>
                  )}

                  {/* Consoles */}
                  <div className="space-y-1">
                    <div className="text-sm font-medium">Consolas</div>
                    <div className="text-sm space-y-1">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-xs text-muted-foreground">FOH:</span>
                        <span>{artist.foh_console || "No especificado"}</span>
                        {artist.foh_console_provided_by && (
                          <Badge variant="outline" className={`text-xs ${getProviderBadge(artist.foh_console_provided_by)}`}>
                            {artist.foh_console_provided_by}
                          </Badge>
                        )}
                        {artist.foh_tech && <Badge variant="outline" className="text-xs">Técnico</Badge>}
                      </div>
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-xs text-muted-foreground">MON:</span>
                        <span>{artist.mon_console || "No especificado"}</span>
                        {artist.mon_console_provided_by && (
                          <Badge variant="outline" className={`text-xs ${getProviderBadge(artist.mon_console_provided_by)}`}>
                            {artist.mon_console_provided_by}
                          </Badge>
                        )}
                        {artist.mon_tech && <Badge variant="outline" className="text-xs">Técnico</Badge>}
                      </div>
                    </div>
                  </div>

                  {/* Wireless/IEM */}
                  {((artist.wireless_systems && artist.wireless_systems.length > 0) || 
                    (artist.iem_systems && artist.iem_systems.length > 0)) && (
                    <div className="space-y-1">
                      <div className="text-sm font-medium">Wireless/IEM</div>
                      <div className="text-sm space-y-1">
                        {artist.wireless_systems && artist.wireless_systems.length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="text-xs">Wireless: {formatWirelessSystems(artist.wireless_systems)}</span>
                            {artist.wireless_provided_by && (
                              <Badge variant="outline" className={`text-xs ${getProviderBadge(artist.wireless_provided_by)}`}>
                                {artist.wireless_provided_by}
                              </Badge>
                            )}
                          </div>
                        )}
                        {artist.iem_systems && artist.iem_systems.length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="text-xs">IEM: {formatWirelessSystems(artist.iem_systems, true)}</span>
                            {artist.iem_provided_by && (
                              <Badge variant="outline" className={`text-xs ${getProviderBadge(artist.iem_provided_by)}`}>
                                {artist.iem_provided_by}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Microphones */}
                  <div className="space-y-1">
                    <div className="text-sm font-medium flex items-center gap-1">
                      <Mic className="h-4 w-4" />
                      Micrófonos
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={
                        artist.mic_kit === 'festival' ? 'default' : 
                        artist.mic_kit === 'mixed' ? 'secondary' : 
                        'outline'
                      } className={
                        artist.mic_kit === 'mixed' ? 'bg-purple-100 text-purple-800' : ''
                      }>
                        {artist.mic_kit === 'festival' ? 'Festival' : 
                         artist.mic_kit === 'mixed' ? 'Mixed' : 
                         'Band'}
                      </Badge>
                    </div>
                    {(artist.mic_kit === 'festival' || artist.mic_kit === 'mixed') && artist.wired_mics && artist.wired_mics.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        {formatWiredMics(artist.wired_mics)}
                      </div>
                    )}
                  </div>

                  {/* Monitors */}
                  <div className="space-y-1">
                    <div className="text-sm font-medium">Monitores</div>
                    <div>
                      {artist.monitors_enabled ? (
                        <Badge variant="secondary">{artist.monitors_quantity}x</Badge>
                      ) : (
                        <Badge variant="outline">Ninguno</Badge>
                      )}
                    </div>
                  </div>

                  {/* Infrastructure */}
                  <div className="space-y-1">
                    <div className="text-sm font-medium">Infraestructura</div>
                    <div className="text-xs text-muted-foreground">
                      {formatInfrastructure(artist)}
                    </div>
                    {artist.infrastructure_provided_by && (
                      <Badge variant="outline" className={`text-xs ${getProviderBadge(artist.infrastructure_provided_by)}`}>
                        {artist.infrastructure_provided_by}
                      </Badge>
                    )}
                  </div>

                  {/* Extras */}
                  {(artist.extras_sf || artist.extras_df || artist.extras_djbooth) && (
                    <div className="space-y-1">
                      <div className="text-sm font-medium">Extras</div>
                      <div className="flex flex-wrap gap-1">
                        {artist.extras_sf && <Badge variant="outline" className="text-xs">Side Fill</Badge>}
                        {artist.extras_df && <Badge variant="outline" className="text-xs">Drum Fill</Badge>}
                        {artist.extras_djbooth && <Badge variant="outline" className="text-xs">Cabina DJ</Badge>}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {artist.notes && artist.notes.trim() !== '' && (
                    <div className="space-y-1">
                      <div className="text-sm font-medium">Notas</div>
                      <div className="text-xs text-muted-foreground whitespace-pre-wrap">{artist.notes}</div>
                    </div>
                  )}

                  {/* Gear Status */}
                  {gearComparison && (
                    <div className="space-y-1">
                      <div className="text-sm font-medium">Estado del equipo</div>
                      <GearMismatchIndicator mismatches={gearComparison.mismatches} compact />
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t">
                    <Button variant="ghost" size="sm" onClick={() => handleGenerateLink(artist)}>
                      <Link className="h-4 w-4 mr-1" />
                      <span className="text-xs">Enlace</span>
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleManageFiles(artist)}>
                      <FileText className="h-4 w-4 mr-1" />
                      <span className="text-xs">Archivos</span>
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handlePrintArtist(artist)} disabled={printingArtistId === artist.id}>
                      {printingArtistId === artist.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4 mr-1" />}
                      <span className="text-xs">Imprimir</span>
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => onEditArtist(artist)}>
                      <Pencil className="h-4 w-4 mr-1" />
                      <span className="text-xs">Editar</span>
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteClick(artist)} disabled={deletingArtistId === artist.id}>
                      {deletingArtistId === artist.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
                      <span className="text-xs">Eliminar</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {sortedFilteredArtists.length === 0 && !isLoading && (
            <div className="text-center py-8 text-muted-foreground">
              No se encontraron artistas con los filtros actuales.
            </div>
          )}
        </div>
      </TooltipProvider>

      {selectedArtist && (
        <>
          <ArtistFormLinkDialog
            open={linkDialogOpen}
            onOpenChange={setLinkDialogOpen}
            artistId={selectedArtist.id}
            artistName={selectedArtist.name}
            jobId={jobId}
            selectedDate={selectedDate}
          />
          
          <ArtistFileDialog open={fileDialogOpen} onOpenChange={setFileDialogOpen} artistId={selectedArtist.id} />
        </>
      )}

      <ArtistFormLinksDialog open={linksDialogOpen} onOpenChange={setLinksDialogOpen} selectedDate={selectedDate || ''} jobId={jobId || ''} />
    </>
  );
};
