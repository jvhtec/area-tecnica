import React from "react";
import { createPortal } from "react-dom";
import { useReducedMotion } from "framer-motion";
import { ChevronDown, ChevronRight, Download, Eye } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ModernHojaDeRuta } from "@/components/hoja-de-ruta/ModernHojaDeRuta";
import { FlexSyncLogDialog } from "@/components/jobs/FlexSyncLogDialog";
import { JobAssignmentDialog } from "@/components/jobs/JobAssignmentDialog";
import { JobDetailsDialog } from "@/components/jobs/JobDetailsDialog";
import { EditJobDialog } from "@/components/jobs/EditJobDialog";
import { JobRequirementsEditor } from "@/components/jobs/JobRequirementsEditor";
import { LightsTaskDialog } from "@/components/lights/LightsTaskDialog";
import { LogisticsEventDialog } from "@/components/logistics/LogisticsEventDialog";
import { TransportRequestDialog } from "@/components/logistics/TransportRequestDialog";
import { SoundTaskDialog } from "@/components/sound/SoundTaskDialog";
import { TaskManagerDialog } from "@/components/tasks/TaskManagerDialog";
import { VideoTaskDialog } from "@/components/video/VideoTaskDialog";
import { FlexFolderPicker } from "@/components/flex/FlexFolderPicker";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import type { Department } from "@/types/department";

import { JobCardActions } from "../JobCardActions";
import { JobCardAssignments } from "../JobCardAssignments";
import { JobCardDocuments } from "../JobCardDocuments";
import { JobCardHeader } from "../JobCardHeader";
import { JobCardProgress } from "../JobCardProgress";
import { ConfettiBurst } from "@/components/ui/celebration/ConfettiBurst";

export interface JobCardNewViewProps {
  job: any;
  department: Department;
  userRole?: string | null;
  isProjectManagementPage: boolean;
  hideTasks: boolean;
  isHouseTech: boolean;
  isJobBeingDeleted: boolean;
  cardOpacity: string;
  pointerEvents: string;
  appliedBorderColor: string;
  appliedBgColor: string;
  collapsed: boolean;
  toggleCollapse: () => void;
  handleJobCardClick: (e?: React.MouseEvent) => void;
  isSelected: boolean;

  routeSheetOpen: boolean;
  setRouteSheetOpen: (open: boolean) => void;

  foldersAreCreated: boolean;
  isFoldersLoading: boolean;
  showUpload: boolean;
  canEditJobs: boolean;
  canCreateFlexFolders: boolean;
  canUploadDocuments: boolean;
  canManageArtists: boolean;
  isCreatingFolders: boolean;
  isCreatingLocalFolders: boolean;

  techName?: string;
  assignments: any[];
  jobTimesheets?: any[];
  documents: any[];
  docsCollapsed: boolean;
  setDocsCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  handleDeleteDocument: (jobId: string, document: any) => void;

  riderFiles: Array<{ id: string; file_name: string; file_path: string; uploaded_at: string; artist_id: string }>;
  cardArtistNameMap: Map<string, string>;
  ridersCollapsed: boolean;
  setRidersCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  viewRider: (file: { file_path: string }) => void | Promise<void>;
  downloadRider: (file: { file_path: string; file_name: string }) => void | Promise<void>;

  soundTasks: any;
  reqSummary: any;
  requiredVsAssigned: any;
  setRequirementsDialogOpen: (open: boolean) => void;

  refreshData: (e: React.MouseEvent) => void;
  handleEditButtonClick: (e: React.MouseEvent) => void;
  handleDeleteClick: (e: React.MouseEvent) => void;
  createFlexFoldersHandler: (e: React.MouseEvent) => void;
  addFlexFoldersHandler: (e: React.MouseEvent) => void;
  createLocalFoldersHandler: (e: React.MouseEvent) => void;
  handleFestivalArtistsClick: (e: React.MouseEvent) => void;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  syncStatusToFlex: (e: React.MouseEvent) => void;

  transportButtonLabel?: string;
  transportButtonTone?: any;
  handleTransportClick: (e: React.MouseEvent) => void;
  handleCreateWhatsappGroup: (e: React.MouseEvent) => void;
  handleRetryWhatsappGroup: (e: React.MouseEvent) => void;
  waGroup?: any;
  waRequest?: any;

  setTaskManagerOpen: (open: boolean) => void;
  taskManagerOpen: boolean;
  soundTaskDialogOpen: boolean;
  setSoundTaskDialogOpen: (open: boolean) => void;
  lightsTaskDialogOpen: boolean;
  setLightsTaskDialogOpen: (open: boolean) => void;
  videoTaskDialogOpen: boolean;
  setVideoTaskDialogOpen: (open: boolean) => void;
  editJobDialogOpen: boolean;
  setEditJobDialogOpen: (open: boolean) => void;
  assignmentDialogOpen: boolean;
  setAssignmentDialogOpen: (open: boolean) => void;
  jobDetailsDialogOpen: boolean;
  setJobDetailsDialogOpen: (open: boolean) => void;
  flexLogDialogOpen: boolean;
  setFlexLogDialogOpen: (open: boolean) => void;

  transportDialogOpen: boolean;
  setTransportDialogOpen: (open: boolean) => void;
  logisticsDialogOpen: boolean;
  setLogisticsDialogOpen: (open: boolean) => void;
  selectedTransportRequest: any | null;
  setSelectedTransportRequest: (value: any | null) => void;
  logisticsInitialEventType: "load" | "unload" | undefined;
  setLogisticsInitialEventType: (value: "load" | "unload" | undefined) => void;

  isTechDept: boolean;
  userDepartment: string | null;
  myTransportRequest: any | null;
  allRequests: any[];
  queryClient: any;
  checkAndFulfillRequest: (requestId: string, dept: string) => Promise<void>;

  requirementsDialogOpen: boolean;

  flexPickerOpen: boolean;
  setFlexPickerOpen: (open: boolean) => void;
  flexPickerOptions: any;
  handleFlexPickerConfirm: (opts: any) => void;
}

export function JobCardNewView({
  job,
  department,
  userRole,
  isProjectManagementPage,
  hideTasks,
  isHouseTech,
  isJobBeingDeleted,
  cardOpacity,
  pointerEvents,
  appliedBorderColor,
  appliedBgColor,
  collapsed,
  isSelected,
  toggleCollapse,
  handleJobCardClick,
  routeSheetOpen,
  setRouteSheetOpen,
  foldersAreCreated,
  isFoldersLoading,
  showUpload,
  canEditJobs,
  canCreateFlexFolders,
  canUploadDocuments,
  canManageArtists,
  isCreatingFolders,
  isCreatingLocalFolders,
  techName,
  assignments,
  jobTimesheets,
  documents,
  docsCollapsed,
  setDocsCollapsed,
  handleDeleteDocument,
  riderFiles,
  cardArtistNameMap,
  ridersCollapsed,
  setRidersCollapsed,
  viewRider,
  downloadRider,
  soundTasks,
  reqSummary,
  requiredVsAssigned,
  setRequirementsDialogOpen,
  refreshData,
  handleEditButtonClick,
  handleDeleteClick,
  createFlexFoldersHandler,
  addFlexFoldersHandler,
  createLocalFoldersHandler,
  handleFestivalArtistsClick,
  handleFileUpload,
  syncStatusToFlex,
  transportButtonLabel,
  transportButtonTone,
  handleTransportClick,
  handleCreateWhatsappGroup,
  handleRetryWhatsappGroup,
  waGroup,
  waRequest,
  setTaskManagerOpen,
  taskManagerOpen,
  soundTaskDialogOpen,
  setSoundTaskDialogOpen,
  lightsTaskDialogOpen,
  setLightsTaskDialogOpen,
  videoTaskDialogOpen,
  setVideoTaskDialogOpen,
  editJobDialogOpen,
  setEditJobDialogOpen,
  assignmentDialogOpen,
  setAssignmentDialogOpen,
  jobDetailsDialogOpen,
  setJobDetailsDialogOpen,
  flexLogDialogOpen,
  setFlexLogDialogOpen,
  transportDialogOpen,
  setTransportDialogOpen,
  logisticsDialogOpen,
  setLogisticsDialogOpen,
  selectedTransportRequest,
  setSelectedTransportRequest,
  logisticsInitialEventType,
  setLogisticsInitialEventType,
  isTechDept,
  userDepartment,
  myTransportRequest,
  allRequests,
  queryClient,
  checkAndFulfillRequest,
  requirementsDialogOpen,
  flexPickerOpen,
  setFlexPickerOpen,
  flexPickerOptions,
  handleFlexPickerConfirm,
}: JobCardNewViewProps) {
  const reducedMotion = useReducedMotion();
  const isAndreaWeddingJob = job?.id === "eeb00e4d-7d38-4687-9d04-31471b89adfc";
  const [celebrateSeed, setCelebrateSeed] = React.useState(0);
  const lastCelebrateAtRef = React.useRef(0);

  const handleCelebrateCapture = React.useCallback((e: React.MouseEvent) => {
    if (!isAndreaWeddingJob) return;
    if (reducedMotion) return;

    const target = e.target as HTMLElement | null;
    if (!target) return;

    // Only celebrate on "action" interactions, not on plain text clicks.
    const actionable = target.closest(
      'button,a,[role="button"],input[type="checkbox"],input[type="radio"],select'
    ) as HTMLElement | null;
    if (!actionable) return;

    const now = Date.now();
    if (now - lastCelebrateAtRef.current < 700) return; // throttle
    lastCelebrateAtRef.current = now;

    setCelebrateSeed((s) => (s + 1) % 1_000_000);
  }, [isAndreaWeddingJob, reducedMotion]);

  return (
    <div>
      <Card
        className={cn(
          "mb-4 hover:shadow-md transition-all duration-200 relative overflow-hidden",
          !isHouseTech && !isJobBeingDeleted && "cursor-pointer",
          cardOpacity,
          pointerEvents,
          isSelected && "ring-2 ring-primary ring-offset-2 shadow-lg"
        )}
        onClickCapture={handleCelebrateCapture}
        onClick={handleJobCardClick}
        style={{
          borderLeftColor: appliedBorderColor,
          borderLeftWidth: "4px",
          backgroundColor: appliedBgColor,
        }}
      >
        {isAndreaWeddingJob && celebrateSeed > 0 && typeof document !== 'undefined' && (
          createPortal(<ConfettiBurst seed={celebrateSeed} />, document.body)
        )}

        {isJobBeingDeleted && (
          <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center z-10 rounded">
            <div className="bg-white dark:bg-gray-800 px-4 py-2 rounded-md shadow-lg">
              <span className="text-sm font-medium">Deleting job...</span>
            </div>
          </div>
        )}

        <JobCardHeader
          job={job}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapse}
          appliedBorderColor={appliedBorderColor}
          appliedBgColor={appliedBgColor}
          dateTypes={job.job_date_types || {}}
          department={department}
          isProjectManagementPage={isProjectManagementPage}
          userRole={userRole}
        />

        <div className="flex items-center justify-between px-6">
          <div className="flex items-center gap-2">
            {isProjectManagementPage && job.job_type !== "dryhire" && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setRouteSheetOpen(true);
                }}
                className="text-xs px-3 py-1 border rounded-md hover:bg-secondary"
                title="Abrir Hoja de Ruta"
              >
                Hoja de Ruta
              </button>
            )}
            {job.job_type === "dryhire" && <Badge variant="destructive">RECOGIDA CLIENTE</Badge>}
            <div className="flex-1" />
          </div>
          <JobCardActions
            job={job}
            userRole={userRole || null}
            foldersAreCreated={foldersAreCreated}
            folderStateLoading={isFoldersLoading}
            isProjectManagementPage={isProjectManagementPage}
            isHouseTech={isHouseTech}
            showUpload={showUpload}
            canEditJobs={canEditJobs}
            canCreateFlexFolders={canCreateFlexFolders}
            canUploadDocuments={canUploadDocuments}
            canManageArtists={canManageArtists}
            department={department}
            isCreatingFolders={isCreatingFolders}
            isCreatingLocalFolders={isCreatingLocalFolders}
            techName={techName || ""}
            onRefreshData={refreshData}
            onEditButtonClick={handleEditButtonClick}
            onDeleteClick={handleDeleteClick}
            onCreateFlexFolders={createFlexFoldersHandler}
            onAddFlexFolders={addFlexFoldersHandler}
            onCreateLocalFolders={createLocalFoldersHandler}
            onFestivalArtistsClick={handleFestivalArtistsClick}
            onAssignmentDialogOpen={(e) => {
              e.stopPropagation();
              if (!isJobBeingDeleted) {
                setAssignmentDialogOpen(true);
              }
            }}
            handleFileUpload={handleFileUpload}
            onJobDetailsClick={() => setJobDetailsDialogOpen(true)}
            onOpenTasks={(e) => {
              e.stopPropagation();
              setTaskManagerOpen(true);
            }}
            canSyncFlex={["admin", "management", "logistics"].includes(userRole || "")}
            onSyncFlex={syncStatusToFlex}
            onOpenFlexLogs={(e) => {
              e.stopPropagation();
              setFlexLogDialogOpen(true);
            }}
            transportButtonLabel={job.job_type === "dryhire" ? undefined : transportButtonLabel}
            transportButtonTone={transportButtonTone}
            onTransportClick={handleTransportClick}
            onCreateWhatsappGroup={handleCreateWhatsappGroup}
            onRetryWhatsappGroup={handleRetryWhatsappGroup}
            whatsappDisabled={!!waGroup || !!waRequest}
            whatsappGroup={waGroup}
            whatsappRequest={waRequest}
          />
        </div>

        {job.job_type !== "dryhire" && Array.isArray(job.job_departments) && job.job_departments.length > 0 && (
          <div className="px-6 mt-2 flex items-center justify-between">
            <div className="flex gap-3 flex-wrap text-sm">
              {job.job_departments.map((d: any) => {
                const dept = d.department as "sound" | "lights" | "video";
                const stats = (requiredVsAssigned as any)[dept] || { required: 0, assigned: 0 };
                const need = stats.required || 0;
                const have = stats.assigned || 0;
                const cls =
                  need === 0
                    ? "bg-muted text-muted-foreground"
                    : have >= need
                      ? "bg-green-500/20 text-green-700 dark:text-green-300"
                      : have > 0
                        ? "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300"
                        : "bg-red-500/20 text-red-700 dark:text-red-300";
                return (
                  <div key={dept} className={`px-2 py-1 rounded ${cls}`}>
                    <span className="capitalize">{dept}</span>: <span className="tabular-nums">{have}/{need}</span>
                  </div>
                );
              })}
            </div>
            {["admin", "management", "logistics"].includes(userRole || "") && (
              <button
                type="button"
                className="text-xs px-2 py-1 border rounded-md hover:bg-secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  setRequirementsDialogOpen(true);
                }}
              >
                Edit requirements
              </button>
            )}
          </div>
        )}

        <div className="px-6 pb-6">
          <div className="space-y-2 text-sm">
            {job.job_type !== "dryhire" && (
              <>
                {assignments.length > 0 && (
                  <JobCardAssignments assignments={assignments} department={department} jobTimesheets={jobTimesheets || []} />
                )}

                {documents.length > 0 && (
                  <div className="mt-2">
                    <button
                      type="button"
                      className="w-full flex items-center justify-between text-left px-2 py-1 rounded hover:bg-accent/40"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDocsCollapsed((prev) => !prev);
                      }}
                    >
                      <span className="text-sm font-medium">Documents ({documents.length})</span>
                      {docsCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    {!docsCollapsed && (
                      <div className="mt-1">
                        <JobCardDocuments
                          documents={documents}
                          userRole={userRole}
                          onDeleteDocument={(jobId, document) => handleDeleteDocument(jobId, document)}
                          showTitle={false}
                        />
                      </div>
                    )}
                  </div>
                )}

                {riderFiles.length > 0 && (
                  <div className="mt-2">
                    <button
                      type="button"
                      className="w-full flex items-center justify-between text-left px-2 py-1 rounded hover:bg-accent/40"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRidersCollapsed((prev) => !prev);
                      }}
                    >
                      <span className="text-sm font-medium">Artist Riders ({riderFiles.length})</span>
                      {ridersCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    {!ridersCollapsed && (
                      <div className="mt-1 space-y-2">
                        {riderFiles.map((file) => (
                          <div
                            key={file.id}
                            className="flex items-center justify-between p-2 rounded-md bg-accent/20 hover:bg-accent/30 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">{file.file_name}</span>
                              <span className="text-xs text-muted-foreground">
                                Artist: {cardArtistNameMap.get(file.artist_id) || "Unknown"}
                              </span>
                            </div>
                            <div className="flex gap-2">
                              <button className="p-1 hover:bg-accent rounded" title="View" onClick={() => viewRider(file)}>
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                className="p-1 hover:bg-accent rounded"
                                title="Download"
                                onClick={() => downloadRider(file)}
                              >
                                <Download className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {!collapsed && job.job_type !== "dryhire" && !hideTasks && <JobCardProgress soundTasks={soundTasks} roleSummary={reqSummary} />}
        </div>
      </Card>

      {!isHouseTech && !isJobBeingDeleted && (
        <>
          {taskManagerOpen && (
            <TaskManagerDialog open={taskManagerOpen} onOpenChange={setTaskManagerOpen} userRole={userRole} jobId={job.id} />
          )}
          {soundTaskDialogOpen && <SoundTaskDialog open={soundTaskDialogOpen} onOpenChange={setSoundTaskDialogOpen} jobId={job.id} />}
          {lightsTaskDialogOpen && <LightsTaskDialog open={lightsTaskDialogOpen} onOpenChange={setLightsTaskDialogOpen} jobId={job.id} />}
          {videoTaskDialogOpen && <VideoTaskDialog open={videoTaskDialogOpen} onOpenChange={setVideoTaskDialogOpen} jobId={job.id} />}
          {editJobDialogOpen && <EditJobDialog open={editJobDialogOpen} onOpenChange={setEditJobDialogOpen} job={job} />}
          {assignmentDialogOpen && job.job_type !== "dryhire" && (
            <JobAssignmentDialog
              isOpen={assignmentDialogOpen}
              onClose={() => setAssignmentDialogOpen(false)}
              onAssignmentChange={() => {}}
              jobId={job.id}
              department={department as Department}
            />
          )}

          <JobDetailsDialog open={jobDetailsDialogOpen} onOpenChange={setJobDetailsDialogOpen} job={job} department={department} />

          <FlexSyncLogDialog jobId={job.id} open={flexLogDialogOpen} onOpenChange={setFlexLogDialogOpen} />

          {isProjectManagementPage && (
            <Dialog open={routeSheetOpen} onOpenChange={setRouteSheetOpen}>
              <DialogContent className="max-w-[96vw] w-[96vw] h-[96vh] p-0 overflow-hidden">
                <div className="h-full overflow-auto">
                  <ModernHojaDeRuta jobId={job.id} />
                </div>
              </DialogContent>
            </Dialog>
          )}

          {transportDialogOpen && isTechDept && userDepartment && (
            <TransportRequestDialog
              open={transportDialogOpen}
              onOpenChange={setTransportDialogOpen}
              jobId={job.id}
              department={userDepartment}
              requestId={myTransportRequest?.id || null}
              onSubmitted={() => {
                queryClient.invalidateQueries({ queryKey: ["transport-request", job.id, userDepartment] });
                queryClient.invalidateQueries({ queryKey: ["transport-requests-all", job.id] });
              }}
            />
          )}

          {transportDialogOpen &&
            (userDepartment === "logistics" || ((userRole === "management" || userRole === "admin") && !isTechDept)) && (
              <Dialog open={transportDialogOpen} onOpenChange={setTransportDialogOpen}>
                <DialogContent className="max-w-xl">
                  <div className="space-y-4">
                    <div className="text-lg font-semibold">Transport Requests</div>
                    {allRequests.length === 0 ? (
                      <div className="text-muted-foreground">No pending requests for this job.</div>
                    ) : (
                      <div className="space-y-2">
                        {allRequests.map((req: any) => (
                          <div key={req.id} className="border rounded p-2 space-y-2">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium capitalize">{req.department}</div>
                                {req.description && <div className="text-sm">{req.description}</div>}
                                {req.note && <div className="text-xs text-muted-foreground italic">{req.note}</div>}
                              </div>
                              <button
                                className="px-3 py-1 text-sm rounded border hover:bg-accent"
                                onClick={async (ev) => {
                                  ev.stopPropagation();
                                  await supabase.from("transport_requests").update({ status: "cancelled" }).eq("id", req.id);
                                  queryClient.invalidateQueries({ queryKey: ["transport-requests-all", job.id] });
                                }}
                              >
                                Cancel Request
                              </button>
                            </div>
                            <div className="space-y-1">
                              {(req.items || []).map((it: any) => (
                                <div key={it.id} className="flex items-center justify-between pl-2">
                                  <div className="text-sm text-muted-foreground">
                                    {it.transport_type.replace("_", " ")}
                                    {typeof it.leftover_space_meters === "number" && (
                                      <span className="ml-2">· Leftover: {it.leftover_space_meters} m</span>
                                    )}
                                  </div>
                                  <button
                                    className="px-3 py-1 text-sm rounded border hover:bg-accent"
                                    onClick={(ev) => {
                                      ev.stopPropagation();
                                      setSelectedTransportRequest({ ...req, selectedItem: it });
                                      setLogisticsInitialEventType("load");
                                      setTransportDialogOpen(false);
                                      setLogisticsDialogOpen(true);
                                    }}
                                  >
                                    Create Event
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            )}

          {logisticsDialogOpen && selectedTransportRequest && (
            <LogisticsEventDialog
              open={logisticsDialogOpen}
              onOpenChange={(open) => {
                setLogisticsDialogOpen(open);
                if (!open) {
                  queryClient.invalidateQueries({ queryKey: ["logistics-events-for-job", job.id] });
                  queryClient.invalidateQueries({ queryKey: ["today-logistics"] });
                }
              }}
              selectedDate={new Date(job.start_time)}
              initialJobId={job.id}
              initialDepartments={[selectedTransportRequest.department]}
              initialTransportType={selectedTransportRequest.selectedItem?.transport_type}
              initialEventType={logisticsInitialEventType}
              onCreated={(_details) => {
                if (selectedTransportRequest?.id && selectedTransportRequest?.department) {
                  void checkAndFulfillRequest(selectedTransportRequest.id, selectedTransportRequest.department);
                }
                setLogisticsInitialEventType(undefined);
              }}
            />
          )}

          {requirementsDialogOpen && (
            <JobRequirementsEditor
              open={requirementsDialogOpen}
              onOpenChange={setRequirementsDialogOpen}
              jobId={job.id}
              departments={(job.job_departments || []).map((d: any) => d.department)}
            />
          )}

          <FlexFolderPicker open={flexPickerOpen} onOpenChange={setFlexPickerOpen} onConfirm={handleFlexPickerConfirm} initialOptions={flexPickerOptions} />
        </>
      )}
    </div>
  );
}
