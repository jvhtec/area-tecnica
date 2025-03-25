import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Department } from "@/types/department";
import createFolderIcon from "@/assets/icons/icon.png";
import { useNavigate } from "react-router-dom";
import { JobStatusBadge } from "@/components/jobs/JobStatusBadge";

import { 
  createAllFoldersForJob
} from "@/utils/flex-folders";

import { 
  Card 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plane, Wrench, Star, Moon, Mic } from "lucide-react";
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
  Download
} from "lucide-react";

import { SoundTaskDialog } from "@/components/sound/SoundTaskDialog";
import { LightsTaskDialog } from "@/components/lights/LightsTaskDialog";
import { VideoTaskDialog } from "@/components/video/VideoTaskDialog";
import { EditJobDialog } from "@/components/jobs/EditJobDialog";
import { JobAssignmentDialog } from "@/components/jobs/JobAssignmentDialog";

import { useFolderExistence } from "@/hooks/useFolderExistence";

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
  }, [job.id, job.start_time]);

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
      if (department !== "sound") return null;
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
    enabled: department === "sound",
    retry: 3,
    retryDelay: 1000
  });

  const { data: personnel } = useQuery({
    queryKey: ["sound-personnel", job.id],
    queryFn: async () => {
      if (department !== "sound") return null;
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
    enabled: department === "sound"
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

  const createFlexFoldersHandler = async (e: React.MouseEvent) => {
    e.stopPropagation();

    console.log("Folder existence check:", {
      jobId: job.id,
      flexFoldersCreated: job.flex_folders_created,
      foldersExist,
      flexFoldersExist: job.flex_folders_exist,
      combined: foldersAreCreated
    });

    if (foldersAreCreated) {
      console.log("Folders already exist, preventing creation");
      toast({
        title: "Folders already created",
        description: "Flex folders have already been created for this job.",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log("Starting folder creation for job:", job.id);

      const { data: existingFolders } = await supabase
        .from("flex_folders")
        .select("id")
        .eq("job_id", job.id)
        .limit(1);

      if (existingFolders && existingFolders.length > 0) {
        console.log("Found existing folders in final check:", existingFolders);
        toast({
          title: "Folders already exist",
          description: "Flex folders have already been created for this job.",
          variant: "destructive"
        });
        return;
      }

      const startDate = new Date(job.start_time);
      const documentNumber = startDate
        .toISOString()
        .slice(2, 10)
        .replace(/-/g, "");

      const formattedStartDate = new Date(job.start_time).toISOString().split(".")[0] + ".000Z";
      const formattedEndDate = new Date(job.end_time).toISOString().split(".")[0] + ".000Z";

      await createAllFoldersForJob(job, formattedStartDate, formattedEndDate, documentNumber);
      await updateFolderStatus.mutateAsync();

      console.log("Successfully created folders for job:", job.id);
      toast({
        title: "Success",
        description: "Flex folders have been created successfully."
      });
    } catch (error: any) {
      console.error("Error creating Flex folders:", error);
      toast({
        title: "Error creating folders",
        description: error.message,
        variant: "destructive"
      });
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

  const handleDeleteClick = async (e: React.MouseEvent) => {
    e.stopPropagation();

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
      console.log("Deleting job:", job.id);

      const { data: soundTaskIds } = await supabase
        .from("sound_job_tasks")
        .select("id")
        .eq("job_id", job.id);
      const { data: lightsTaskIds } = await supabase
        .from("lights_job_tasks")
        .select("id")
        .eq("job_id", job.id);
      const { data: videoTaskIds } = await supabase
        .from("video_job_tasks")
        .select("id")
        .eq("job_id", job.id);

      if (soundTaskIds?.length) {
        const { error: soundDocsError } = await supabase
          .from("task_documents")
          .delete()
          .in("sound_task_id", soundTaskIds.map((t) => t.id));
        if (soundDocsError) throw soundDocsError;
      }
      if (lightsTaskIds?.length) {
        const { error: lightsDocsError } = await supabase
          .from("task_documents")
          .delete()
          .in("lights_task_id", lightsTaskIds.map((t) => t.id));
        if (lightsDocsError) throw lightsDocsError;
      }
      if (videoTaskIds?.length) {
        const { error: videoDocsError } = await supabase
          .from("task_documents")
          .delete()
          .in("video_task_id", videoTaskIds.map((t) => t.id));
        if (videoDocsError) throw videoDocsError;
      }

      await Promise.all([
        supabase.from("sound_job_tasks").delete().eq("job_id", job.id),
        supabase.from("lights_job_tasks").delete().eq("job_id", job.id),
        supabase.from("video_job_tasks").delete().eq("job_id", job.id)
      ]);

      await Promise.all([
        supabase.from("sound_job_personnel").delete().eq("job_id", job.id),
        supabase.from("lights_job_personnel").delete().eq("job_id", job.id),
        supabase.from("video_job_personnel").delete().eq("job_id", job.id)
      ]);

      if (job.job_documents?.length > 0) {
        const { error: storageError } = await supabase.storage
          .from("job_documents")
          .remove(job.job_documents.map((doc: JobDocument) => doc.file_path));
        if (storageError) throw storageError;
      }

      const { error: jobDocsError } = await supabase
        .from("job_documents")
        .delete()
        .eq("job_id", job.id);
      if (jobDocsError) throw jobDocsError;

      const { error: assignmentsError } = await supabase
        .from("job_assignments")
        .delete()
        .eq("job_id", job.id);
      if (assignmentsError) throw assignmentsError;

      const { error: departmentsError } = await supabase
        .from("job_departments")
        .delete()
        .eq("job_id", job.id);
      if (departmentsError) throw departmentsError;

      const { error: jobError } = await supabase
        .from("jobs")
        .delete()
        .eq("id", job.id);
      if (jobError) throw jobError;

      onDeleteClick(job.id);
      toast({
        title: "Success",
        description: "Job deleted successfully"
      });

      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    } catch (error: any) {
      console.error("Error deleting job:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete job",
        variant: "destructive"
      });
    }
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
    if (isHouseTech) {
      return; // Block job card clicks for house techs
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
    setEditJobDialogOpen(true);
  };

  const handleFestivalArtistsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log("Navigating to festival management:", job.id);
    navigate(`/festival-management/${job.id}`);
  };

  const isHouseTech = userRole === 'house_tech';
  const canEditJobs = ['admin', 'management', 'logistics'].includes(userRole || '');
  const canManageArtists = ['admin', 'management', 'logistics', 'technician', 'house_tech'].includes(userRole || '');
  const canUploadDocuments = ['admin', 'management', 'logistics'].includes(userRole || '');
  const canCreateFlexFolders = ['admin', 'management', 'logistics'].includes(userRole || '');

  const { data: foldersExist } = useFolderExistence(job.id);
  const foldersAreCreated = job.flex_folders_created || foldersExist || job.flex_folders_exist;

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
          !isHouseTech && "cursor-pointer"
        )}
        onClick={handleJobCardClick}
        style={{
          borderLeftColor: appliedBorderColor,
          backgroundColor: appliedBgColor
        }}
      >
        <div className="p-6 pb-3">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex items-center gap-1">
                {getDateTypeIcon(job.id, new Date(job.start_time), dateTypes)}
                <span className="font-medium text-lg truncate">{job.title}</span>
                {getBadgeForJobType(job.job_type)}
                <JobStatusBadge jobId={job.id} status={job.status} />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleCollapse}
                title="Toggle Details"
                className="ml-2 hover:bg-accent/50 shrink-0"
              >
                {collapsed ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronUp className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
              {job.job_type === "festival" && isProjectManagementPage && canManageArtists && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFestivalArtistsClick}
                  className="hover:bg-accent/50"
                >
                  {userRole === 'technician' || userRole === 'house_tech' ? 'View Festival' : 'Manage Festival'}
                </Button>
              )}
              {!isHouseTech && job.job_type !== "dryhire" && isProjectManagementPage && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAssignmentDialogOpen(true);
                  }}
                  className="hover:bg-accent/50"
                >
                  <Users className="h-4 w-4 mr-2" />
                  Assign
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={refreshData}
                title="Refresh"
                className="hover:bg-accent/50"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              {canEditJobs && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleEditButtonClick}
                    title="Edit job details"
                    className="hover:bg-accent/50"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleDeleteClick}
                    className="hover:bg-accent/50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
              {canCreateFlexFolders && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={createFlexFoldersHandler}
                  disabled={foldersAreCreated}
                  title={
                    foldersAreCreated
                      ? "Folders already exist"
                      : "Create Flex folders"
                  }
                  className={
                    foldersAreCreated
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:bg-accent/50"
                  }
                >
                  <img src={createFolderIcon} alt="Create Flex folders" className="h-4 w-4" />
                </Button>
              )}
              {job.job_type !== "dryhire" && showUpload && canUploadDocuments && (
                <div className="relative">
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onClick={(ev) => ev.stopPropagation()}
                  />
                  <Button variant="ghost" size="icon" className="hover:bg-accent/50">
                    <Upload className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 pb-6">
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div className="flex flex-col">
                <span>
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
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{job.location.name}</span>
              </div>
            )}
            {job.job_type !== "dryhire" && (
              <>
                {assignedTechnicians.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-wrap gap-1">
                      {assignedTechnicians.map((tech) => (
                        <Badge key={tech.id} variant="secondary" className="text-xs">
                          {tech.name} {tech.role && `(${tech.role})`}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                {documents.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <div className="text-sm font-medium">Documents</div>
                    <div className="space-y-2">
                      {documents.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between p-2 rounded-md bg-accent/20 hover:bg-accent/30 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{doc.file_name}</span>
                            <span className="text-xs text-muted-foreground">
                              Uploaded {format(new Date(doc.uploaded_at), "MMM d, yyyy")}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleViewDocument(doc)}
                              title="View"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDownload(doc)}
                              title="Download"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            {['admin', 'management'].includes(userRole || '') && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteDocument(doc)}
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
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

      {!isHouseTech && (
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
              open={assignmentDialogOpen}
              onOpenChange={setAssignmentDialogOpen}
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
