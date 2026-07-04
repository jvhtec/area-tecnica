import { useState, useEffect, useRef, type ChangeEvent, type ClipboardEvent as ReactClipboardEvent } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Loading } from "@/components/ui/loading";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown, ExternalLink, ImageOff, ImagePlus, Loader2 } from "lucide-react";
import { format, parseISO, isAfter, setHours, setMinutes } from "date-fns";
import { es } from "date-fns/locale";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArtistFormLinkDialog } from "./ArtistFormLinkDialog";
import { ArtistFormLinksDialog } from "./ArtistFormLinksDialog";
import { ArtistFileDialog } from "./ArtistFileDialog";
import { exportArtistPDF } from "@/utils/artistPdfExport";
import { sortArtistsChronologically, sortArtistsByField, ARTIST_SORT_FIELD_LABELS, type ArtistSortField } from "@/utils/artistSorting";
import { combineWavesDisplay } from "@/constants/wavesModels";
import { FOH_DRIVE_LABELS, CONSOLE_POSITION_LABELS, type FohDrive, type ConsolePosition, type MonConsolePosition } from "@/constants/consoleDrive";
import { toast } from "sonner";
import { dataLayerClient } from "@/services/dataLayerClient";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { compareArtistRequirements, ArtistGearComparison } from "@/utils/gearComparisonService";
import { getOfflineFileBlob, isBrowserOnline } from "@/lib/offline";
import { GearMismatchIndicator } from "./GearMismatchIndicator";
import { FestivalGearSetup, StageGearSetup } from "@/types/festival";
import { mapFestivalGearSetup, mapStageGearSetups } from "@/utils/festivalGearMappers";
import { buildReadableFilename } from "@/utils/fileName";
import { optimizeImageForUpload, validateImageFile } from "@/utils/imageOptimization";
import { MobileArtistList } from "./mobile/MobileArtistList";
import { useCreateExtrasPresupuesto } from "@/hooks/festival/useCreateExtrasPresupuesto";
import { ArtistActionButtons } from "./ArtistActionButtons";
import { buildArtistPdfData } from "@/utils/artistPdfDataMapper";

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
  line_check?: boolean;
  line_check_start?: string;
  line_check_end?: string;
  load_in_time?: string;
  foh_console: string;
  foh_console_provided_by?: 'festival' | 'band' | 'mixed';
  foh_drive?: string;
  foh_drive_position?: string;
  mon_console: string;
  mon_console_provided_by?: 'festival' | 'band' | 'mixed';
  mon_position?: string;
  monitors_from_foh?: boolean;
  foh_waves_models?: any[];
  foh_outboard?: string;
  foh_waves_provided_by?: 'festival' | 'band' | 'mixed';
  mon_waves_models?: any[];
  mon_outboard?: string;
  mon_waves_provided_by?: 'festival' | 'band' | 'mixed';
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
  stage_plot_file_path?: string | null;
  stage_plot_file_name?: string | null;
  stage_plot_file_type?: string | null;
  stage_plot_uploaded_at?: string | null;
}

interface ArtistTableProps {
  artists: Artist[];
  isLoading: boolean;
  onEditArtist: (artist: Artist) => void;
  onDeleteArtist: (artist: Artist) => void;
  searchTerm: string;
  stageFilter: string;
  riderFilter: string;
  dayStartTime: string;
  jobId?: string;
  selectedDate?: string;
  /** True while the search box is matching artists across every festival date, not just `selectedDate`. */
  crossDateSearch?: boolean;
  onArtistStagePlotUpdated?: () => void;
  canDelete: boolean;
  canCreateExtras: boolean;
}

export const ArtistTable = ({
  artists,
  isLoading,
  onEditArtist,
  onDeleteArtist,
  searchTerm,
  stageFilter,
  riderFilter,
  dayStartTime,
  jobId,
  selectedDate,
  crossDateSearch = false,
  onArtistStagePlotUpdated,
  canDelete,
  canCreateExtras
}: ArtistTableProps) => {
  const [sortBy, setSortBy] = useState<ArtistSortField>('chronological');
  const confirm = useConfirm();
  const { createExtrasPresupuesto, isCreatingExtrasFor } = useCreateExtrasPresupuesto(jobId);
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
  const [stagePlotUrls, setStagePlotUrls] = useState<Record<string, string>>({});
  const [selectedStagePlotArtist, setSelectedStagePlotArtist] = useState<Artist | null>(null);
  const [stagePlotDialogOpen, setStagePlotDialogOpen] = useState(false);
  const [uploadingStagePlotArtistId, setUploadingStagePlotArtistId] = useState<string | null>(null);
  const [deletingStagePlotArtistId, setDeletingStagePlotArtistId] = useState<string | null>(null);
  const [isClipboardReading, setIsClipboardReading] = useState(false);
  const stagePlotInputRef = useRef<HTMLInputElement | null>(null);

  // Fetch custom stage names
  useEffect(() => {
    const fetchStageNames = async () => {
      if (!jobId) return;
      
      const { data: stages, error } = await dataLayerClient.from('festival_stages')
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
        const { data: mainSetup, error: mainError } = await dataLayerClient.from('festival_gear_setups')
          .select('*')
          .eq('job_id', jobId)
          .single();

        if (mainError && mainError.code !== 'PGRST116') {
          console.error('Error fetching festival gear setup:', mainError);
          return;
        }

        setFestivalGearSetup(mapFestivalGearSetup(mainSetup));

        // Fetch stage-specific setups if main setup exists
        if (mainSetup) {
          const { data: stageSetups, error: stageError } = await dataLayerClient.from('festival_stage_gear_setups')
            .select('*')
            .eq('gear_setup_id', mainSetup.id);

          if (stageError) {
            console.error('Error fetching stage gear setups:', stageError);
          } else {
            setStageGearSetups(mapStageGearSetups(stageSetups));
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
        foh_drive: artist.foh_drive as FohDrive | '' | undefined,
        foh_drive_position: artist.foh_drive_position as ConsolePosition | '' | undefined,
        mon_console: artist.mon_console,
        mon_console_provided_by: artist.mon_console_provided_by,
        mon_position: artist.mon_position as MonConsolePosition | '' | undefined,
        monitors_from_foh: artist.monitors_from_foh || false,
        foh_waves_models: artist.foh_waves_models || [],
        foh_outboard: artist.foh_outboard || "",
        foh_waves_provided_by: artist.foh_waves_provided_by,
        mon_waves_models: artist.mon_waves_models || [],
        mon_outboard: artist.mon_outboard || "",
        mon_waves_provided_by: artist.mon_waves_provided_by,
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

  useEffect(() => {
    let isCancelled = false;
    const objectUrls: string[] = [];

    const loadStagePlotUrls = async () => {
      const artistsWithPlot = artists.filter((artist) => Boolean(artist.stage_plot_file_path));

      if (artistsWithPlot.length === 0) {
        if (!isCancelled) {
          setStagePlotUrls({});
        }
        return;
      }

      const nextUrls: Record<string, string> = {};

      await Promise.all(
        artistsWithPlot.map(async (artist) => {
          if (!artist.stage_plot_file_path) return;

          // Cached blob first: renders offline and skips the signed-URL
          // round-trip when the festival was downloaded.
          const cachedBlob = await getOfflineFileBlob("festival_artist_files", artist.stage_plot_file_path);
          // Cleanup may have already revoked the tracked URLs; creating one
          // now would leak it
          if (isCancelled) return;
          if (cachedBlob) {
            const objectUrl = URL.createObjectURL(cachedBlob);
            objectUrls.push(objectUrl);
            nextUrls[artist.id] = objectUrl;
            return;
          }

          if (!isBrowserOnline()) return;
          const { data, error } = await dataLayerClient.storage
            .from("festival_artist_files")
            .createSignedUrl(artist.stage_plot_file_path, 60 * 60);

          if (!error && data?.signedUrl) {
            nextUrls[artist.id] = data.signedUrl;
          }
        })
      );

      if (!isCancelled) {
        setStagePlotUrls(nextUrls);
      }
    };

    loadStagePlotUrls();

    return () => {
      isCancelled = true;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [artists]);

  const handleOpenStagePlotCapture = (artist: Artist) => {
    setSelectedStagePlotArtist(artist);
    setStagePlotDialogOpen(true);
  };

  const uploadStagePlotFile = async (artist: Artist, file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("El stage plot debe ser una imagen.");
      return;
    }

    const validation = validateImageFile(file, 10);
    if (!validation.valid) {
      toast.error(validation.error || "El stage plot no es válido.");
      return;
    }

    setUploadingStagePlotArtistId(artist.id);

    try {
      const uploadFile = await optimizeImageForUpload(file, {
        maxWidth: 1800,
        maxHeight: 1800,
        quality: 0.82,
        outputFormat: "image/webp",
      });
      const fileExtension = uploadFile.name.split(".").pop() || "webp";
      const nextFilePath = `${artist.id}/stage-plots/${Date.now()}-${crypto.randomUUID()}.${fileExtension}`;

      const { error: uploadError } = await dataLayerClient.storage
        .from("festival_artist_files")
        .upload(nextFilePath, uploadFile, {
          contentType: uploadFile.type || file.type,
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { error: updateError } = await dataLayerClient.from("festival_artists")
        .update({
          stage_plot_file_path: nextFilePath,
          stage_plot_file_name: file.name,
          stage_plot_file_type: uploadFile.type || file.type,
          stage_plot_uploaded_at: new Date().toISOString(),
        })
        .eq("id", artist.id);

      if (updateError) {
        await dataLayerClient.storage.from("festival_artist_files").remove([nextFilePath]);
        throw updateError;
      }

      if (
        artist.stage_plot_file_path &&
        artist.stage_plot_file_path !== nextFilePath
      ) {
        await dataLayerClient.storage
          .from("festival_artist_files")
          .remove([artist.stage_plot_file_path]);
      }

      onArtistStagePlotUpdated?.();
      toast.success(`Stage plot actualizado para ${artist.name}.`);
      setStagePlotDialogOpen(false);
      setSelectedStagePlotArtist(null);
    } catch (error) {
      console.error("Error uploading stage plot:", error);
      toast.error("No se pudo cargar el stage plot.");
    } finally {
      setUploadingStagePlotArtistId(null);
    }
  };

  const handleStagePlotUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !selectedStagePlotArtist) return;
    await uploadStagePlotFile(selectedStagePlotArtist, file);
  };

  const handleStagePlotPaste = async (event: ReactClipboardEvent<HTMLDivElement>) => {
    if (!selectedStagePlotArtist) return;
    const imageItem = Array.from(event.clipboardData.items).find((item) =>
      item.type.startsWith("image/")
    );
    if (!imageItem) {
      toast.error("No se detectó ninguna imagen en el portapapeles.");
      return;
    }

    const imageFile = imageItem.getAsFile();
    if (!imageFile) {
      toast.error("No se pudo leer la imagen del portapapeles.");
      return;
    }

    event.preventDefault();
    await uploadStagePlotFile(selectedStagePlotArtist, imageFile);
  };

  const handleReadClipboardImage = async () => {
    if (!selectedStagePlotArtist) return;

    if (!navigator.clipboard?.read) {
      toast.error("Tu navegador no permite leer imágenes del portapapeles en este contexto.");
      return;
    }

    setIsClipboardReading(true);
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        const imageType = item.types.find((type) => type.startsWith("image/"));
        if (!imageType) continue;
        const blob = await item.getType(imageType);
        const clipboardFile = new File([blob], `stage-plot-${Date.now()}.png`, { type: blob.type });
        await uploadStagePlotFile(selectedStagePlotArtist, clipboardFile);
        return;
      }

      toast.error("No se encontró ninguna imagen en el portapapeles.");
    } catch (error) {
      console.error("Error reading image from clipboard:", error);
      toast.error("No se pudo leer la imagen del portapapeles.");
    } finally {
      setIsClipboardReading(false);
    }
  };

  const handleDeleteStagePlot = async (artist: Artist) => {
    if (!artist.stage_plot_file_path) return;

    const confirmed = await confirm({
      title: "Eliminar stage plot",
      description: `¿Eliminar el stage plot de ${artist.name}?`,
      confirmText: "Eliminar",
      destructive: true,
    });
    if (!confirmed) {
      return;
    }

    setDeletingStagePlotArtistId(artist.id);
    try {
      const currentPath = artist.stage_plot_file_path;

      const { error: updateError } = await dataLayerClient.from("festival_artists")
        .update({
          stage_plot_file_path: null,
          stage_plot_file_name: null,
          stage_plot_file_type: null,
          stage_plot_uploaded_at: null,
        })
        .eq("id", artist.id);

      if (updateError) {
        throw updateError;
      }

      await dataLayerClient.storage.from("festival_artist_files").remove([currentPath]);

      setStagePlotUrls((previous) => {
        const updated = { ...previous };
        delete updated[artist.id];
        return updated;
      });

      onArtistStagePlotUpdated?.();
      if (selectedStagePlotArtist?.id === artist.id) {
        setStagePlotDialogOpen(false);
        setSelectedStagePlotArtist(null);
      }
      toast.success(`Stage plot eliminado para ${artist.name}.`);
    } catch (error) {
      console.error("Error deleting stage plot:", error);
      toast.error("No se pudo eliminar el stage plot.");
    } finally {
      setDeletingStagePlotArtistId(null);
    }
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
    const matchesRider = riderFilter === "all" || riderFilter === "missing" && artist.rider_missing || riderFilter === "complete" && !artist.rider_missing;
    return matchesSearch && matchesStage && matchesRider;
  });

  // Apply sorting to filtered artists using imported utility
  const sortedFilteredArtists = (
    sortBy === 'chronological'
      ? sortArtistsChronologically(filteredArtists)
      : sortArtistsByField(filteredArtists, sortBy)
  ) as Artist[];
  const hasArtistSubmittedData = sortedFilteredArtists.some((artist) => artist.artist_submitted);
  const handleDeleteClick = async (artist: Artist) => {
    if (!canDelete) return;
    const confirmed = await confirm({
      title: "Eliminar artista",
      description: `¿Estás seguro de que quieres eliminar ${artist.name}?`,
      confirmText: "Eliminar",
      destructive: true,
    });
    if (confirmed) {
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
        // For wireless: show channels plus HH and BP
        const channels = system.quantity_ch || 0;
        const hh = system.quantity_hh || 0;
        const bp = system.quantity_bp || 0;
        const total = hh + bp;
        const channelPart = channels > 0 ? `${channels} ch` : '';
        if (hh > 0 && bp > 0) {
          return `${system.model}: ${channelPart ? `${channelPart}, ` : ''}${hh}x HH, ${bp}x BP`;
        } else if (total > 0) {
          return `${system.model}: ${channelPart ? `${channelPart}, ` : ''}${total}x`;
        } else if (channels > 0) {
          return `${system.model}: ${channels} ch`;
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

  const PROVIDER_LABELS: Record<'festival' | 'band' | 'mixed', string> = {
    festival: "Festival",
    band: "Banda",
    mixed: "Mixto",
  };

  const renderProviderBadge = (provider?: 'festival' | 'band' | 'mixed') => {
    if (!provider) return null;
    return (
      <Badge variant="outline" className={`text-[10px] px-1 py-0 ${getProviderBadge(provider)}`}>
        {PROVIDER_LABELS[provider] || provider}
      </Badge>
    );
  };

  // DB time columns come back as HH:MM:SS; the table only shows HH:MM
  const formatTime = (value?: string | null) => {
    if (!value) return "";
    const trimmed = String(value).trim();
    return trimmed.length >= 5 && trimmed.includes(":") ? trimmed.slice(0, 5) : trimmed;
  };

  const formatTimeRange = (start?: string | null, end?: string | null) =>
    `${formatTime(start) || "--:--"} - ${formatTime(end) || "--:--"}`;

  const handlePrintArtist = async (artist: Artist) => {
    setPrintingArtistId(artist.id);
    try {
      const pdfData = await buildArtistPdfData(artist, jobId);
      
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
        <Loading label="Cargando artistas…" size="lg" className="py-8" />
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

          {/* Desktop Table — fixed layout so all columns fit the viewport without horizontal scroll */}
          <div className="hidden md:block w-full">
            <Table className="w-full table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[12%] px-2">Artista</TableHead>
                  <TableHead className="w-[11%] px-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="flex items-center gap-1 hover:text-foreground"
                          title="Ordenar horarios"
                        >
                          Horarios
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuLabel>Ordenar por</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {(Object.keys(ARTIST_SORT_FIELD_LABELS) as ArtistSortField[]).map((field) => (
                          <DropdownMenuCheckboxItem
                            key={field}
                            checked={sortBy === field}
                            onCheckedChange={() => setSortBy(field)}
                          >
                            {ARTIST_SORT_FIELD_LABELS[field]}
                          </DropdownMenuCheckboxItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableHead>
                  <TableHead className="w-[13%] px-2">Consolas</TableHead>
                  <TableHead className="w-[10%] px-2">Waves/Outboard</TableHead>
                  <TableHead className="w-[12%] px-2">RF/IEM</TableHead>
                  <TableHead className="w-[9%] px-2">Micrófonos</TableHead>
                  <TableHead className="w-[7%] px-2">Mon/Extras</TableHead>
                  <TableHead className="w-[8%] px-2">Infra</TableHead>
                  <TableHead className="w-[7%] px-2">Notas</TableHead>
                  <TableHead className="w-[5%] px-2">Estado</TableHead>
                  <TableHead className="w-[6%] px-2">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedFilteredArtists.map(artist => {
                  const gearComparison = gearComparisons[artist.id];
                  
                  return (
                    <TableRow key={artist.id}>
                      {/* Artista: name, badges, stage, plot thumbnail */}
                      <TableCell className="px-2 py-2 align-top">
                        <div className="space-y-1">
                          <div className="font-medium text-sm break-words">{artist.name}</div>
                          <div className="flex flex-wrap gap-1">
                            {crossDateSearch && artist.date && (
                              <Badge variant="secondary" className="text-[10px] px-1 py-0">
                                {format(parseISO(artist.date), "d MMM", { locale: es })}
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-[10px] px-1 py-0">{getStageDisplayName(artist.stage)}</Badge>
                            {artist.artist_submitted && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 bg-amber-100 text-amber-900 border-amber-300" title="Enviado por artista mediante formulario público">
                                Enviado
                              </Badge>
                            )}
                            {artist.isaftermidnight && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 bg-blue-700 text-white" title="Show después de medianoche">
                                +24h
                              </Badge>
                            )}
                          </div>
                          {stagePlotUrls[artist.id] && (
                            <button
                              type="button"
                              className="group relative h-10 w-16 overflow-hidden rounded border"
                              onClick={() => window.open(stagePlotUrls[artist.id], "_blank", "noopener,noreferrer")}
                              title="Ver stage plot"
                            >
                              <img
                                src={stagePlotUrls[artist.id]}
                                alt={`Stage plot de ${artist.name}`}
                                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                              />
                            </button>
                          )}
                        </div>
                      </TableCell>

                      {/* Horarios: load in, show, soundcheck, line check */}
                      <TableCell className="px-2 py-2 align-top">
                        <div className="text-xs space-y-0.5">
                          {artist.load_in_time && (
                            <div className="text-muted-foreground">Load in: {formatTime(artist.load_in_time)}</div>
                          )}
                          <div className="font-medium">Show: {formatTimeRange(artist.show_start, artist.show_end)}</div>
                          {artist.soundcheck && (
                            <div className="text-muted-foreground">SC: {formatTimeRange(artist.soundcheck_start, artist.soundcheck_end)}</div>
                          )}
                          {artist.line_check && (
                            <div className="text-muted-foreground">LC: {formatTimeRange(artist.line_check_start, artist.line_check_end)}</div>
                          )}
                        </div>
                      </TableCell>

                      {/* Consolas: FOH/MON with provider, tech, drive and position */}
                      <TableCell className="px-2 py-2 align-top">
                        <div className="text-xs space-y-1">
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="break-words">FOH: {artist.foh_console || "Sin especificar"}</span>
                            {renderProviderBadge(artist.foh_console_provided_by)}
                            {artist.foh_tech && <Badge variant="outline" className="text-[10px] px-1 py-0">Téc</Badge>}
                          </div>
                          {(artist.foh_drive || artist.foh_drive_position) && (
                            <div className="text-muted-foreground">
                              Drive: {artist.foh_drive ? FOH_DRIVE_LABELS[artist.foh_drive as FohDrive] || artist.foh_drive : "-"}
                              {artist.foh_drive_position && ` (${CONSOLE_POSITION_LABELS[artist.foh_drive_position as ConsolePosition] || artist.foh_drive_position})`}
                            </div>
                          )}
                          {artist.monitors_from_foh ? (
                            <div className="text-muted-foreground">MON desde FOH</div>
                          ) : (
                            <>
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className="break-words">MON: {artist.mon_console || "Sin especificar"}</span>
                                {renderProviderBadge(artist.mon_console_provided_by)}
                                {artist.mon_tech && <Badge variant="outline" className="text-[10px] px-1 py-0">Téc</Badge>}
                              </div>
                              {artist.mon_position && (
                                <div className="text-muted-foreground">
                                  Pos: {CONSOLE_POSITION_LABELS[artist.mon_position as ConsolePosition] || artist.mon_position}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>

                      {/* Waves/Outboard: FOH + MON */}
                      <TableCell className="px-2 py-2 align-top">
                        {(artist.foh_waves_models?.length || artist.foh_outboard ||
                          (!artist.monitors_from_foh && (artist.mon_waves_models?.length || artist.mon_outboard))) ? (
                          <div className="text-xs space-y-1 text-muted-foreground">
                            {(artist.foh_waves_models?.length || artist.foh_outboard) && (
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className="break-words">FOH: {combineWavesDisplay(artist.foh_waves_models, artist.foh_outboard)}</span>
                                {renderProviderBadge(artist.foh_waves_provided_by)}
                              </div>
                            )}
                            {!artist.monitors_from_foh && (artist.mon_waves_models?.length || artist.mon_outboard) && (
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className="break-words">MON: {combineWavesDisplay(artist.mon_waves_models, artist.mon_outboard)}</span>
                                {renderProviderBadge(artist.mon_waves_provided_by)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>

                      {/* RF/IEM */}
                      <TableCell className="px-2 py-2 align-top">
                        <div className="text-xs space-y-1">
                          {(artist.wireless_provided_by || (artist.wireless_systems && artist.wireless_systems.length > 0)) && (
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="break-words" title={formatWirelessSystems(artist.wireless_systems)}>
                                RF: {formatWirelessSystems(artist.wireless_systems)}
                              </span>
                              {renderProviderBadge(artist.wireless_provided_by)}
                            </div>
                          )}
                          {(artist.iem_provided_by || (artist.iem_systems && artist.iem_systems.length > 0)) && (
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="break-words" title={formatWirelessSystems(artist.iem_systems, true)}>
                                IEM: {formatWirelessSystems(artist.iem_systems, true)}
                              </span>
                              {renderProviderBadge(artist.iem_provided_by)}
                            </div>
                          )}
                          {!artist.wireless_provided_by && !artist.iem_provided_by &&
                            !(artist.wireless_systems?.length) && !(artist.iem_systems?.length) && (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                      </TableCell>

                      {/* Micrófonos */}
                      <TableCell className="px-2 py-2 align-top">
                        <div className="text-xs space-y-1">
                          <Badge variant={
                            artist.mic_kit === 'festival' ? 'default' :
                            artist.mic_kit === 'mixed' ? 'secondary' :
                            'outline'
                          } className={`text-[10px] px-1 py-0 ${artist.mic_kit === 'mixed' ? 'bg-purple-100 text-purple-800' : ''}`}>
                            {artist.mic_kit === 'festival' ? 'Festival' :
                             artist.mic_kit === 'mixed' ? 'Mixto' :
                             'Banda'}
                          </Badge>
                          {(artist.mic_kit === 'festival' || artist.mic_kit === 'mixed') && artist.wired_mics && artist.wired_mics.length > 0 && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="text-muted-foreground line-clamp-3 cursor-help break-words">
                                  {formatWiredMics(artist.wired_mics)}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-sm">{formatWiredMics(artist.wired_mics)}</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>

                      {/* Monitores y extras */}
                      <TableCell className="px-2 py-2 align-top">
                        <div className="flex flex-wrap gap-1">
                          {artist.monitors_enabled ? (
                            <Badge variant="secondary" className="text-[10px] px-1 py-0" title="Cuñas de monitor">
                              {artist.monitors_quantity}x
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] px-1 py-0">0x</Badge>
                          )}
                          {artist.extras_sf && <Badge variant="outline" className="text-[10px] px-1 py-0" title="Side fill">SF</Badge>}
                          {artist.extras_df && <Badge variant="outline" className="text-[10px] px-1 py-0" title="Drum fill">DF</Badge>}
                          {artist.extras_djbooth && <Badge variant="outline" className="text-[10px] px-1 py-0" title="DJ booth">DJ</Badge>}
                        </div>
                      </TableCell>

                      {/* Infraestructura */}
                      <TableCell className="px-2 py-2 align-top">
                        <div className="text-xs space-y-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="text-muted-foreground line-clamp-3 cursor-help break-words">
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
                          {renderProviderBadge(artist.infrastructure_provided_by)}
                        </div>
                      </TableCell>

                      {/* Notas */}
                      <TableCell className="px-2 py-2 align-top">
                        {artist.notes && artist.notes.trim() !== '' ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="text-xs text-muted-foreground line-clamp-3 cursor-help break-words">
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
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>

                      {/* Estado: rider + material */}
                      <TableCell className="px-2 py-2 align-top">
                        <div className="flex flex-col items-start gap-1">
                          <Badge variant={artist.rider_missing ? "destructive" : "default"} className="text-[10px] px-1 py-0">
                            {artist.rider_missing ? "Faltante" : "Completo"}
                          </Badge>
                          {gearComparison ? (
                            <GearMismatchIndicator mismatches={gearComparison.mismatches} compact />
                          ) : (
                            <Badge variant="outline" className="text-[10px] px-1 py-0" title="Sin configuración de material del festival">
                              Sin conf.
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      {/* Acciones */}
                      <TableCell className="px-2 py-2 align-top">
                        <ArtistActionButtons
                          artist={artist}
                          gearComparison={gearComparison}
                          printingArtistId={printingArtistId}
                          uploadingStagePlotArtistId={uploadingStagePlotArtistId}
                          deletingStagePlotArtistId={deletingStagePlotArtistId}
                          deletingArtistId={deletingArtistId}
                          canDelete={canDelete}
                          canCreateExtras={canCreateExtras}
                          isCreatingExtrasFor={isCreatingExtrasFor}
                          onGenerateLink={handleGenerateLink}
                          onManageFiles={handleManageFiles}
                          onPrintArtist={handlePrintArtist}
                          onOpenStagePlotCapture={handleOpenStagePlotCapture}
                          onDeleteStagePlot={handleDeleteStagePlot}
                          onEditArtist={onEditArtist}
                          onDeleteArtist={handleDeleteClick}
                          onCreateFlexExtras={createExtrasPresupuesto}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card Layout */}
          <div className="md:hidden">
            <MobileArtistList
              artists={sortedFilteredArtists}
              stageNames={stageNames}
              stagePlotUrls={stagePlotUrls}
              gearComparisons={gearComparisons}
              jobId={jobId || ""}
              selectedDate={selectedDate || ""}
              crossDateSearch={crossDateSearch}
              onEditArtist={onEditArtist}
              onDeleteArtist={handleDeleteClick}
              onGenerateLink={handleGenerateLink}
              onManageFiles={handleManageFiles}
              onPrintArtist={handlePrintArtist}
              onOpenStagePlotCapture={handleOpenStagePlotCapture}
              onDeleteStagePlot={handleDeleteStagePlot}
              onArtistsChanged={() => onArtistStagePlotUpdated?.()}
              printingArtistId={printingArtistId}
              deletingArtistId={deletingArtistId}
              uploadingStagePlotArtistId={uploadingStagePlotArtistId}
              deletingStagePlotArtistId={deletingStagePlotArtistId}
              onCreateFlexExtras={createExtrasPresupuesto}
              isCreatingExtrasFor={isCreatingExtrasFor}
              canDelete={canDelete}
              canCreateExtras={canCreateExtras}
            />
          </div>

          {sortedFilteredArtists.length === 0 && !isLoading && (
            <div className="text-center py-8 text-muted-foreground">
              No se encontraron artistas con los filtros actuales.
            </div>
          )}
        </div>
      </TooltipProvider>

      {/* No `capture` attribute: mobile browsers then offer the chooser
          (camera roll / take photo / files) instead of forcing the camera */}
      <input
        ref={stagePlotInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleStagePlotUpload}
      />

      <Dialog
        open={stagePlotDialogOpen}
        onOpenChange={(open) => {
          setStagePlotDialogOpen(open);
          if (!open) {
            setSelectedStagePlotArtist(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Stage Plot {selectedStagePlotArtist ? `- ${selectedStagePlotArtist.name}` : ""}
            </DialogTitle>
            <DialogDescription>
              Pega una captura con `Ctrl+V` / `Cmd+V`, o carga una imagen desde archivo/cámara.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {selectedStagePlotArtist && stagePlotUrls[selectedStagePlotArtist.id] ? (
              <div className="overflow-hidden rounded border">
                <img
                  src={stagePlotUrls[selectedStagePlotArtist.id]}
                  alt={`Stage plot de ${selectedStagePlotArtist.name}`}
                  className="max-h-64 w-full object-contain bg-muted/30"
                />
              </div>
            ) : (
              <div className="rounded border border-dashed p-4 text-sm text-muted-foreground">
                Este artista todavía no tiene stage plot.
              </div>
            )}

            <div
              className="rounded-lg border border-dashed p-4 text-sm"
              tabIndex={0}
              onPaste={handleStagePlotPaste}
            >
              Pega aquí la imagen del portapapeles.
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="default"
                onClick={handleReadClipboardImage}
                disabled={!selectedStagePlotArtist || isClipboardReading || uploadingStagePlotArtistId === selectedStagePlotArtist?.id}
              >
                {isClipboardReading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ImagePlus className="h-4 w-4 mr-2" />}
                Pegar desde portapapeles
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => stagePlotInputRef.current?.click()}
                disabled={!selectedStagePlotArtist || uploadingStagePlotArtistId === selectedStagePlotArtist?.id}
              >
                Seleccionar archivo
              </Button>
              {selectedStagePlotArtist?.stage_plot_file_path && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => handleDeleteStagePlot(selectedStagePlotArtist)}
                  disabled={deletingStagePlotArtistId === selectedStagePlotArtist.id}
                >
                  {deletingStagePlotArtistId === selectedStagePlotArtist.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ImageOff className="h-4 w-4 mr-2" />}
                  Eliminar stage plot
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
