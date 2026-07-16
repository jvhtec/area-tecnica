import * as React from "react";
import {
  Clock,
  Copy,
  Edit,
  ExternalLink,
  FileStack,
  FolderPlus,
  Info,
  ListChecks,
  MessageCircle,
  MoreHorizontal,
  RefreshCw,
  Scale,
  ScrollText,
  Settings,
  Trash2,
  Truck,
  Upload,
  Users,
  Zap,
} from "lucide-react";

import { TechnicianIncidentReportDialog } from "@/components/incident-reports/TechnicianIncidentReportDialog";
import { ArchiveToFlexAction } from "@/components/jobs/cards/job-card-actions/ArchiveToFlexAction";
import { BackfillDocTecnicaAction } from "@/components/jobs/cards/job-card-actions/BackfillDocTecnicaAction";
import { MotorCertificateAction } from "@/components/jobs/cards/job-card-actions/MotorCertificateAction";
import { PrintFlexReportAction } from "@/components/jobs/cards/job-card-actions/PrintFlexReportAction";
import type {
  JobCardActionButtonsProps,
  JobCardActionsProps,
} from "@/components/jobs/cards/job-card-actions/types";
import { Button } from "@/components/ui/button";
import {
  MobileActionSheet,
  type MobileActionSheetGroup,
} from "@/components/ui/mobile-action-sheet";
import { canSubmitTechnicianIncidentReports } from "@/utils/permissions";
import { DOCUMENT_UPLOAD_ACCEPT } from "@/utils/documentUploadValidation";
import { hasPrepDayDateType } from "@/utils/timesheetPrepDays";

const WAREHOUSE_LABEL_BY_DEPARTMENT: Partial<
  Record<NonNullable<JobCardActionsProps["department"]>, string>
> = {
  sound: "sonido",
  lights: "iluminación",
  video: "video",
  production: "producción",
};

const getWarehouseDepartmentLabel = (department: JobCardActionsProps["department"]) => (
  department ? WAREHOUSE_LABEL_BY_DEPARTMENT[department] ?? department : "sonido"
);

export const MobileJobCardActions = (props: JobCardActionButtonsProps) => {
  const {
    allowedJobType,
    canCreateFlexFolders,
    canEditJobs,
    canManageArtists,
    canSendProductionWhatsapp,
    canSyncFlex,
    canUploadDocuments,
    canViewCalculators,
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
    isProjectManagementPage,
    isTechnicianUser,
    job,
    navigateToCalculator,
    navigateToMemoria,
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
    openDuplicateSoundDocsDialog,
    openProductionWhatsappDialog,
    openWarehouseWhatsappDialog,
    showUpload,
    techName,
    technicalPower,
    transportButtonLabel,
    userRole,
    whatsappDisabled,
    whatsappGroup,
    whatsappRequest,
  } = props;
  const uploadInputRef = React.useRef<HTMLInputElement>(null);
  const isProductionDepartment = department === "production";
  const canAssign = !isProductionDepartment && !isHouseTech && job.job_type !== "dryhire";
  const canDuplicateSoundDocs =
    department === "sound" && isManagementUser && allowedJobType && job.job_type !== "dryhire";
  const flexReportDepartment = department === "sound" || department === "lights" ? department : null;
  const normalizedJobType = String(job.job_type || "").toLowerCase();
  const canOpenTimesheets = !["dryhire", "dry_hire"].includes(normalizedJobType) && (
    normalizedJobType !== "tourdate" || hasPrepDayDateType(job.job_date_types)
  );
  const showProductionLogisticsAction =
    isProductionDepartment && isManagementUser && job.job_type !== "dryhire" && Boolean(onTransportClick);
  const whatsappAction = whatsappRequest && !whatsappGroup && onRetryWhatsappGroup
    ? {
        id: "retry-whatsapp",
        label: "Reintentar WhatsApp",
        icon: MessageCircle,
        onSelect: onRetryWhatsappGroup,
      }
    : onCreateWhatsappGroup && !isProductionDepartment && isManagementUser && job.job_type !== "dryhire" && !isFestivalLike
      ? {
          id: "create-whatsapp",
          label: "Crear grupo de WhatsApp",
          icon: MessageCircle,
          disabled: Boolean(whatsappDisabled),
          onSelect: onCreateWhatsappGroup,
        }
      : null;
  const flexFolderAction = canCreateFlexFolders
    ? foldersAreCreated
      ? {
          id: "open-flex",
          label: "Abrir en Flex",
          description: flexOpening.canOpenFlex ? undefined : "No hay un elemento Flex válido",
          icon: ExternalLink,
          disabled: !flexOpening.canOpenFlex || flexOpening.isFlexLoading || folderStateLoading,
          onSelect: flexOpening.handleOpenFlex,
        }
      : !isProductionDepartment
        ? {
            id: "create-flex-folders",
            label: "Crear carpetas Flex",
            icon: FolderPlus,
            disabled: folderStateLoading || isCreatingFolders,
            onSelect: onCreateFlexFolders,
          }
        : null
    : null;
  const actionGroups: MobileActionSheetGroup[] = [
    {
      id: "personnel",
      label: "Personal y operación",
      actions: [
        ...(showProductionLogisticsAction && onTransportClick ? [{
          id: "logistics", label: "Logística", icon: Truck, onSelect: onTransportClick,
        }] : []),
        ...(!isProductionDepartment && transportButtonLabel && onTransportClick ? [{
          id: "transport", label: transportButtonLabel, icon: Truck, onSelect: onTransportClick,
        }] : []),
        ...(whatsappAction ? [whatsappAction] : []),
        ...(!isProductionDepartment && isManagementUser ? [{
          id: "warehouse-whatsapp",
          label: `Avisar a Almacén de ${getWarehouseDepartmentLabel(department)}`,
          icon: MessageCircle,
          onSelect: () => openWarehouseWhatsappDialog(),
        }] : []),
        ...(canSendProductionWhatsapp ? [{
          id: "production-whatsapp",
          label: "Avisar al personal asignado",
          icon: MessageCircle,
          onSelect: () => openProductionWhatsappDialog(),
        }] : []),
        ...(isFestivalLike && canManageArtists ? [{
          id: "festival",
          label: isTechnicianUser ? "Ver festival" : "Gestionar festival",
          icon: Users,
          onSelect: onFestivalArtistsClick,
        }] : []),
        ...(!isFestivalLike && job.job_type !== "dryhire" && canManageArtists ? [{
          id: "manage-job",
          label: isTechnicianUser ? "Ver trabajo" : "Gestionar trabajo",
          icon: Settings,
          onSelect: handleManageJob,
        }] : []),
        ...(!isProductionDepartment && canOpenTimesheets ? [{
          id: "timesheets",
          label: normalizedJobType === "tourdate" ? "Partes de preparación" : "Hojas de tiempo",
          icon: Clock,
          onSelect: handleTimesheetClick,
        }] : []),
      ],
    },
    {
      id: "documents",
      label: "Documentos y herramientas",
      actions: [
        ...(!isProductionDepartment && canViewCalculators && allowedJobType ? [
          {
            id: "weight-calculator",
            label: "Calculadora de pesos",
            icon: Scale,
            onSelect: (event: React.MouseEvent<HTMLButtonElement>) => navigateToCalculator(event, "pesos"),
          },
          {
            id: "power-calculator",
            label: "Calculadora de consumos",
            icon: Zap,
            onSelect: (event: React.MouseEvent<HTMLButtonElement>) => navigateToCalculator(event, "consumos"),
          },
          { id: "technical-report", label: "Memoria técnica", icon: FileStack, onSelect: navigateToMemoria },
        ] : []),
        ...(canDuplicateSoundDocs ? [{
          id: "duplicate-sound-docs",
          label: "Duplicar documentación de sonido",
          icon: Copy,
          onSelect: () => openDuplicateSoundDocsDialog(),
        }] : []),
        ...(technicalPower.canGenerateTechnicalPowerPack && allowedJobType ? [{
          id: "technical-power",
          label: "Resumen técnico de potencia",
          description: technicalPower.getTechnicalPowerPackTooltip(),
          icon: ScrollText,
          disabled:
            technicalPower.isGeneratingTechnicalPowerPack ||
            technicalPower.isTechnicalPowerDepartmentsLoading ||
            technicalPower.isTechnicalPowerSummaryPreviewLoading ||
            (!technicalPower.canRetryTechnicalPowerPack &&
              (!technicalPower.hasRequiredTechnicalPowerDepartments ||
                !technicalPower.hasAvailableTechnicalPowerDepartments)),
          onSelect: technicalPower.handleGenerateTechnicalPowerPack,
        }] : []),
        ...(job.job_type !== "dryhire" && showUpload && canUploadDocuments ? [{
          id: "upload-document",
          label: "Subir documentos",
          icon: Upload,
          onSelect: () => uploadInputRef.current?.click(),
        }] : []),
        ...(canEditJobs ? [{
          id: "edit-job", label: "Editar trabajo", icon: Edit, onSelect: onEditButtonClick,
        }] : []),
      ],
    },
    {
      id: "flex",
      label: "Flex y sincronización",
      actions: [
        { id: "refresh", label: "Actualizar datos", icon: RefreshCw, onSelect: onRefreshData },
        ...(!isProductionDepartment && canSyncFlex && onSyncFlex ? [{
          id: "sync-flex", label: "Sincronizar con Flex", icon: RefreshCw, onSelect: onSyncFlex,
        }] : []),
        ...(flexFolderAction ? [flexFolderAction] : []),
        ...(foldersAreCreated && !isProductionDepartment && onAddFlexFolders ? [{
          id: "add-flex-folders",
          label: "Añadir carpetas Flex",
          icon: FolderPlus,
          disabled: folderStateLoading || isCreatingFolders,
          onSelect: onAddFlexFolders,
        }] : []),
        {
          id: "create-local-folders",
          label: "Crear carpetas locales",
          icon: FolderPlus,
          disabled: isCreatingLocalFolders,
          onSelect: onCreateLocalFolders,
        },
        ...(!isProductionDepartment && canSyncFlex && onOpenFlexLogs ? [{
          id: "flex-logs", label: "Registros de sincronización", icon: ScrollText, onSelect: onOpenFlexLogs,
        }] : []),
      ],
    },
    {
      id: "danger",
      label: "Peligro",
      actions: canEditJobs ? [{
        id: "delete-job",
        label: "Eliminar trabajo",
        icon: Trash2,
        destructive: true,
        onSelect: onDeleteClick,
      }] : [],
    },
  ];
  const hasReportActions =
    (Boolean(flexReportDepartment) && isManagementUser) ||
    (isProductionDepartment && isManagementUser) ||
    !isProductionDepartment;

  return (
    <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
      {job.job_type !== "dryhire" && onOpenTasks && (
        <Button variant="outline" size="sm" onClick={onOpenTasks} className="gap-2">
          <ListChecks className="h-4 w-4" /> Tareas
        </Button>
      )}
      {canAssign && (
        <Button variant="outline" size="sm" onClick={onAssignmentDialogOpen} className="gap-2">
          <Users className="h-4 w-4" /> Asignar
        </Button>
      )}
      {onJobDetailsClick && (
        <Button variant="outline" size="sm" onClick={onJobDetailsClick} className="gap-2">
          <Info className="h-4 w-4" /> Detalles
        </Button>
      )}
      <MobileActionSheet
        title="Más acciones"
        description={`Acciones para ${job.job_name || job.name || "este trabajo"}`}
        groups={actionGroups}
        trigger={(
          <Button variant="secondary" size="sm" className="gap-2">
            <MoreHorizontal className="h-4 w-4" /> Más
          </Button>
        )}
      >
        {hasReportActions && (
          <section aria-label="Acciones adicionales" className="space-y-1">
            <h3 className="px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Informes y archivo
            </h3>
            <div className="grid gap-2 rounded-xl border bg-card p-2 [&_button]:min-h-11 [&_button]:w-full [&_button]:justify-start [&_button_span]:inline">
              {flexReportDepartment && isManagementUser && (
                <>
                  <PrintFlexReportAction job={job} department={flexReportDepartment} reportType="material-list" />
                  <PrintFlexReportAction job={job} department={flexReportDepartment} reportType="quote" />
                </>
              )}
              {isProductionDepartment && isManagementUser && <PrintFlexReportAction job={job} />}
              {isProjectManagementPage && isManagementUser && <MotorCertificateAction job={job} />}
              {!isProductionDepartment && <ArchiveToFlexAction job={job} />}
              {!isProductionDepartment && <BackfillDocTecnicaAction job={job} />}
              {!isProductionDepartment && canSubmitTechnicianIncidentReports(userRole) && job.job_type !== "dryhire" && (
                <TechnicianIncidentReportDialog job={job} techName={techName} />
              )}
            </div>
          </section>
        )}
      </MobileActionSheet>
      {job.job_type !== "dryhire" && showUpload && canUploadDocuments && (
        <input
          ref={uploadInputRef}
          type="file"
          multiple
          accept={DOCUMENT_UPLOAD_ACCEPT}
          aria-label="Subir documento"
          onChange={handleFileUpload}
          className="sr-only"
        />
      )}
    </div>
  );
};
