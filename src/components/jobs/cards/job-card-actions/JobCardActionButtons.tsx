import type React from "react";
import {
  Clock,
  Edit,
  ExternalLink,
  FolderPlus,
  Info,
  ListChecks,
  Loader2,
  MessageCircle,
  RefreshCw,
  Scale,
  ScrollText,
  Settings,
  Trash2,
  Upload,
  Users,
  Zap,
} from "lucide-react";

import createFolderIcon from "@/assets/icons/icon.png";
import { TechnicianIncidentReportDialog } from "@/components/incident-reports/TechnicianIncidentReportDialog";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ArchiveToFlexAction } from "@/components/jobs/cards/job-card-actions/ArchiveToFlexAction";
import { BackfillDocTecnicaAction } from "@/components/jobs/cards/job-card-actions/BackfillDocTecnicaAction";
import type {
  FlexOpeningState,
  JobCardActionsProps,
  TechnicalPowerPackState,
} from "@/components/jobs/cards/job-card-actions/types";
import { cn } from "@/lib/utils";
import { hasPrepDayDateType } from "@/utils/timesheetPrepDays";
import { canSubmitTechnicianIncidentReports } from "@/utils/permissions";

type JobCardActionButtonsProps = JobCardActionsProps & {
  allowedJobType: boolean;
  canSendProductionWhatsapp: boolean;
  canViewCalculators: boolean;
  defaultsInfo?: { weight: boolean; power: boolean };
  flexOpening: FlexOpeningState;
  handleManageJob: (e: React.MouseEvent) => void;
  handleTimesheetClick: (e: React.MouseEvent) => void;
  isFestivalLike: boolean;
  isManagementUser: boolean;
  isMobile: boolean;
  isTechnicianUser: boolean;
  navigateToCalculator: (e: React.MouseEvent, type: "pesos" | "consumos") => void;
  openProductionWhatsappDialog: () => void;
  openWarehouseWhatsappDialog: () => void;
  technicalPower: TechnicalPowerPackState;
};

const WAREHOUSE_LABEL_BY_DEPARTMENT: Partial<Record<NonNullable<JobCardActionsProps["department"]>, string>> = {
  sound: "sonido",
  lights: "iluminación",
  video: "video",
  production: "producción",
};

const getWarehouseDepartmentLabel = (department: JobCardActionsProps["department"]) => (
  department ? WAREHOUSE_LABEL_BY_DEPARTMENT[department] ?? department : "sonido"
);

export const JobCardActionButtons = ({
  allowedJobType,
  canCreateFlexFolders,
  canEditJobs,
  canManageArtists,
  canSendProductionWhatsapp,
  canSyncFlex,
  canUploadDocuments,
  canViewCalculators,
  defaultsInfo,
  department,
  flexOpening,
  folderStateLoading = false,
  foldersAreCreated,
  handleFileUpload,
  handleManageJob,
  handleTimesheetClick,
  isCreatingFolders = false,
  isCreatingLocalFolders = false,
  isFestivalLike,
  isHouseTech,
  isManagementUser,
  isMobile,
  isProjectManagementPage,
  isTechnicianUser,
  job,
  navigateToCalculator,
  onAddFlexFolders,
  onAssignmentDialogOpen,
  onCreateFlexFolders,
  onCreateLocalFolders,
  onCreateWhatsappGroup,
  onDeleteClick,
  onEditButtonClick,
  onFestivalArtistsClick,
  onJobDetailsClick,
  onOpenFlexLogs,
  onOpenTasks,
  onRefreshData,
  onRetryWhatsappGroup,
  onSyncFlex,
  onTransportClick,
  openProductionWhatsappDialog,
  openWarehouseWhatsappDialog,
  showUpload,
  techName,
  technicalPower,
  transportButtonLabel,
  transportButtonTone,
  userRole,
  whatsappDisabled,
  whatsappGroup,
  whatsappRequest,
}: JobCardActionButtonsProps) => {
  const normalizedJobType = String(job.job_type || "").toLowerCase();
  const canOpenTimesheets = !["dryhire", "dry_hire"].includes(normalizedJobType) && (
    normalizedJobType !== "tourdate" || hasPrepDayDateType(job.job_date_types)
  );

  return (
  <div className={cn("flex flex-wrap", isMobile ? "gap-1" : "gap-1.5")} onClick={(e) => e.stopPropagation()}>
    {isProjectManagementPage && job.job_type !== "dryhire" && onOpenTasks && (
      <Button
        variant="outline"
        size="sm"
        onClick={onOpenTasks}
        className="gap-2"
        title="Tareas"
      >
        <ListChecks className="h-4 w-4" />
        <span className="hidden sm:inline">Tareas</span>
      </Button>
    )}
    {transportButtonLabel && onTransportClick && (
      <Button
        variant={transportButtonTone || "outline"}
        size="sm"
        onClick={onTransportClick}
        className="gap-2"
        title={transportButtonLabel}
      >
        {transportButtonLabel}
      </Button>
    )}
    {(
      isProjectManagementPage &&
      department !== "production" &&
      isManagementUser &&
      onCreateWhatsappGroup &&
      job.job_type !== "dryhire" &&
      !isFestivalLike
    ) && (
      <>
        {whatsappRequest && !whatsappGroup && onRetryWhatsappGroup ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetryWhatsappGroup}
            className="gap-2 border-orange-500 text-orange-600 hover:bg-orange-50"
            title="Reintentar crear grupo WhatsApp"
          >
            <MessageCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Reintentar</span>
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={onCreateWhatsappGroup}
            disabled={!!whatsappDisabled}
            className="gap-2"
            title={whatsappDisabled ? "Grupo ya creado" : "Crear grupo WhatsApp"}
          >
            <MessageCircle className="h-4 w-4" />
            <span className="hidden sm:inline">WhatsApp</span>
          </Button>
        )}
      </>
    )}
    {isProjectManagementPage && department !== "production" && isManagementUser && (
      <Button
        variant="outline"
        size="sm"
        onClick={openWarehouseWhatsappDialog}
        className="gap-2"
        title={`Enviar mensaje a Almacén ${getWarehouseDepartmentLabel(department)}`}
      >
        <MessageCircle className="h-4 w-4" />
        <span className="hidden sm:inline">Almacén</span>
      </Button>
    )}
    {canSendProductionWhatsapp && (
      <Button
        variant="outline"
        size="sm"
        onClick={openProductionWhatsappDialog}
        className="gap-2"
        title="Enviar WhatsApp a personal asignado"
      >
        <MessageCircle className="h-4 w-4" />
        <span className="hidden sm:inline">Aviso WA</span>
      </Button>
    )}
    {onJobDetailsClick && (
      <Button
        variant="outline"
        size="sm"
        onClick={onJobDetailsClick}
        className="gap-2"
      >
        <Info className="h-4 w-4" />
        <span className="hidden sm:inline">Ver Detalles</span>
      </Button>
    )}
    {isFestivalLike && isProjectManagementPage && canManageArtists && (
      <Button
        variant="outline"
        size="sm"
        onClick={onFestivalArtistsClick}
        className="hover:bg-accent/50"
        title={isTechnicianUser ? "Ver Festival" : "Gestionar Festival"}
      >
        <Users className="h-4 w-4 mr-1" />
        <span className="hidden sm:inline">{isTechnicianUser ? "Ver Festival" : "Gestionar Festival"}</span>
      </Button>
    )}
    {!isFestivalLike && job.job_type !== "dryhire" && isProjectManagementPage && canManageArtists && (
      <Button
        variant="outline"
        size="sm"
        onClick={handleManageJob}
        className="hover:bg-accent/50"
        title={isTechnicianUser ? "Ver Trabajo" : "Gestionar Trabajo"}
      >
        <Settings className="h-4 w-4 mr-1" />
        <span className="hidden sm:inline">{isTechnicianUser ? "Ver Trabajo" : "Gestionar Trabajo"}</span>
      </Button>
    )}
    {!isHouseTech && job.job_type !== "dryhire" && isProjectManagementPage && (
      <Button
        variant="outline"
        size="sm"
        onClick={onAssignmentDialogOpen}
        className="hover:bg-accent/50"
        title="Asignar"
      >
        <Users className="h-4 w-4 mr-1" />
        <span className="hidden sm:inline">Asignar</span>
      </Button>
    )}
    <Button
      variant="ghost"
      size="icon"
      onClick={onRefreshData}
      title="Actualizar"
      className="hover:bg-accent/50"
    >
      <RefreshCw className="h-4 w-4" />
    </Button>
    {isProjectManagementPage && canSyncFlex && (
      <Button
        variant="ghost"
        size="icon"
        onClick={onSyncFlex}
        title="Sincronizar estado con Flex"
        className="hover:bg-accent/50"
      >
        <RefreshCw className="h-4 w-4" />
      </Button>
    )}
    {canOpenTimesheets && (
      <Button
        variant="ghost"
        size="icon"
        onClick={handleTimesheetClick}
        title={normalizedJobType === "tourdate" ? "Gestionar partes de preparación" : "Gestionar Hojas de Tiempo"}
        className="hover:bg-accent/50"
      >
        <Clock className="h-4 w-4" />
      </Button>
    )}
    {canViewCalculators && allowedJobType && (
      <>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          title="Calculadora de Pesos"
          onClick={(e) => navigateToCalculator(e, "pesos")}
        >
          <Scale className="h-4 w-4" />
          <span className="hidden sm:inline">Pesos</span>
          {defaultsInfo?.weight && <span className="ml-1 inline-block h-2 w-2 rounded-full bg-green-500" title="Existen valores predeterminados de gira" />}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          title="Calculadora de Consumos"
          onClick={(e) => navigateToCalculator(e, "consumos")}
        >
          <Zap className="h-4 w-4" />
          <span className="hidden sm:inline">Consumos</span>
          {defaultsInfo?.power && <span className="ml-1 inline-block h-2 w-2 rounded-full bg-green-500" title="Existen valores predeterminados de gira" />}
        </Button>
      </>
    )}
    {technicalPower.canGenerateTechnicalPowerPack && allowedJobType && (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                title="Resumen tecnico de potencia"
                disabled={
                  technicalPower.isGeneratingTechnicalPowerPack ||
                  technicalPower.isTechnicalPowerDepartmentsLoading ||
                  technicalPower.isTechnicalPowerSummaryPreviewLoading ||
                  (!technicalPower.canRetryTechnicalPowerPack &&
                    (!technicalPower.hasRequiredTechnicalPowerDepartments ||
                      !technicalPower.hasAvailableTechnicalPowerDepartments))
                }
                onClick={technicalPower.handleGenerateTechnicalPowerPack}
              >
                {technicalPower.isGeneratingTechnicalPowerPack ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ScrollText className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">Resumen Potencia</span>
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {technicalPower.getTechnicalPowerPackTooltip()}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )}
    {canSubmitTechnicianIncidentReports(userRole) && job.job_type !== "dryhire" && (
      <TechnicianIncidentReportDialog
        job={job}
        techName={techName}
      />
    )}
    {canEditJobs && (
      <>
        <Button
          variant="ghost"
          size="icon"
          onClick={onEditButtonClick}
          title="Editar detalles del trabajo"
          className="hover:bg-accent/50"
        >
          <Edit className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDeleteClick}
          title="Eliminar trabajo"
          className="hover:bg-accent/50"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </>
    )}
    {canCreateFlexFolders && (
      foldersAreCreated ? (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              if (!flexOpening.canOpenFlex) {
                e.stopPropagation();
                return;
              }
              flexOpening.handleOpenFlex(e);
            }}
            disabled={!flexOpening.canOpenFlex}
            className="gap-2"
            title={
              !flexOpening.canOpenFlex
                ? "No hay un elemento Flex válido disponible"
                : flexOpening.isFlexLoading || isCreatingFolders || folderStateLoading
                  ? "Cargando…"
                  : "Abrir en Flex"
            }
          >
            {(flexOpening.isFlexLoading || isCreatingFolders || folderStateLoading) ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ExternalLink className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">Abrir Flex</span>
          </Button>

          {job.job_type !== "dryhire" && onAddFlexFolders ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={onAddFlexFolders}
              disabled={folderStateLoading || isCreatingFolders}
              title="Añadir carpetas Flex"
              className={
                folderStateLoading || isCreatingFolders
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:bg-accent/50"
              }
            >
              <img
                src={createFolderIcon}
                alt="Añadir carpetas Flex"
                width={16}
                height={16}
                loading="lazy"
                decoding="async"
                className="h-4 w-4"
              />
            </Button>
          ) : null}
        </>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          onClick={onCreateFlexFolders}
          disabled={folderStateLoading || isCreatingFolders}
          title={flexOpening.getFlexButtonTitle()}
          className={
            folderStateLoading || isCreatingFolders
              ? "opacity-50 cursor-not-allowed"
              : "hover:bg-accent/50"
          }
        >
          {isCreatingFolders ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <img
              src={createFolderIcon}
              alt="Crear carpetas Flex"
              width={16}
              height={16}
              loading="lazy"
              decoding="async"
              className="h-4 w-4"
            />
          )}
        </Button>
      )
    )}
    <Button
      variant="ghost"
      size="icon"
      onClick={onCreateLocalFolders}
      disabled={isCreatingLocalFolders}
      title={isCreatingLocalFolders ? "Creando carpetas locales..." : "Crear estructura de carpetas locales"}
      className={
        isCreatingLocalFolders
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
    <ArchiveToFlexAction job={job} />
    <BackfillDocTecnicaAction job={job} />
    {job.job_type !== "dryhire" && showUpload && canUploadDocuments && (
      <div className="relative">
        <input
          type="file"
          multiple
          aria-label="Subir documento"
          onChange={handleFileUpload}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          onClick={(ev) => ev.stopPropagation()}
        />
        <Button variant="ghost" size="icon" className="hover:bg-accent/50" title="Subir documento" aria-label="Subir documento">
          <Upload className="h-4 w-4" />
        </Button>
      </div>
    )}
    {isProjectManagementPage && canSyncFlex && (
      <Button
        variant="outline"
        size="sm"
        onClick={onOpenFlexLogs}
        className="gap-2"
        title="Registros de Sincronización"
      >
        <ScrollText className="h-4 w-4" />
        <span className="hidden sm:inline">Registros</span>
      </Button>
    )}
  </div>
  );
};
