import { AlertCircle, Archive, Clock, FileText, FolderPlus, Link as LinkIcon, Loader2, MapPin, MessageCircle, RefreshCw, RotateCw, Scale, Upload, Users, Zap } from "lucide-react";

import { TechnicianIncidentReportDialog } from "@/components/incident-reports/TechnicianIncidentReportDialog";
import { CrewCallLinkerDialog } from "@/components/jobs/CrewCallLinker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Department } from "@/types/department";
import { DOCUMENT_UPLOAD_ACCEPT } from "@/utils/documentUploadValidation";
import { canSubmitTechnicianIncidentReports, isDepartmentManagementRole, isManagementRole } from "@/utils/permissions";
import type { FestivalManagementVm } from "@/features/festival-management/types";

export const FestivalQuickActions = ({ vm }: { vm: FestivalManagementVm }) => {
  const {
    job,
    jobId,
    canEdit,
    canUploadDocuments,
    isPlanningViewOnly,
    folderExists,
    isFlexLoading,
    handleRefreshAll,
    isLoading,
    isLoadingDocuments,
    assignmentDepartment,
    humanizeDepartment,
    setAssignmentDepartment,
    departmentOptions,
    handleOpenAssignments,
    isAssignmentDialogOpen,
    handleNavigateTimesheets,
    handleOpenRouteSheet,
    flexStatus,
    handleCreateFlexFolders,
    isCreatingFlexFolders,
    handleOpenFlexPicker,
    handleOpenFlexLogs,
    flexError,
    handleOpenJobDetails,
    handleDocumentUpload,
    isUploadingDocument,
    handleCreateLocalFolders,
    isCreatingLocalFolders,
    setIsArchiveDialogOpen,
    isArchiving,
    setIsBackfillDialogOpen,
    isBackfilling,
    userRole,
    setWaMessage,
    setIsAlmacenDialogOpen,
    navigateToCalculator,
  } = vm;
  const isManagementUser = isManagementRole(userRole);
  const isDepartmentManager = isDepartmentManagementRole(userRole);

  return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <RefreshCw className="h-4 w-4 md:h-5 md:w-5" />
              Acciones Rápidas
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
              Actualizar Datos
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 md:gap-4">
            {!isPlanningViewOnly && <>
            <div className="rounded-lg border p-3 md:p-4 space-y-2 md:space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-xs md:text-sm font-semibold text-foreground">
                  <Users className="h-4 w-4 flex-shrink-0" />
                  Asignaciones
                </div>
                <Badge variant="outline" className="text-xs">
                  {humanizeDepartment(assignmentDepartment)}
                </Badge>
              </div>
              <p className="text-xs md:text-sm text-muted-foreground">Coordina asignaciones de crew por departamento.</p>
              <div className="flex flex-col gap-2">
                <Select
                  value={assignmentDepartment}
                  onValueChange={(value) => setAssignmentDepartment(value as Department)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departmentOptions.map((dept: Department) => (
                      <SelectItem key={dept} value={dept}>
                        {humanizeDepartment(dept)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleOpenAssignments} disabled={!job || isAssignmentDialogOpen} size="sm" className="w-full">
                  Abrir
                </Button>
              </div>
            </div>

            <div className="rounded-lg border p-3 md:p-4 space-y-2 md:space-y-3">
              <div className="flex items-center gap-2 text-xs md:text-sm font-semibold text-foreground">
                <LinkIcon className="h-4 w-4 flex-shrink-0" />
                Flex Crew Calls
              </div>
              <p className="text-xs md:text-sm text-muted-foreground">
                Vincula los IDs de elementos de crew call de Sonido/Luces.
              </p>
              <div className="flex">{jobId && <CrewCallLinkerDialog jobId={jobId} />}</div>
            </div>

            <div className="rounded-lg border p-3 md:p-4 space-y-2 md:space-y-3">
              <div className="flex items-center gap-2 text-xs md:text-sm font-semibold text-foreground">
                <Clock className="h-4 w-4 flex-shrink-0" />
                Timesheets
              </div>
              <p className="text-xs md:text-sm text-muted-foreground">
                Revisa y aprueba las hojas de tiempo del crew para este trabajo.
              </p>
              <Button onClick={handleNavigateTimesheets} disabled={!jobId} size="sm" className="w-full">
                Abrir Hojas de Tiempo
              </Button>
            </div>

            <div className="rounded-lg border p-3 md:p-4 space-y-2 md:space-y-3">
              <div className="flex items-center gap-2 text-xs md:text-sm font-semibold text-foreground">
                <MapPin className="h-4 w-4 flex-shrink-0" />
                Hoja de Ruta
              </div>
              <p className="text-xs md:text-sm text-muted-foreground">
                Genera y revisa la hoja de ruta para este trabajo.
              </p>
              <Button onClick={handleOpenRouteSheet} disabled={!jobId} size="sm" className="w-full">
                Abrir Hoja de Ruta
              </Button>
            </div>

            <div className="rounded-lg border p-3 md:p-4 space-y-2 md:space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-xs md:text-sm font-semibold text-foreground">
                  <FolderPlus className="h-4 w-4 flex-shrink-0" />
                  Flex Folders
                </div>
                <Badge variant={flexStatus.variant} className="text-xs">
                  {flexStatus.label}
                </Badge>
              </div>
              <p className="text-xs md:text-sm text-muted-foreground">
                Mantén las carpetas de Flex sincronizadas con los datos de este trabajo.
              </p>
              <div className="flex flex-col gap-2">
                <Button
                  onClick={handleCreateFlexFolders}
                  disabled={!canEdit || !job || isCreatingFlexFolders || isFlexLoading}
                  size="sm"
                  className="w-full"
                >
                  {isCreatingFlexFolders ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creando…
                    </>
                  ) : (
                    "Crear / Verificar"
                  )}
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="secondary"
                    onClick={handleOpenFlexPicker}
                    disabled={!canEdit || !job || isCreatingFlexFolders || isFlexLoading || !folderExists}
                    size="sm"
                  >
                    {isCreatingFlexFolders ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Actualizando…
                      </>
                    ) : (
                      "Añadir"
                    )}
                  </Button>
                  <Button variant="outline" onClick={handleOpenFlexLogs} disabled={!canEdit} size="sm">
                    Ver Registros
                  </Button>
                </div>
              </div>
              {flexError && <p className="text-xs text-destructive">{flexError}</p>}
            </div>

            <div className="rounded-lg border p-3 md:p-4 space-y-2 md:space-y-3">
              <div className="flex items-center gap-2 text-xs md:text-sm font-semibold text-foreground">
                <FileText className="h-4 w-4 flex-shrink-0" />
                Detalles del Trabajo
              </div>
              <p className="text-xs md:text-sm text-muted-foreground">Ve la configuración completa del trabajo y sus metadatos.</p>
              <Button onClick={handleOpenJobDetails} disabled={!job} size="sm" className="w-full">
                Ver Detalles del Trabajo
              </Button>
            </div>

            </>}
            {canUploadDocuments && (
              <div className="rounded-lg border p-3 md:p-4 space-y-2 md:space-y-3 bg-gradient-to-br from-background to-blue-500/5">
                <div className="flex items-center gap-2 text-xs md:text-sm font-semibold text-foreground">
                  <Upload className="h-4 w-4 flex-shrink-0 text-blue-500" />
                  Subir Documentos
                </div>
                <p className="text-xs md:text-sm text-muted-foreground">Sube documentos de trabajo y archivos técnicos.</p>
                <div className="relative">
                  <input
                    type="file"
                    multiple
                    accept={DOCUMENT_UPLOAD_ACCEPT}
                    onChange={handleDocumentUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    disabled={isUploadingDocument}
                  />
                  <Button disabled={isUploadingDocument} size="sm" className="w-full relative">
                    {isUploadingDocument ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Subiendo...
                      </>
                    ) : (
                      "Elegir Archivo(s)"
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Create Local Folders */}
            {canEdit && (
              <div className="rounded-lg border p-3 md:p-4 space-y-2 md:space-y-3 bg-gradient-to-br from-background to-purple-500/5">
                <div className="flex items-center gap-2 text-xs md:text-sm font-semibold text-foreground">
                  <FolderPlus className="h-4 w-4 flex-shrink-0 text-purple-500" />
                  Carpetas Locales
                </div>
                <p className="text-xs md:text-sm text-muted-foreground">Crea estructura de carpetas locales para este trabajo.</p>
                <Button
                  onClick={handleCreateLocalFolders}
                  disabled={isCreatingLocalFolders}
                  size="sm"
                  className="w-full"
                >
                  {isCreatingLocalFolders ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creando...
                    </>
                  ) : (
                    "Crear Carpetas"
                  )}
                </Button>
              </div>
            )}

            {/* Archive to Flex */}
            {canEdit && (
              <div className="rounded-lg border p-3 md:p-4 space-y-2 md:space-y-3 bg-gradient-to-br from-background to-orange-500/5">
                <div className="flex items-center gap-2 text-xs md:text-sm font-semibold text-foreground">
                  <Archive className="h-4 w-4 flex-shrink-0 text-orange-500" />
                  Archivar en Flex
                </div>
                <p className="text-xs md:text-sm text-muted-foreground">
                  Archiva documentos en Flex Documentación Técnica.
                </p>
                <Button
                  onClick={() => setIsArchiveDialogOpen(true)}
                  disabled={isArchiving}
                  size="sm"
                  className="w-full"
                  variant="outline"
                >
                  {isArchiving ? "Archivando..." : "Abrir Archivo"}
                </Button>
              </div>
            )}

            {/* Backfill Doc Técnica */}
            {canEdit && (
              <div className="rounded-lg border p-3 md:p-4 space-y-2 md:space-y-3 bg-gradient-to-br from-background to-cyan-500/5">
                <div className="flex items-center gap-2 text-xs md:text-sm font-semibold text-foreground">
                  <RotateCw className="h-4 w-4 flex-shrink-0 text-cyan-500" />
                  Rellenar Doc Técnica
                </div>
                <p className="text-xs md:text-sm text-muted-foreground">
                  Encuentra y persiste documentación técnica faltante.
                </p>
                <Button
                  onClick={() => setIsBackfillDialogOpen(true)}
                  disabled={isBackfilling}
                  size="sm"
                  className="w-full"
                  variant="outline"
                >
                  {isBackfilling ? "Rellenando..." : "Abrir Relleno"}
                </Button>
              </div>
            )}

            {/* Almacén Messaging */}
            {isManagementUser && (
              <div className="rounded-lg border p-3 md:p-4 space-y-2 md:space-y-3 bg-gradient-to-br from-background to-amber-500/5">
                <div className="flex items-center gap-2 text-xs md:text-sm font-semibold text-foreground">
                  <MessageCircle className="h-4 w-4 flex-shrink-0 text-amber-500" />
                  Almacén Sonido
                </div>
                <p className="text-xs md:text-sm text-muted-foreground">Envía mensaje al equipo de almacén.</p>
                <Button
                  onClick={() => {
                    setWaMessage(`He hecho cambios en el PS del ${job?.title} por favor echad un vistazo`);
                    setIsAlmacenDialogOpen(true);
                  }}
                  size="sm"
                  className="w-full"
                  variant="outline"
                >
                  Enviar Mensaje
                </Button>
              </div>
            )}

            {/* Pesos Calculator */}
            {isDepartmentManager && (
              <div className="rounded-lg border p-3 md:p-4 space-y-2 md:space-y-3 bg-gradient-to-br from-background to-indigo-500/5">
                <div className="flex items-center gap-2 text-xs md:text-sm font-semibold text-foreground">
                  <Scale className="h-4 w-4 flex-shrink-0 text-indigo-500" />
                  Calculadora de Pesos
                </div>
                <p className="text-xs md:text-sm text-muted-foreground">Calcula pesos y distribución de carga.</p>
                <Button onClick={() => navigateToCalculator("pesos")} size="sm" className="w-full" variant="outline">
                  Abrir Calculadora
                </Button>
              </div>
            )}

            {/* Consumos Calculator */}
            {isDepartmentManager && (
              <div className="rounded-lg border p-3 md:p-4 space-y-2 md:space-y-3 bg-gradient-to-br from-background to-yellow-500/5">
                <div className="flex items-center gap-2 text-xs md:text-sm font-semibold text-foreground">
                  <Zap className="h-4 w-4 flex-shrink-0 text-yellow-500" />
                  Calculadora de Consumos
                </div>
                <p className="text-xs md:text-sm text-muted-foreground">Calcula consumo y requisitos de energía.</p>
                <Button
                  onClick={() => navigateToCalculator("consumos")}
                  size="sm"
                  className="w-full"
                  variant="outline"
                >
                  Abrir Calculadora
                </Button>
              </div>
            )}

            {/* Incident Report */}
            {canSubmitTechnicianIncidentReports(userRole) && job && (
              <div className="rounded-lg border p-3 md:p-4 space-y-2 md:space-y-3 bg-gradient-to-br from-background to-red-500/5">
                <div className="flex items-center gap-2 text-xs md:text-sm font-semibold text-foreground">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-500" />
                  Reporte de Incidencia
                </div>
                <p className="text-xs md:text-sm text-muted-foreground">Crea un reporte de incidencia para este trabajo.</p>
                <TechnicianIncidentReportDialog job={job} techName={userRole} />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
  );
};
