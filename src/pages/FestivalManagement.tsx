import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Music2, Layout, Calendar, Printer, Loader2, FileText, Download, Eye, Clock, FolderPlus, RefreshCw, MapPin, Link as LinkIcon, Box } from "lucide-react";
import createFolderIcon from "@/assets/icons/icon.png";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { format, isValid } from "date-fns";
import { FestivalLogoManager } from "@/components/festival/FestivalLogoManager";
import { FestivalScheduling } from "@/components/festival/scheduling/FestivalScheduling";
import { PrintOptionsDialog, PrintOptions } from "@/components/festival/pdf/PrintOptionsDialog";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { generateAndMergeFestivalPDFs } from "@/utils/pdf/festivalPdfGenerator";
import { useFlexUuid } from "@/hooks/useFlexUuid";
import { generateIndividualStagePDFs } from "@/utils/pdf/individualStagePdfGenerator";
import { FestivalWeatherSection } from "@/components/festival/FestivalWeatherSection";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Department } from "@/types/department";
import { JobAssignmentDialog } from "@/components/jobs/JobAssignmentDialog";
import { JobDetailsDialog } from "@/components/jobs/JobDetailsDialog";
import { ModernHojaDeRuta } from "@/components/hoja-de-ruta/ModernHojaDeRuta";
import { FlexSyncLogDialog } from "@/components/jobs/FlexSyncLogDialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { CrewCallLinkerDialog } from "@/components/jobs/CrewCallLinker";
import { FlexFolderPicker } from "@/components/flex/FlexFolderPicker";
import { createAllFoldersForJob } from "@/utils/flex-folders";
import type { CreateFoldersOptions } from "@/utils/flex-folders";
import { JobPresetManagerDialog } from "@/components/jobs/JobPresetManagerDialog";
import { resolveJobDocBucket } from "@/utils/jobDocuments";

interface FestivalJob {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
}

interface Artist {
  id: string;
  name: string;
  stage: number;
  date: string;
  profile_complete: boolean;
  soundcheck_start?: string;
  soundcheck_end?: string;
  show_start: string;
  show_end: string;
  technical_info: any;
  infrastructure_info: any;
  extras: any;
  notes?: string;
}

interface Stage {
  id: string;
  name: string;
  number: number;
}

interface JobDocumentEntry {
  id: string;
  file_name: string;
  file_path: string;
  uploaded_at: string;
  read_only?: boolean;
  template_type?: string | null;
}

interface ArtistRiderFile {
  id: string;
  file_name: string;
  file_path: string;
  created_at: string;
  artist_id?: string;
  festival_artists?: {
    id: string;
    name: string;
  } | null;
}

const FestivalManagement = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const isSingleJobMode = searchParams.get('singleJob') === 'true';
  const { toast } = useToast();
  const [job, setJob] = useState<FestivalJob | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [artistCount, setArtistCount] = useState(0);
  const [jobDates, setJobDates] = useState<Date[]>([]);
  const [venueData, setVenueData] = useState<{
    address?: string;
    coordinates?: { lat: number; lng: number };
  }>({});
  const [isPrinting, setIsPrinting] = useState(false);
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const { userRole } = useOptimizedAuth();
  const [maxStages, setMaxStages] = useState(1);
  const { flexUuid, isLoading: isFlexLoading, error: flexError, folderExists, refetch: refetchFlexUuid } = useFlexUuid(jobId || '');
  const [jobDocuments, setJobDocuments] = useState<JobDocumentEntry[]>([]);
  const [artistRiderFiles, setArtistRiderFiles] = useState<ArtistRiderFile[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [assignmentDepartment, setAssignmentDepartment] = useState<Department>('sound');
  const [isAssignmentDialogOpen, setIsAssignmentDialogOpen] = useState(false);
  const [isRouteSheetOpen, setIsRouteSheetOpen] = useState(false);
  const [isJobDetailsOpen, setIsJobDetailsOpen] = useState(false);
  const [isFlexLogOpen, setIsFlexLogOpen] = useState(false);
  const [isCreatingFlexFolders, setIsCreatingFlexFolders] = useState(false);
  const [isFlexPickerOpen, setIsFlexPickerOpen] = useState(false);
  const [flexPickerOptions, setFlexPickerOptions] = useState<CreateFoldersOptions | undefined>(undefined);
  const [isJobPresetsOpen, setIsJobPresetsOpen] = useState(false);

  const resolveJobDocumentBucket = useCallback((path: string) => resolveJobDocBucket(path), []);

  const fetchJobDetails = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;

    if (!jobId) {
      setJob(null);
      setArtistCount(0);
      setJobDates([]);
      setVenueData({});
      if (!silent) {
        setIsLoading(false);
      }
      return;
    }

    if (!silent) {
      setIsLoading(true);
    }

    try {
      console.log("Fetching job details for jobId:", jobId);

      const { data: jobData, error: jobError } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", jobId)
        .single();

      if (jobError) {
        console.error("Error fetching job data:", jobError);
        throw jobError;
      }

      console.log("Job data retrieved:", jobData);
      setJob(jobData);

      const { count: artistCountValue, error: artistError } = await supabase
        .from("festival_artists")
        .select("*", { count: 'exact' })
        .eq("job_id", jobId);

      if (artistError) {
        console.error("Error fetching artist count:", artistError);
        throw artistError;
      }

      setArtistCount(artistCountValue || 0);

      const { data: gearSetups, error: gearError } = await supabase
        .from("festival_gear_setups")
        .select("max_stages")
        .eq("job_id", jobId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (gearError) {
        console.error("Error fetching gear setup:", gearError);
      } else if (gearSetups && gearSetups.length > 0) {
        setMaxStages(gearSetups[0].max_stages || 1);
      }

      if (jobData.location_id) {
        const { data: loc, error: locError } = await supabase
          .from("locations")
          .select("name, formatted_address, latitude, longitude")
          .eq("id", jobData.location_id)
          .single();

        if (!locError && loc) {
          setVenueData({
            address: (loc.formatted_address || loc.name || undefined) as string | undefined,
            coordinates:
              typeof loc.latitude === 'number' && typeof loc.longitude === 'number'
                ? { lat: loc.latitude, lng: loc.longitude }
                : undefined,
          });
        } else {
          console.log("No location found for job; falling back to hoja_de_ruta if available");
          const { data: hojaData, error: hojaError } = await supabase
            .from("hoja_de_ruta")
            .select("venue_address, venue_latitude, venue_longitude")
            .eq("job_id", jobId)
            .maybeSingle();

          if (!hojaError && hojaData) {
            setVenueData({
              address: hojaData.venue_address || undefined,
              coordinates:
                typeof hojaData.venue_latitude === 'number' && typeof hojaData.venue_longitude === 'number'
                  ? { lat: hojaData.venue_latitude, lng: hojaData.venue_longitude }
                  : undefined,
            });
          }
        }
      } else {
        console.log("Job has no location_id; attempting hoja_de_ruta fallback");
        const { data: hojaData, error: hojaError } = await supabase
          .from("hoja_de_ruta")
          .select("venue_address, venue_latitude, venue_longitude")
          .eq("job_id", jobId)
          .maybeSingle();

        if (!hojaError && hojaData) {
          setVenueData({
            address: hojaData.venue_address || undefined,
            coordinates:
              typeof hojaData.venue_latitude === 'number' && typeof hojaData.venue_longitude === 'number'
                ? { lat: hojaData.venue_latitude, lng: hojaData.venue_longitude }
                : undefined,
          });
        }
      }

      const startDate = new Date(jobData.start_time);
      const endDate = new Date(jobData.end_time);

      if (isValid(startDate) && isValid(endDate)) {
        const dates: Date[] = [];
        const currentDate = new Date(startDate);

        while (currentDate <= endDate) {
          dates.push(new Date(currentDate));
          currentDate.setDate(currentDate.getDate() + 1);
        }

        setJobDates(dates);
      } else {
        console.warn("Invalid dates in job data, checking for date types");

        const { data: dateTypes, error: dateTypesError } = await supabase
          .from("job_date_types")
          .select("*")
          .eq("job_id", jobId);

        if (dateTypesError) {
          console.error("Error fetching date types:", dateTypesError);
        } else if (dateTypes && dateTypes.length > 0) {
          const uniqueDates = Array.from(new Set(
            dateTypes
              .map(dt => {
                try {
                  return new Date(dt.date);
                } catch (e) {
                  return null;
                }
              })
              .filter(date => date && isValid(date))
          )) as Date[];

          setJobDates(uniqueDates);
        } else {
          console.warn("No valid dates found for this job");
          setJobDates([new Date()]);
        }
      }
    } catch (error: any) {
      console.error("Error fetching festival details:", error);
      if (!silent) {
        toast({
          title: "Error",
          description: "Could not load festival details",
          variant: "destructive",
        });
      }
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, [jobId, toast]);

  const fetchDocuments = useCallback(async () => {
    if (!jobId) {
      setJobDocuments([]);
      setArtistRiderFiles([]);
      setIsLoadingDocuments(false);
      return;
    }

    setIsLoadingDocuments(true);
    try {
      const { data: jobDocs, error: jobDocsError } = await supabase
        .from('job_documents')
        .select('id, file_name, file_path, uploaded_at, read_only, template_type')
        .eq('job_id', jobId)
        .order('uploaded_at', { ascending: false });

      if (jobDocsError) {
        throw jobDocsError;
      }

      setJobDocuments((jobDocs || []) as JobDocumentEntry[]);

      // Two-step: get artists, then rider files for those artists
      const { data: artistsForJob, error: artistsErr } = await supabase
        .from('festival_artists')
        .select('id, name')
        .eq('job_id', jobId);
      if (artistsErr) throw artistsErr;
      const artistIds = (artistsForJob || []).map(a => a.id);
      let riderData: any[] = [];
      if (artistIds.length > 0) {
        let query = supabase
          .from('festival_artist_files')
          .select('id, file_name, file_path, uploaded_at, artist_id')
          .order('uploaded_at', { ascending: false });
        if (artistIds.length === 1) {
          query = query.eq('artist_id', artistIds[0]);
        } else {
          const orExpr = artistIds.map((id) => `artist_id.eq.${id}`).join(',');
          query = query.or(orExpr);
        }
        const { data, error } = await query;
        if (error) throw error;
        riderData = data || [];
        // re-attach artist names for grouping
        const nameMap = new Map((artistsForJob || []).map(a => [a.id, (a as any).name]));
        riderData = riderData.map((f: any) => ({ ...f, festival_artists: { id: f.artist_id, name: nameMap.get(f.artist_id) || 'Unknown' } }));
      }

      setArtistRiderFiles((riderData || []) as unknown as ArtistRiderFile[]);
    } catch (error: any) {
      console.error('Error fetching documents:', error);
      toast({
        title: 'Error loading documents',
        description: error.message || 'We could not load the documents for this job.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingDocuments(false);
    }
  }, [jobId, toast]);

  const handleJobDocumentView = useCallback(async (docEntry: JobDocumentEntry) => {
    try {
      const { data, error } = await supabase.storage
        .from(resolveJobDocumentBucket(docEntry.file_path))
        .createSignedUrl(docEntry.file_path, 3600);

      if (error) throw error;

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank', 'noopener');
      }
    } catch (error: any) {
      console.error('Error viewing document:', error);
      toast({
        title: 'Unable to open document',
        description: error.message || 'Please try again in a few moments.',
        variant: 'destructive',
      });
    }
  }, [resolveJobDocumentBucket, toast]);

  const handleJobDocumentDownload = useCallback(async (docEntry: JobDocumentEntry) => {
    try {
      const { data, error } = await supabase.storage
        .from(resolveJobDocumentBucket(docEntry.file_path))
        .download(docEntry.file_path);

      if (error) throw error;

      const url = window.URL.createObjectURL(data);
      const downloadLink = window.document.createElement('a');
      downloadLink.href = url;
      downloadLink.download = docEntry.file_name;
      window.document.body.appendChild(downloadLink);
      downloadLink.click();
      window.document.body.removeChild(downloadLink);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Error downloading document:', error);
      toast({
        title: 'Download failed',
        description: error.message || 'We could not download that file.',
        variant: 'destructive',
      });
    }
  }, [resolveJobDocumentBucket, toast]);

  const handleRiderView = useCallback(async (file: ArtistRiderFile) => {
    try {
      const { data, error } = await supabase.storage
        .from('festival_artist_files')
        .createSignedUrl(file.file_path, 3600);

      if (error) throw error;

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank', 'noopener');
      }
    } catch (error: any) {
      console.error('Error viewing rider:', error);
      toast({
        title: 'Unable to open rider',
        description: error.message || 'Please try again later.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const handleRiderDownload = useCallback(async (file: ArtistRiderFile) => {
    try {
      const { data, error } = await supabase.storage
        .from('festival_artist_files')
        .download(file.file_path);

      if (error) throw error;

      const url = window.URL.createObjectURL(data);
      const downloadLink = window.document.createElement('a');
      downloadLink.href = url;
      downloadLink.download = file.file_name;
      window.document.body.appendChild(downloadLink);
      downloadLink.click();
      window.document.body.removeChild(downloadLink);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Error downloading rider:', error);
      toast({
        title: 'Download failed',
        description: error.message || 'We could not download that rider file.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const handleRefreshDocuments = useCallback(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const groupedRiderFiles = useMemo(() => {
    const map = new Map<string, { artistId: string; artistName: string; files: ArtistRiderFile[] }>();
    artistRiderFiles.forEach((file) => {
      const artistId = file.artist_id || file.festival_artists?.id || 'unknown';
      const artistName = file.festival_artists?.name || 'Unknown Artist';
      if (!map.has(artistId)) {
        map.set(artistId, { artistId, artistName, files: [] });
      }
      map.get(artistId)!.files.push(file);
    });

    return Array.from(map.values()).sort((a, b) => a.artistName.localeCompare(b.artistName));
  }, [artistRiderFiles]);

  const formatDateLabel = useCallback((value?: string | null) => {
    if (!value) return 'Unknown date';
    const parsed = new Date(value);
    return isValid(parsed) ? format(parsed, 'MMM d, yyyy') : 'Unknown date';
  }, []);

  const departmentOptions: Department[] = ['sound', 'lights', 'video', 'production', 'logistics', 'administrative', 'personnel', 'comercial'];

  const humanizeDepartment = useCallback((dep: Department) => dep.charAt(0).toUpperCase() + dep.slice(1), []);

  const handleAssignmentChange = useCallback(() => {
    fetchJobDetails({ silent: true });
    fetchDocuments();
  }, [fetchJobDetails, fetchDocuments]);

  const handleOpenAssignments = useCallback(() => {
    if (!jobId) return;
    setIsAssignmentDialogOpen(true);
  }, [jobId]);

  const handleNavigateTimesheets = useCallback(() => {
    if (!jobId) return;
    navigate(`/timesheets?jobId=${jobId}`);
  }, [jobId, navigate]);

  const handleOpenRouteSheet = useCallback(() => {
    setIsRouteSheetOpen(true);
  }, []);

  const handleOpenJobDetails = useCallback(() => {
    if (!job) return;
    setIsJobDetailsOpen(true);
  }, [job]);

  const handleOpenFlexLogs = useCallback(() => {
    setIsFlexLogOpen(true);
  }, []);

  const handleOpenFlexPicker = useCallback(() => {
    if (!job || isCreatingFlexFolders) {
      return;
    }
    setIsFlexPickerOpen(true);
  }, [job, isCreatingFlexFolders]);

  const handleRefreshAll = useCallback(() => {
    fetchJobDetails();
    fetchDocuments();
    refetchFlexUuid();
  }, [fetchJobDetails, fetchDocuments, refetchFlexUuid]);

  const handleCreateFlexFolders = useCallback(async () => {
    if (!job || !jobId || isCreatingFlexFolders) return;

    try {
      setIsCreatingFlexFolders(true);

      const { data: existingFolders, error: existingError } = await supabase
        .from('flex_folders')
        .select('id')
        .eq('job_id', jobId)
        .limit(1);

      if (existingError) {
        throw existingError;
      }

      if (existingFolders && existingFolders.length > 0) {
        toast({
          title: 'Folders already exist',
          description: 'Flex folders have already been created for this job.',
        });
        return;
      }

      if (!job.start_time || !job.end_time) {
        toast({
          title: 'Missing job dates',
          description: 'Update the job dates before creating Flex folders.',
          variant: 'destructive',
        });
        return;
      }

      const startDate = new Date(job.start_time);
      const endDate = new Date(job.end_time);

      if (!isValid(startDate) || !isValid(endDate)) {
        toast({
          title: 'Invalid job dates',
          description: 'Please verify the job dates before creating Flex folders.',
          variant: 'destructive',
        });
        return;
      }

      const documentNumber = startDate.toISOString().slice(2, 10).replace(/-/g, '');
      const formattedStartDate = startDate.toISOString().split('.')[0] + '.000Z';
      const formattedEndDate = endDate.toISOString().split('.')[0] + '.000Z';

      toast({
        title: 'Creating Flex folders…',
        description: 'This may take a few seconds.',
      });

      await createAllFoldersForJob(job, formattedStartDate, formattedEndDate, documentNumber);

      toast({
        title: 'Flex folders ready',
        description: 'Folders have been created successfully.',
      });

      await refetchFlexUuid();
      await fetchJobDetails({ silent: true });
      await fetchDocuments();
    } catch (error: any) {
      console.error('Error creating Flex folders:', error);
      toast({
        title: 'Flex folder creation failed',
        description: error.message || 'Please try again in a moment.',
        variant: 'destructive',
      });
    } finally {
      setIsCreatingFlexFolders(false);
    }
  }, [job, jobId, isCreatingFlexFolders, toast, refetchFlexUuid, fetchJobDetails, fetchDocuments]);

  const handleFlexPickerConfirm = useCallback(
    async (options?: CreateFoldersOptions) => {
      if (!job || !jobId) {
        return;
      }

      setFlexPickerOptions(options);
      setIsFlexPickerOpen(false);

      if (!job.start_time || !job.end_time) {
        toast({
          title: 'Missing job dates',
          description: 'Update the job dates before adding Flex folders.',
          variant: 'destructive',
        });
        return;
      }

      const startDate = new Date(job.start_time);
      const endDate = new Date(job.end_time);

      if (!isValid(startDate) || !isValid(endDate)) {
        toast({
          title: 'Invalid job dates',
          description: 'Please verify the job dates before adding Flex folders.',
          variant: 'destructive',
        });
        return;
      }

      try {
        setIsCreatingFlexFolders(true);

        const documentNumber = startDate.toISOString().slice(2, 10).replace(/-/g, '');
        const formattedStartDate = startDate.toISOString().split('.')[0] + '.000Z';
        const formattedEndDate = endDate.toISOString().split('.')[0] + '.000Z';

        toast({
          title: 'Adding Flex folders…',
          description: 'Selected folders will be created in Flex.',
        });

        await createAllFoldersForJob(
          job,
          formattedStartDate,
          formattedEndDate,
          documentNumber,
          options,
        );

        toast({
          title: 'Flex folders updated',
          description: 'Selected folders have been added successfully.',
        });

        await Promise.all([
          refetchFlexUuid(),
          fetchJobDetails({ silent: true }),
          fetchDocuments(),
        ]);
      } catch (error: any) {
        console.error('Error adding Flex folders:', error);
        toast({
          title: 'Flex folder update failed',
          description: error.message || 'Please try again in a moment.',
          variant: 'destructive',
        });
      } finally {
        setIsCreatingFlexFolders(false);
      }
    },
    [job, jobId, toast, refetchFlexUuid, fetchJobDetails, fetchDocuments],
  );

  const flexStatus = useMemo(() => {
    if (isFlexLoading) {
      return { label: 'Checking status…', variant: 'outline' as const };
    }
    if (flexError) {
      return { label: 'Flex error', variant: 'destructive' as const };
    }
    if (folderExists) {
      return { label: 'Folders ready', variant: 'secondary' as const };
    }
    return { label: 'Folders not created', variant: 'outline' as const };
  }, [isFlexLoading, flexError, folderExists]);

  const isSchedulingRoute = location.pathname.includes('/scheduling');
  const isArtistRoute = location.pathname.includes('/artists');
  const isGearRoute = location.pathname.includes('/gear');
  
  const canEdit = ['admin', 'management', 'logistics'].includes(userRole || '');
  const isViewOnly = userRole === 'technician';

  useEffect(() => {
    fetchJobDetails();

    if (!jobId) {
      return;
    }

    const channel = supabase
      .channel(`job-${jobId}-updates`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'jobs',
        filter: `id=eq.${jobId}`,
      }, () => {
        fetchJobDetails({ silent: true });
        fetchDocuments();
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [jobId, fetchJobDetails, fetchDocuments]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handlePrintAllDocumentation = async (options: PrintOptions, filename: string) => {
    if (!jobId) return;
    
    setIsPrinting(true);
    try {
      console.log("Starting documentation print process with options:", options);
      
      let result: { blob: Blob; filename: string };
      
      if (options.generateIndividualStagePDFs) {
        console.log("Generating individual stage PDFs");
        result = await generateIndividualStagePDFs(jobId, job?.title || 'Festival', options, maxStages);
      } else {
        console.log("Generating combined PDF");
        result = await generateAndMergeFestivalPDFs(jobId, job?.title || 'Festival', options, filename);
      }
      
      console.log(`Generated file, size: ${result.blob.size} bytes`);
      if (!result.blob || result.blob.size === 0) {
        throw new Error('Generated file is empty');
      }
      
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Success",
        description: options.generateIndividualStagePDFs 
          ? 'Individual stage PDFs generated successfully'
          : 'Documentation generated successfully'
      });
    } catch (error: any) {
      console.error('Error generating documentation:', error);
      toast({
        title: "Error",
        description: `Failed to generate documentation: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setIsPrinting(false);
    }
  };

  const handlePrintButtonClick = () => {
    setIsPrintDialogOpen(true);
  };

  const handleFlexClick = () => {
    if (isFlexLoading) {
      toast({
        title: "Loading",
        description: "Please wait while we load the Flex folder...",
      });
      return;
    }

    if (flexUuid) {
      const flexUrl = `https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop#element/${flexUuid}/view/simple-element/header`;
      window.open(flexUrl, '_blank', 'noopener');
    } else if (flexError) {
      toast({
        title: "Error",
        description: flexError,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Info",
        description: "Flex folder not available for this festival",
      });
    }
  };

  if (!jobId) {
    return <div>Job ID is required</div>;
  }

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!job) {
    return <div>Festival not found</div>;
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                {isSingleJobMode ? (
                  <FileText className="h-6 w-6" />
                ) : (
                  <Music2 className="h-6 w-6" />
                )}
                {job?.title}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {isSingleJobMode ? 'Single Job Management' : 'Festival Management'} •
                {' '}
                {new Date(job?.start_time || '').toLocaleDateString()} - {new Date(job?.end_time || '').toLocaleDateString()}
              </p>
            </div>
            <div className="flex gap-2 items-center">
              {canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                  onClick={handlePrintButtonClick}
                  disabled={isPrinting}
                >
                  {isPrinting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Printer className="h-4 w-4" />
                  )}
                  {isPrinting ? 'Generating...' : 'Print Documentation'}
                </Button>
              )}
              {/* Only show Flex button if folder exists or is loading */}
              {canEdit && (folderExists || isFlexLoading) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                  onClick={handleFlexClick}
                  disabled={!flexUuid || isFlexLoading}
                >
                  {isFlexLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <img src={createFolderIcon} alt="Flex" className="h-4 w-4" />
                  )}
                  {isFlexLoading ? 'Loading...' : 'Flex'}
                </Button>
              )}
              {canEdit && <FestivalLogoManager jobId={jobId} />}
              {canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                  onClick={() => setIsJobPresetsOpen(true)}
                >
                  <Box className="h-4 w-4" />
                  Presets
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {!isSchedulingRoute && !isArtistRoute && !isGearRoute && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate(`/festival-management/${jobId}/artists`)}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Artists
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{artistCount}</p>
                <p className="text-sm text-muted-foreground">Total Artists</p>
                <Button className="mt-4 w-full" onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/festival-management/${jobId}/artists`);
                }}>
                  {isViewOnly ? "View Artists" : "Manage Artists"}
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate(`/festival-management/${jobId}/gear`)}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layout className="h-5 w-5" />
                  Stages & Gear
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Manage stages and technical equipment</p>
                <Button className="mt-4 w-full" onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/festival-management/${jobId}/gear`);
                }}>
                  {isViewOnly ? "View Gear" : "Manage Gear"}
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate(`/festival-management/${jobId}/scheduling`)}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Scheduling
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Manage shifts and staff assignments</p>
                <Button className="mt-4 w-full" onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/festival-management/${jobId}/scheduling`);
                }}>
                  {isViewOnly ? "View Schedule" : "Manage Schedule"}
                </Button>
              </CardContent>
            </Card>
          </div>
          
          <Card className="mt-6">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <RefreshCw className="h-5 w-5" />
                Quick Actions
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRefreshAll();
                }}
                disabled={isLoading || isLoadingDocuments}
                className="w-full sm:w-auto gap-2"
              >
                {isLoading || isLoadingDocuments ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Refresh Data
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Users className="h-4 w-4" />
                      Assignments
                    </div>
                    <Badge variant="outline">{humanizeDepartment(assignmentDepartment)}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Coordinate crew assignments by department.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Select value={assignmentDepartment} onValueChange={(value) => setAssignmentDepartment(value as Department)}>
                      <SelectTrigger className="sm:w-[160px]">
                        <SelectValue placeholder="Department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departmentOptions.map((dept) => (
                          <SelectItem key={dept} value={dept}>
                            {humanizeDepartment(dept)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={handleOpenAssignments}
                      disabled={!job || isAssignmentDialogOpen}
                      className="sm:flex-1"
                    >
                      Open
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <LinkIcon className="h-4 w-4" />
                    Flex Crew Calls
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Link Sound/Lights crew call element IDs.
                  </p>
                  <div className="flex">
                    {jobId && <CrewCallLinkerDialog jobId={jobId} />}
                  </div>
                </div>

                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Clock className="h-4 w-4" />
                    Timesheets
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Review and approve crew timesheets for this job.
                  </p>
                  <Button onClick={handleNavigateTimesheets} disabled={!jobId} className="w-full">
                    Open Timesheets
                  </Button>
                </div>

                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <MapPin className="h-4 w-4" />
                    Hoja de Ruta
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Generate and review the roadmap for this job.
                  </p>
                  <Button onClick={handleOpenRouteSheet} disabled={!jobId} className="w-full">
                    Open Hoja de Ruta
                  </Button>
                </div>

                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <FolderPlus className="h-4 w-4" />
                      Flex Folders
                    </div>
                    <Badge variant={flexStatus.variant}>{flexStatus.label}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Keep Flex folders in sync with this job&apos;s data.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      onClick={handleCreateFlexFolders}
                      disabled={!canEdit || !job || isCreatingFlexFolders || isFlexLoading}
                      className="sm:flex-1"
                    >
                      {isCreatingFlexFolders ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating…
                        </>
                      ) : (
                        'Create / Verify'
                      )}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={handleOpenFlexPicker}
                      disabled={
                        !canEdit ||
                        !job ||
                        isCreatingFlexFolders ||
                        isFlexLoading ||
                        !folderExists
                      }
                      className="sm:flex-1"
                    >
                      {isCreatingFlexFolders ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Updating…
                        </>
                      ) : (
                        'Add'
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleOpenFlexLogs}
                      disabled={!canEdit}
                      className="sm:flex-1"
                    >
                      View Logs
                    </Button>
                  </div>
                  {flexError && (
                    <p className="text-xs text-destructive">
                      {flexError}
                    </p>
                  )}
                </div>

                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <FileText className="h-4 w-4" />
                    Job Details
                  </div>
                  <p className="text-sm text-muted-foreground">
                    View the complete job configuration and metadata.
                  </p>
                  <Button onClick={handleOpenJobDetails} disabled={!job} className="w-full">
                    View Job Details
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Add Weather Section */}
          <FestivalWeatherSection
            jobId={jobId}
            venue={venueData}
            jobDates={jobDates}
          />

          <Card className="mt-6">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <FileText className="h-5 w-5" />
                Documents & Riders
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRefreshDocuments();
                }}
                disabled={isLoadingDocuments}
                className="w-full sm:w-auto"
              >
                {isLoadingDocuments ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {isLoadingDocuments ? 'Refreshing…' : 'Refresh'}
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoadingDocuments ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading documents…
                </div>
              ) : (
                <>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Job Documents
                    </h4>
                    {jobDocuments.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        {jobDocuments.map((doc) => {
                          const isTemplate = doc.template_type === 'soundvision';
                          const isReadOnly = Boolean(doc.read_only);
                          return (
                            <div key={doc.id} className="flex items-center justify-between rounded-md border bg-card px-3 py-2">
                              <div>
                                <div className="text-sm font-medium text-foreground flex items-center gap-2">
                                  {doc.file_name}
                                  {isTemplate && (
                                    <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                                      Template SoundVision File
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Uploaded {formatDateLabel(doc.uploaded_at)}
                                  {isReadOnly && <span className="ml-2 italic">Read-only</span>}
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleJobDocumentView(doc);
                                  }}
                                  title="View"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleJobDocumentDownload(doc);
                                  }}
                                  title="Download"
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-muted-foreground">
                        No job documents have been uploaded yet.
                      </p>
                    )}
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Artist Riders
                    </h4>
                    {groupedRiderFiles.length > 0 ? (
                      <div className="mt-3 space-y-4">
                        {groupedRiderFiles.map((artist) => (
                          <div key={artist.artistId} className="space-y-2">
                            <div className="text-sm font-medium text-foreground">{artist.artistName}</div>
                            <div className="space-y-2">
                              {artist.files.map((file) => (
                                <div key={file.id} className="flex items-center justify-between rounded-md border bg-accent/20 px-3 py-2">
                                  <div>
                                    <div className="text-sm font-medium text-foreground">{file.file_name}</div>
                                    <div className="text-xs text-muted-foreground">
                                      Uploaded {formatDateLabel(file.created_at)}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRiderView(file);
                                      }}
                                      title="View"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRiderDownload(file);
                                      }}
                                      title="Download"
                                    >
                                      <Download className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-muted-foreground">
                        No artist riders uploaded yet. Riders added through the artist table will appear here automatically.
                      </p>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
      
      {job && (
        <JobAssignmentDialog
          isOpen={isAssignmentDialogOpen}
          onClose={() => setIsAssignmentDialogOpen(false)}
          onAssignmentChange={handleAssignmentChange}
          jobId={job.id}
          department={assignmentDepartment}
        />
      )}

      {job && (
        <JobDetailsDialog
          open={isJobDetailsOpen}
          onOpenChange={setIsJobDetailsOpen}
          job={job}
          department={assignmentDepartment}
        />
      )}

      {jobId && (
        <FlexSyncLogDialog
          jobId={jobId}
          open={isFlexLogOpen}
          onOpenChange={setIsFlexLogOpen}
        />
      )}

      <FlexFolderPicker
        open={isFlexPickerOpen}
        onOpenChange={setIsFlexPickerOpen}
        onConfirm={handleFlexPickerConfirm}
        initialOptions={flexPickerOptions}
      />

      <Dialog open={isRouteSheetOpen} onOpenChange={setIsRouteSheetOpen}>
        <DialogContent className="max-w-[96vw] w-[96vw] h-[90vh] p-0 overflow-hidden">
          <div className="h-full overflow-auto">
            {jobId && <ModernHojaDeRuta jobId={jobId} />}
          </div>
        </DialogContent>
      </Dialog>

      {isSchedulingRoute && (
        <div>
          <div className="mb-4">
            <Button 
              variant="outline" 
              onClick={() => navigate(`/festival-management/${jobId}`)}
              className="flex items-center gap-1"
            >
              Back to Festival
            </Button>
          </div>
          
          {jobDates.length > 0 ? (
            <FestivalScheduling jobId={jobId} jobDates={jobDates} isViewOnly={isViewOnly} />
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground mb-4">No dates available for scheduling. Please update the festival dates first.</p>
                <Button onClick={() => navigate(`/festival-management/${jobId}`)}>
                  Go Back
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}
      
      {isPrintDialogOpen && (
        <PrintOptionsDialog
          open={isPrintDialogOpen}
          onOpenChange={setIsPrintDialogOpen}
          onConfirm={handlePrintAllDocumentation}
          maxStages={maxStages}
          jobTitle={job?.title || ''}
          jobId={jobId}
        />
      )}

      {/* Job Presets Manager */}
      {jobId && (
        <JobPresetManagerDialog
          open={isJobPresetsOpen}
          onOpenChange={setIsJobPresetsOpen}
          jobId={jobId}
        />
      )}
    </div>
  );
};

export default FestivalManagement;
