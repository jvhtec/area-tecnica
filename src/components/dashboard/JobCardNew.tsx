import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { createSafeFolderName, sanitizeFolderName } from "@/utils/folderNameSanitizer";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Department } from "@/types/department";
import createFolderIcon from "@/assets/icons/icon.png";
import { useNavigate } from "react-router-dom";
import { useDeletionState } from "@/hooks/useDeletionState";
import { deleteJobOptimistically } from "@/services/optimisticJobDeletionService";

import { 
  createAllFoldersForJob
} from "@/utils/flex-folders";

import { 
  Card 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plane, Wrench, Star, Moon, Mic, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  Clock,
  MapPin,
  Users,
  Edit,
  Trash2,
  Upload,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Eye,
  Download,
  FolderPlus,
  ClipboardList
} from "lucide-react";

import { SoundTaskDialog } from "@/components/sound/SoundTaskDialog";
import { LightsTaskDialog } from "@/components/lights/LightsTaskDialog";
import { VideoTaskDialog } from "@/components/video/VideoTaskDialog";
import { EditJobDialog } from "@/components/jobs/EditJobDialog";
import { JobAssignmentDialog } from "@/components/jobs/JobAssignmentDialog";

import { useFolderExistence } from "@/hooks/useFolderExistence";

// File System Access API types
declare global {
  interface Window {
    showDirectoryPicker(): Promise<FileSystemDirectoryHandle>;
  }
}

export interface JobDocument {
  id: string;
  file_name: string;
  file_path: string;
  uploaded_at: string;
}

export interface JobCardNewProps {
  job: any;
  onEditClick: (job: any) => void;
  onDeleteClick: (jobId: string) => void;
  onJobClick: (jobId: string) => void;
  showAssignments?: boolean;
  department?: Department;
  userRole?: string | null;
  onDeleteDocument?: (jobId: string, document: JobDocument) => void;
  showUpload?: boolean;
  showManageArtists?: boolean;
  isProjectManagementPage?: boolean;
  hideTasks?: boolean;
}

export function JobCardNew({
  job,
  onEditClick,
  onDeleteClick,
  onJobClick,
  showAssignments = false,
  department = "sound",
  userRole,
  onDeleteDocument,
  showUpload = false,
  showManageArtists = false,
  isProjectManagementPage = false,
  hideTasks = false
}: JobCardNewProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const isDark = theme === "dark";
  const { addDeletingJob, removeDeletingJob, isDeletingJob } = useDeletionState();

  // Add state for folder creation loading
  const [isCreatingFolders, setIsCreatingFolders] = useState(false);
  const [isCreatingLocalFolders, setIsCreatingLocalFolders] = useState(false);

  const borderColor = job.color ? job.color : "#7E69AB";
  const appliedBorderColor = isDark ? (job.darkColor ? job.darkColor : borderColor) : borderColor;
  const bgColor = job.color ? `${job.color}05` : "#7E69AB05";
  const appliedBgColor = isDark ? (job.darkColor ? `${job.darkColor}15` : bgColor) : bgColor;

  const [collapsed, setCollapsed] = useState(true);
  const [assignments, setAssignments] = useState(job.job_assignments || []);
  const [documents, setDocuments] = useState<JobDocument[]>(job.job_documents || []);
  const [dateTypes, setDateTypes] = useState<Record<string, any>>({});
  const [soundTaskDialogOpen, setSoundTaskDialogOpen] = useState(false);
  const [lightsTaskDialogOpen, setLightsTaskDialogOpen] = useState(false);
  const [videoTaskDialogOpen, setVideoTaskDialogOpen] = useState(false);
  const [editJobDialogOpen, setEditJobDialogOpen] = useState(false);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);

  // Check if this job is being deleted
  const isJobBeingDeleted = isDeletingJob(job.id);

  const getFlexButtonTitle = () => {
    if (isCreatingFolders) {
      return "Creating folders...";
    }
    return foldersAreCreated ? "Folders already exist" : "Create Flex folders";
  };

  const getDateTypeIcon = (jobId: string, date: Date, dateTypes: Record<string, any>) => {
    const key = `${jobId}-${format(date, "yyyy-MM-dd")}`;
    const dateType = dateTypes[key]?.type;
    switch (dateType) {
      case "travel":
        return <Plane className="h-3 w-3 text-blue-500" />;
      case "setup":
        return <Wrench className="h-3 w-3 text-yellow-500" />;
      case "show":
        return <Star className="h-3 w-3 text-green-500" />;
      case "off":
        return <Moon className="h-3 w-3 text-gray-500" />;
      case "rehearsal":
        return <Mic className="h-3 w-3 text-violet-500" />;
      default:
        return null;
    }
  };

  useEffect(() => {
    async function fetchDateTypes() {
      if (isJobBeingDeleted) return; // Prevent queries during deletion
      
      const { data, error } = await supabase
        .from("job_date_types")
        .select("*")
        .eq("job_id", job.id);
      if (!error && data && data.length > 0) {
        const key = `${job.id}-${format(new Date(job.start_time), "yyyy-MM-dd")}`;
        setDateTypes({ [key]: data[0] });
      }
    }
    fetchDateTypes();
  }, [job.id, job.start_time, isJobBeingDeleted]);

  const assignedTechnicians = job.job_type !== "dryhire"
    ? assignments
        .map((assignment: any) => {
          let role = null;
          switch (department) {
            case "sound":
              role = assignment.sound_role;
              break;
            case "lights":
              role = assignment.lights_role;
              break;
            case "video":
              role = assignment.video_role;
              break;
            default:
              role = assignment.sound_role || assignment.lights_role || assignment.video_role;
          }
          if (!role) return null;
          return {
            id: assignment.technician_id,
            name: `${assignment.profiles?.first_name || ""} ${assignment.profiles?.last_name || ""}`.trim(),
            role
          };
        })
        .filter(Boolean)
    : [];

  const { data: soundTasks } = useQuery({
    queryKey: ["sound-tasks", job.id],
    queryFn: async () => {
      if (department !== "sound" || isJobBeingDeleted) return null;
      const { data, error } = await supabase
        .from("sound_job_tasks")
        .select(
          `
            *,
            assigned_to (
              first_name,
              last_name
            ),
            task_documents(*)
          `
        )
        .eq("job_id", job.id);
      if (error) throw error;
      return data;
    },
    enabled: department === "sound" && !isJobBeingDeleted,
    retry: 3,
    retryDelay: 1000
  });

  const { data: personnel } = useQuery({
    queryKey: ["sound-personnel", job.id],
    queryFn: async () => {
      if (department !== "sound" || isJobBeingDeleted) return null;
      const { data: existingData, error: fetchError } = await supabase
        .from("sound_job_personnel")
        .select("*")
        .eq("job_id", job.id)
        .maybeSingle();
      if (fetchError && fetchError.code !== "PGRST116") throw fetchError;
      if (!existingData) {
        const { data: newData, error: insertError } = await supabase
          .from("sound_job_personnel")
          .insert({
            job_id: job.id,
            foh_engineers: 0,
            mon_engineers: 0,
            pa_techs: 0,
            rf_techs: 0
          })
          .select()
          .single();
        if (insertError) throw insertError;
        return newData;
      }
      return existingData;
    },
    enabled: department === "sound" && !isJobBeingDeleted
  });

  const updateFolderStatus = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("jobs")
        .update({ flex_folders_created: true })
        .eq("id", job.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    }
  });

  // Centralized delete handler with proper state management
  const handleDeleteClick = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // Check if already being deleted
    if (isJobBeingDeleted) {
      console.log("Dashboard JobCardNew: Job deletion already in progress");
      return;
    }

    if (!["admin", "management"].includes(userRole || "")) {
      toast({
        title: "Permission denied",
        description: "Only management users can delete jobs",
        variant: "destructive"
      });
      return;
    }

    if (!window.confirm("Are you sure you want to delete this job?")) {
      return;
    }

    try {
      console.log("Dashboard JobCardNew: Starting job deletion for:", job.id);
      
      // Mark job as being deleted to prevent race conditions
      addDeletingJob(job.id);
      
      // Cancel any ongoing queries for this job to prevent race conditions
      await queryClient.cancelQueries({ queryKey: ["sound-tasks", job.id] });
      await queryClient.cancelQueries({ queryKey: ["sound-personnel", job.id] });
      
      const result = await deleteJobOptimistically(job.id);
      
      if (result.success) {
        onDeleteClick(job.id);
        toast({
          title: "Success",
          description: "Job deleted successfully"
        });

        queryClient.invalidateQueries({ queryKey: ["jobs"] });
      } else {
        throw new Error(result.error || "Unknown deletion error");
      }
    } catch (error: any) {
      console.error("Dashboard JobCardNew: Error deleting job:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete job",
        variant: "destructive"
      });
    } finally {
      // Always remove from deletion state, even on error
      removeDeletingJob(job.id);
    }
  };

  // Check folder existence with proper loading state handling
  const { data: foldersExist, isLoading: isFoldersLoading } = useFolderExistence(job.id);
  
  // Updated logic: prioritize actual folder existence over database flags
  const actualFoldersExist = foldersExist === true;
  const systemThinksFoldersExist = job.flex_folders_created || job.flex_folders_exist;
  
  // Detect inconsistency for logging/debugging
  const hasInconsistency = systemThinksFoldersExist && !actualFoldersExist;
  if (hasInconsistency) {
    console.warn("Dashboard JobCardNew: Folder state inconsistency detected for job", job.id, {
      systemThinks: systemThinksFoldersExist,
      actualExists: actualFoldersExist,
      dbFlag: job.flex_folders_created,
      flexFoldersExist: job.flex_folders_exist
    });
  }
  
  // Final decision: only consider folders created if they actually exist
  const foldersAreCreated = actualFoldersExist;

  console.log("Dashboard JobCardNew: Updated folder status check for job", job.id, {
    actualFoldersExist,
    systemThinksFoldersExist,
    hasInconsistency,
    finalDecision: foldersAreCreated,
    isLoading: isFoldersLoading
  });

  const createFlexFoldersHandler = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (isCreatingFolders) {
      console.log("Dashboard JobCardNew: Folder creation already in progress");
      return;
    }

    console.log("Dashboard JobCardNew: Starting sophisticated folder creation for job:", job.id);

    if (actualFoldersExist) {
      console.log("Dashboard JobCardNew: Folders actually exist, preventing creation");
      toast({
        title: "Folders already created",
        description: "Flex folders have already been created for this job.",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsCreatingFolders(true);

      // Double-check in the database before creating
      const { data: existingFolders } = await supabase
        .from("flex_folders")
        .select("id")
        .eq("job_id", job.id)
        .limit(1);

      if (existingFolders && existingFolders.length > 0) {
        console.log("Dashboard JobCardNew: Found existing folders in final check:", existingFolders);
        toast({
          title: "Folders already exist",
          description: "Flex folders have already been created for this job.",
          variant: "destructive"
        });
        return;
      }

      // Use the correct ISO datetime format that works with Flex API
      const startDate = new Date(job.start_time);
      const documentNumber = startDate.toISOString().slice(2, 10).replace(/-/g, "");

      const formattedStartDate = new Date(job.start_time).toISOString().split(".")[0] + ".000Z";
      const formattedEndDate = new Date(job.end_time).toISOString().split(".")[0] + ".000Z";

      toast({
        title: "Creating folders...",
        description: "Setting up sophisticated Flex folder structure for this job."
      });

      await createAllFoldersForJob(job, formattedStartDate, formattedEndDate, documentNumber);

      toast({
        title: "Success!",
        description: "Flex folders have been created successfully with proper configuration."
      });

      // Refresh queries
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["folder-existence"] });

    } catch (error: any) {
      console.error("Dashboard JobCardNew: Error creating sophisticated flex folders:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create Flex folders",
        variant: "destructive"
      });
    } finally {
      setIsCreatingFolders(false);
    }
  };

  const createLocalFoldersHandler = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (isCreatingLocalFolders) {
      console.log("Dashboard JobCardNew: Local folder creation already in progress");
      return;
    }

    // Check if File System Access API is supported
    if (!('showDirectoryPicker' in window)) {
      toast({
        title: "Not supported",
        description: "Your browser doesn't support local folder creation. Please use Chrome, Edge, or another Chromium-based browser.",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsCreatingLocalFolders(true);

      // Ask user to pick a base folder
      const baseDirHandle = await window.showDirectoryPicker();

      // Format the start date as yymmdd
      const startDate = new Date(job.start_time);
      const formattedDate = format(startDate, "yyMMdd");
      
      // Create safe folder name
      const { name: rootFolderName, wasSanitized } = createSafeFolderName(job.title, formattedDate);
      
      if (wasSanitized) {
        console.log('Dashboard JobCardNew: Folder name was sanitized for safety:', { original: `${formattedDate} - ${job.title}`, sanitized: rootFolderName });
      }

      // Create root folder
      const rootDirHandle = await baseDirHandle.getDirectoryHandle(rootFolderName, { create: true });

      // Get current user's custom folder structure or use default
      const { data: { user } } = await supabase.auth.getUser();
      let folderStructure = null;
      
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('custom_folder_structure, role')
          .eq('id', user.id)
          .single();
        
        // Only use custom structure for management users
        if (profile && (profile.role === 'admin' || profile.role === 'management') && profile.custom_folder_structure) {
          folderStructure = profile.custom_folder_structure;
        }
      }
      
      // Default structure if no custom one exists
      if (!folderStructure) {
        folderStructure = [
          "CAD",
          "QT", 
          "Material",
          "Documentación",
          "Rentals",
          "Compras",
          "Rider",
          "Predicciones"
        ];
      }
      
      // Create folders based on structure
      if (Array.isArray(folderStructure)) {
        for (const folder of folderStructure) {
          if (typeof folder === 'string') {
            // Simple string structure
            const safeFolderName = sanitizeFolderName(folder);
            const subDirHandle = await rootDirHandle.getDirectoryHandle(safeFolderName, { create: true });
            await subDirHandle.getDirectoryHandle("OLD", { create: true });
          } else if (folder && typeof folder === 'object' && folder.name) {
            // Object structure with subfolders
            const safeFolderName = sanitizeFolderName(folder.name);
            const subDirHandle = await rootDirHandle.getDirectoryHandle(safeFolderName, { create: true });
            
            // Create subfolders if they exist
            if (folder.subfolders && Array.isArray(folder.subfolders)) {
              for (const subfolder of folder.subfolders) {
                const safeSubfolderName = sanitizeFolderName(subfolder);
                await subDirHandle.getDirectoryHandle(safeSubfolderName, { create: true });
              }
            } else {
              // Default to OLD subfolder if no subfolders specified
              await subDirHandle.getDirectoryHandle("OLD", { create: true });
            }
          }
        }
      }

      const isCustom = user && folderStructure !== null;
      toast({
        title: "Success!",
        description: `${isCustom ? 'Custom' : 'Default'} folder structure created at "${rootFolderName}"`
      });

    } catch (error: any) {
      console.error("Dashboard JobCardNew: Error creating local folders:", error);
      if (error.name === 'AbortError') {
        // User cancelled, don't show error
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to create local folder structure",
        variant: "destructive"
      });
    } finally {
      setIsCreatingLocalFolders(false);
    }
  };

  const calculateTotalProgress = () => {
    if (!soundTasks?.length) return 0;
    const totalProgress = soundTasks.reduce((acc, task) => acc + (task.progress || 0), 0);
    return Math.round(totalProgress / soundTasks.length);
  };

  const getCompletedTasks = () => {
    if (!soundTasks?.length) return 0;
    return soundTasks.filter((task: any) => task.status === "completed").length;
  };

  const getTotalPersonnel = () => {
    if (!personnel) return 0;
    return (
      (personnel.foh_engineers || 0) +
      (personnel.mon_engineers || 0)
      + (personnel.pa_techs || 0)
      + (personnel.rf_techs || 0)
    );
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEditClick(job);
  };

  const toggleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsed(!collapsed);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const file = e.target.files?.[0];
    if (!file || !department) return;

    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${department}/${job.id}/${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("job_documents")
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase
        .from("job_documents")
        .insert({
          job_id: job.id,
          file_name: file.name,
          file_path: filePath,
          file_type: file.type,
          file_size: file.size
        });
      if (dbError) throw dbError;

      queryClient.invalidateQueries({ queryKey: ["jobs"] });

      toast({
        title: "Document uploaded",
        description: "The document has been successfully uploaded."
      });
    } catch (err: any) {
      toast({
        title: "Upload failed",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  const handleViewDocument = async (doc: JobDocument) => {
    try {
      console.log("Attempting to view document:", doc);
      const { data, error } = await supabase.storage
        .from("job_documents")
        .createSignedUrl(doc.file_path, 60);

      if (error) {
        console.error("Error creating signed URL:", error);
        throw error;
      }

      console.log("Signed URL created:", data.signedUrl);
      window.open(data.signedUrl, "_blank");
    } catch (err: any) {
      console.error("Error in handleViewDocument:", err);
      toast({
        title: "Error viewing document",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  const handleDeleteDocument = async (doc: JobDocument) => {
    if (!window.confirm("Are you sure you want to delete this document?")) return;
    try {
      console.log("Starting document deletion:", doc);
      const { error: storageError } = await supabase.storage
        .from("job_documents")
        .remove([doc.file_path]);
      
      if (storageError) {
        console.error("Storage deletion error:", storageError);
        throw storageError;
      }

      const { error: dbError } = await supabase
        .from("job_documents")
        .delete()
        .eq("id", doc.id);
      
      if (dbError) {
        console.error("Database deletion error:", dbError);
        throw dbError;
      }

      queryClient.invalidateQueries({ queryKey: ["jobs"] });

      toast({
        title: "Document deleted",
        description: "The document has been successfully deleted."
      });
    } catch (err: any) {
      console.error("Error in handleDeleteDocument:", err);
      toast({
        title: "Error deleting document",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  const canEdit = userRole !== "logistics";

  const refreshData = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isJobBeingDeleted) return; // Don't refresh if job is being deleted
    
    await queryClient.invalidateQueries({ queryKey: ["jobs"] });
    await queryClient.invalidateQueries({ queryKey: ["sound-tasks", job.id] });
    await queryClient.invalidateQueries({ queryKey: ["sound-personnel", job.id] });

    toast({
      title: "Data refreshed",
      description: "The job information has been updated."
    });
  };

  const getBadgeForJobType = (jobType: string) => {
    switch (jobType) {
      case "tour":
        return <Badge variant="secondary" className="ml-2">Tour</Badge>;
      case "single":
        return <Badge variant="secondary" className="ml-2">Single</Badge>;
      case "festival":
        return <Badge variant="secondary" className="ml-2">Festival</Badge>;
      case "tourdate":
        return <Badge variant="secondary" className="ml-2">Tour Date</Badge>;
      case "dryhire":
        return <Badge variant="secondary" className="ml-2">Dry Hire</Badge>;
      default:
        return null;
    }
  };

  const handleJobCardClick = () => {
    if (isHouseTech || isJobBeingDeleted) {
      return; // Block job card clicks for house techs or jobs being deleted
    }
    
    if (isProjectManagementPage) {
      if (department === "sound") {
        setSoundTaskDialogOpen(true);
      } else if (department === "lights") {
        setLightsTaskDialogOpen(true);
      } else if (department === "video") {
        setVideoTaskDialogOpen(true);
      }
    } else {
      if (userRole !== "logistics") {
        onJobClick(job.id);
      }
    }
  };

  const handleEditButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isJobBeingDeleted) return;
    setEditJobDialogOpen(true);
  };

  const handleFestivalArtistsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isJobBeingDeleted) return;
    console.log("Navigating to festival management:", job.id);
    navigate(`/festival-management/${job.id}`);
  };

  const isHouseTech = userRole === 'house_tech';
  const canEditJobs = ['admin', 'management', 'logistics'].includes(userRole || '');
  const canManageArtists = ['admin', 'management', 'logistics', 'technician', 'house_tech'].includes(userRole || '');
  const canUploadDocuments = ['admin', 'management', 'logistics'].includes(userRole || '');
  const canCreateFlexFolders = ['admin', 'management', 'logistics'].includes(userRole || '');
  const canCreateLocalFolders = ['admin', 'management', 'logistics'].includes(userRole || '');

  // Show loading state if job is being deleted
  const cardOpacity = isJobBeingDeleted ? "opacity-50" : "";
  const pointerEvents = isJobBeingDeleted ? "pointer-events-none" : "";

  // Add timesheet handler
  const handleTimesheetClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isJobBeingDeleted) return;
    navigate(`/timesheets?jobId=${job.id}`);
  };

  console.log("Job card rendering with:", {
    jobType: job.job_type,
    showManageArtists,
    userRole,
    canManageArtists,
    isProjectManagementPage
  });

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-900">
      <Card
        className={cn(
          "mb-4 hover:shadow-md transition-all duration-200",
          !isHouseTech && !isJobBeingDeleted && "cursor-pointer",
          cardOpacity,
          pointerEvents
        )}
        onClick={handleJobCardClick}
        style={{
          borderLeftColor: appliedBorderColor,
          backgroundColor: appliedBgColor
        }}
      >
        {isJobBeingDeleted && (
          <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center z-10 rounded">
            <div className="bg-white dark:bg-gray-800 px-4 py-2 rounded-md shadow-lg">
              <span className="text-sm font-medium">Deleting job...</span>
            </div>
          </div>
        )}

        <div className="p-3 sm:p-6 pb-3">
          <div className="flex items-start justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-1">
              <div className="flex items-start sm:items-center gap-1 min-w-0 flex-1">
                <div className="shrink-0 mt-0.5 sm:mt-0">
                  {getDateTypeIcon(job.id, new Date(job.start_time), dateTypes)}
                </div>
                <div className="min-w-0 flex-1 pr-2">
                  {/* Mobile: Show job title on its own line with better spacing */}
                  <div className="sm:hidden">
                    <h3 className="font-medium text-sm leading-tight mb-1 pr-24">{job.title}</h3>
                    {getBadgeForJobType(job.job_type)}
                  </div>
                  {/* Desktop: Keep original layout */}
                  <div className="hidden sm:block">
                    <h3 className="font-medium text-lg leading-tight break-words line-clamp-2">{job.title}</h3>
                    <div className="mt-2">
                      {getBadgeForJobType(job.job_type)}
                    </div>
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleCollapse}
                title="Toggle Details"
                className="hover:bg-accent/50 shrink-0 h-8 w-8 sm:h-10 sm:w-10"
                disabled={isJobBeingDeleted}
              >
                {collapsed ? (
                  <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4" />
                ) : (
                  <ChevronUp className="h-3 w-3 sm:h-4 sm:w-4" />
                )}
              </Button>
            </div>
            <div className="flex flex-wrap gap-1 sm:gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
              {/* Timesheet button - available for all users */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleTimesheetClick}
                className="hover:bg-accent/50 text-xs sm:text-sm px-2 sm:px-3 h-7 sm:h-8"
                disabled={isJobBeingDeleted}
              >
                <ClipboardList className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Timesheet</span>
                <span className="sm:hidden">Time</span>
              </Button>
              
              {job.job_type === "festival" && isProjectManagementPage && canManageArtists && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFestivalArtistsClick}
                  className="hover:bg-accent/50 text-xs sm:text-sm px-2 sm:px-3 h-7 sm:h-8"
                  disabled={isJobBeingDeleted}
                >
                  <span className="hidden sm:inline">
                    {userRole === 'technician' || userRole === 'house_tech' ? 'View Festival' : 'Manage Festival'}
                  </span>
                  <span className="sm:hidden">Festival</span>
                </Button>
              )}
              {!isHouseTech && job.job_type !== "dryhire" && isProjectManagementPage && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isJobBeingDeleted) {
                      setAssignmentDialogOpen(true);
                    }
                  }}
                  className="hover:bg-accent/50 text-xs sm:text-sm px-2 sm:px-3 h-7 sm:h-8"
                  disabled={isJobBeingDeleted}
                >
                  <Users className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Assign</span>
                  <span className="sm:hidden">Assign</span>
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={refreshData}
                title="Refresh"
                className="hover:bg-accent/50 h-7 w-7 sm:h-8 sm:w-8"
                disabled={isJobBeingDeleted}
              >
                <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
              {canEditJobs && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleEditButtonClick}
                    title="Edit job details"
                    className="hover:bg-accent/50 h-7 w-7 sm:h-8 sm:w-8"
                    disabled={isJobBeingDeleted}
                  >
                    <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleDeleteClick}
                    className="hover:bg-accent/50 h-7 w-7 sm:h-8 sm:w-8"
                    disabled={isJobBeingDeleted}
                  >
                    <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                </>
              )}
              {canCreateFlexFolders && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={createFlexFoldersHandler}
                  disabled={foldersAreCreated || isJobBeingDeleted || isFoldersLoading || isCreatingFolders}
                  title={getFlexButtonTitle()}
                  className={
                    foldersAreCreated || isJobBeingDeleted || isFoldersLoading || isCreatingFolders
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:bg-accent/50"
                  }
                >
                  {isCreatingFolders ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <img src={createFolderIcon} alt="Create Flex folders" className="h-4 w-4" />
                  )}
                </Button>
              )}
              {canCreateLocalFolders && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={createLocalFoldersHandler}
                  disabled={isCreatingLocalFolders || isJobBeingDeleted}
                  title={isCreatingLocalFolders ? "Creating local folders..." : "Create local folder structure"}
                  className={
                    isCreatingLocalFolders || isJobBeingDeleted
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:bg-accent/50"
                  }
                >
                  {isCreatingLocalFolders ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FolderPlus className="h-4 w-4" />
                  )}
                </Button>
              )}
              {job.job_type !== "dryhire" && showUpload && canUploadDocuments && (
                <div className="relative">
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onClick={(ev) => ev.stopPropagation()}
                    disabled={isJobBeingDeleted}
                  />
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="hover:bg-accent/50"
                    disabled={isJobBeingDeleted}
                  >
                    <Upload className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-3 sm:px-6 pb-3 sm:pb-6">
          <div className="space-y-2 text-xs sm:text-sm">
            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="truncate">
                  {format(new Date(job.start_time), "MMM d, yyyy")} -{" "}
                  {format(new Date(job.end_time), "MMM d, yyyy")}
                </span>
                <span className="text-muted-foreground">
                  {format(new Date(job.start_time), "HH:mm")}
                </span>
              </div>
            </div>
            {job.location?.name && (
              <div className="flex items-center gap-2">
                <MapPin className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                <span className="font-medium truncate">{job.location.name}</span>
              </div>
            )}
            {job.job_type !== "dryhire" && (
              <>
                {assignedTechnicians.length > 0 && (
                  <div className="flex items-start gap-2">
                    <Users className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex flex-wrap gap-1 min-w-0">
                      {assignedTechnicians.map((tech) => (
                        <Badge key={tech.id} variant="secondary" className="text-xs max-w-full">
                          <span className="truncate">{tech.name} {tech.role && `(${tech.role})`}</span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                {documents.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <div className="text-xs sm:text-sm font-medium">Documents</div>
                    <div className="space-y-2">
                      {documents.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between p-2 rounded-md bg-accent/20 hover:bg-accent/30 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex flex-col min-w-0 flex-1 mr-2">
                            <span className="text-xs sm:text-sm font-medium truncate" title={doc.file_name}>
                              {doc.file_name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Uploaded {format(new Date(doc.uploaded_at), "MMM d, yyyy")}
                            </span>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleViewDocument(doc)}
                              title="View"
                              disabled={isJobBeingDeleted}
                              className="h-7 w-7 sm:h-8 sm:w-8"
                            >
                              <Eye className="h-3 w-3 sm:h-4 sm:w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDownload(doc)}
                              title="Download"
                              disabled={isJobBeingDeleted}
                              className="h-7 w-7 sm:h-8 sm:w-8"
                            >
                              <Download className="h-3 w-3 sm:h-4 sm:w-4" />
                            </Button>
                            {['admin', 'management'].includes(userRole || '') && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteDocument(doc)}
                                title="Delete"
                                disabled={isJobBeingDeleted}
                                className="h-7 w-7 sm:h-8 sm:w-8"
                              >
                                <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {!collapsed && job.job_type !== "dryhire" && !hideTasks && (
            <>
              {department === "sound" && personnel && (
                <>
                  <div className="mt-2 p-2 bg-accent/20 rounded-md">
                    <div className="text-xs font-medium mb-1">
                      Required Personnel: {getTotalPersonnel()}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>FOH Engineers: {personnel.foh_engineers || 0}</div>
                      <div>MON Engineers: {personnel.mon_engineers || 0}</div>
                      <div>PA Techs: {personnel.pa_techs || 0}</div>
                      <div>RF Techs: {personnel.rf_techs || 0}</div>
                    </div>
                  </div>

                  {soundTasks?.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          Task Progress ({getCompletedTasks()}/{soundTasks.length} completed)
                        </span>
                        <span>{calculateTotalProgress()}%</span>
                      </div>
                      <Progress value={calculateTotalProgress()} className="h-1" />
                      <div className="space-y-1">
                        {soundTasks.map((task: any) => (
                          <div key={task.id} className="flex items-center justify-between text-xs">
                            <span>{task.task_type}</span>
                            <div className="flex items-center gap-2">
                              {task.assigned_to && (
                                <span className="text-muted-foreground">
                                  {task.assigned_to.first_name} {task.assigned_to.last_name}
                                </span>
                              )}
                              <Badge variant={task.status === "completed" ? "default" : "secondary"}>
                                {task.status === "not_started"
                                  ? "Not Started"
                                  : task.status === "in_progress"
                                  ? "In Progress"
                                  : "Completed"}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </Card>

      {!isHouseTech && !isJobBeingDeleted && (
        <>
          {soundTaskDialogOpen && (
            <SoundTaskDialog
              open={soundTaskDialogOpen}
              onOpenChange={setSoundTaskDialogOpen}
              jobId={job.id}
            />
          )}
          {lightsTaskDialogOpen && (
            <LightsTaskDialog
              open={lightsTaskDialogOpen}
              onOpenChange={setLightsTaskDialogOpen}
              jobId={job.id}
            />
          )}
          {videoTaskDialogOpen && (
            <VideoTaskDialog
              open={videoTaskDialogOpen}
              onOpenChange={setVideoTaskDialogOpen}
              jobId={job.id}
            />
          )}
          {editJobDialogOpen && (
            <EditJobDialog
              open={editJobDialogOpen}
              onOpenChange={setEditJobDialogOpen}
              job={job}
            />
          )}
          {assignmentDialogOpen && job.job_type !== "dryhire" && (
            <JobAssignmentDialog
              isOpen={assignmentDialogOpen}
              onClose={() => setAssignmentDialogOpen(false)}
              onAssignmentChange={() => {}}
              jobId={job.id}
              department={department as Department}
            />
          )}
        </>
      )}
    </div>
  );
}

const handleDownload = async (doc: JobDocument) => {
  try {
    console.log('Starting download for document:', doc.file_name);
    
    const { data, error } = await supabase.storage
      .from('job_documents')
      .createSignedUrl(doc.file_path, 60);
    
    if (error) {
      console.error('Error creating signed URL for download:', error);
      throw error;
    }
    
    if (!data?.signedUrl) {
      throw new Error('Failed to generate download URL');
    }
    
    console.log('Download URL created:', data.signedUrl);
    
    const link = document.createElement('a');
    link.href = data.signedUrl;
    link.download = doc.file_name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
  } catch (err: any) {
    console.error('Error in handleDownload:', err);
    alert(`Error downloading document: ${err.message}`);
  }
};
