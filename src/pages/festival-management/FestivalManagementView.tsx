import {
  AlertCircle,
  Archive,
  Box,
  Calendar,
  Clock,
  Download,
  Eye,
  FileText,
  FolderPlus,
  Layout,
  Link as LinkIcon,
  Loader2,
  MapPin,
  MessageCircle,
  Music2,
  Printer,
  RefreshCw,
  RotateCw,
  Scale,
  Trash2,
  Upload,
  Users,
  Zap,
} from "lucide-react";

import createFolderIcon from "@/assets/icons/icon.png";
import { FestivalLogoManager } from "@/components/festival/FestivalLogoManager";
import { FestivalWeatherSection } from "@/components/festival/FestivalWeatherSection";
import { TechnicianIncidentReportDialog } from "@/components/incident-reports/TechnicianIncidentReportDialog";
import { CrewCallLinkerDialog } from "@/components/jobs/CrewCallLinker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Department } from "@/types/department";

import { FestivalManagementDialogs } from "./FestivalManagementDialogs";

export const FestivalManagementView = ({ vm }: { vm: any }) => {
  const {
    job,
    jobId,
    canEdit,
    isViewOnly,
    navigate,

    isSingleJobMode,
    isSchedulingRoute,
    isArtistRoute,
    isGearRoute,

    venueData,
    mapPreviewUrl,
    isMapLoading,

    handlePrintButtonClick,
    isPrinting,

    folderExists,
    isFlexLoading,
    handleFlexClick,
    flexUuid,

    setIsJobPresetsOpen,
    setIsDeleteDialogOpen,

    artistCount,

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
    setIsWhatsappDialogOpen,
    setWaMessage,
    setIsAlmacenDialogOpen,

    navigateToCalculator,

    jobDates,
    handleRefreshDocuments,
    jobDocuments,
    formatDateLabel,
    handleJobDocumentView,
    handleJobDocumentDownload,
    groupedRiderFiles,
    handleRiderView,
    handleRiderDownload,
  } = vm;

  return (
    <div className="max-w-[1920px] mx-auto px-4 py-4 md:py-6 space-y-4 md:space-y-6">
      {/* Modern Header Card with Gradient */}
      <Card className="border-0 shadow-lg bg-gradient-to-br from-background via-background to-accent/5">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
            <div className="min-w-0 flex-1 space-y-3">
              <CardTitle className="text-2xl md:text-3xl font-bold flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  {isSingleJobMode ? (
                    <FileText className="h-6 w-6 md:h-7 md:w-7" />
                  ) : (
                    <Music2 className="h-6 w-6 md:h-7 md:w-7" />
                  )}
                </div>
                <span className="truncate bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  {job?.title}
                </span>
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm text-muted-foreground">
                <Badge variant="secondary" className="font-normal">
                  {isSingleJobMode ? "Single Job" : "Festival"}
                </Badge>
                <span className="hidden sm:inline">•</span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(job?.start_time || "").toLocaleDateString()} - {new Date(job?.end_time || "").toLocaleDateString()}
                </span>
                {venueData.address && (
                  <>
                    <span className="hidden sm:inline">•</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      <span className="truncate max-w-xs">{venueData.address}</span>
                    </span>
                  </>
                )}
              </div>

              {/* Venue Map Preview */}
              {(venueData.address || venueData.coordinates) && (
                <div className="mt-3">
                  {isMapLoading ? (
                    <div className="w-full aspect-[2/1] bg-muted rounded-lg flex items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : mapPreviewUrl ? (
                    <button
                      onClick={() => {
                        const url = venueData.coordinates
                          ? `https://www.google.com/maps/search/?api=1&query=${venueData.coordinates.lat},${venueData.coordinates.lng}`
                          : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venueData.address || "")}`;
                        window.open(url, "_blank", "noopener,noreferrer");
                      }}
                      className="w-full rounded-lg overflow-hidden border hover:border-primary transition-all hover:shadow-md group relative"
                    >
                      <img
                        src={mapPreviewUrl}
                        alt="Venue location"
                        width={600}
                        height={300}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-auto"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-background/90 px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          Abrir en Google Maps
                        </div>
                      </div>
                    </button>
                  ) : null}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2 items-start">
              {canEdit && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2 hover:bg-accent/50 transition-all"
                    onClick={handlePrintButtonClick}
                    disabled={isPrinting}
                  >
                    {isPrinting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                    <span className="hidden sm:inline">{isPrinting ? "Generando..." : "Imprimir"}</span>
                  </Button>

                  {(folderExists || isFlexLoading) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2 hover:bg-accent/50 transition-all"
                      onClick={handleFlexClick}
                      disabled={!flexUuid || isFlexLoading}
                    >
                      {isFlexLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <img
                          src={createFolderIcon}
                          alt="Flex"
                          width={16}
                          height={16}
                          loading="lazy"
                          decoding="async"
                          className="h-4 w-4"
                        />
                      )}
                      <span className="hidden sm:inline">{isFlexLoading ? "Cargando..." : "Flex"}</span>
                    </Button>
                  )}

                  <FestivalLogoManager jobId={jobId} />

                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2 hover:bg-accent/50 transition-all"
                    onClick={() => setIsJobPresetsOpen(true)}
                  >
                    <Box className="h-4 w-4" />
                    <span className="hidden sm:inline">Presets</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2 hover:bg-destructive/10 hover:text-destructive transition-all"
                    onClick={() => setIsDeleteDialogOpen(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Eliminar</span>
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {!isSchedulingRoute && !isArtistRoute && !isGearRoute && (
        <>
          {/* Modern Navigation Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 md:gap-6">
            <Card
              className="group hover:shadow-xl hover:scale-[1.02] transition-all duration-300 cursor-pointer border-2 hover:border-primary/50 bg-gradient-to-br from-background to-accent/5"
              onClick={() => navigate(`/festival-management/${jobId}/artists`)}
            >
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-3 text-base md:text-lg">
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500 group-hover:bg-blue-500/20 transition-colors">
                    <Users className="h-5 w-5 md:h-6 md:w-6" />
                  </div>
                  <span className="group-hover:text-primary transition-colors">Artistas</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">
                    {artistCount}
                  </p>
                  <p className="text-xs md:text-sm text-muted-foreground">Total de Artistas</p>
                </div>
                <Button
                  className="w-full group-hover:shadow-md transition-shadow"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/festival-management/${jobId}/artists`);
                  }}
                >
                  {isViewOnly ? "Ver Artistas" : "Gestionar Artistas"}
                </Button>
              </CardContent>
            </Card>

            <Card
              className="group hover:shadow-xl hover:scale-[1.02] transition-all duration-300 cursor-pointer border-2 hover:border-primary/50 bg-gradient-to-br from-background to-accent/5"
              onClick={() => navigate(`/festival-management/${jobId}/gear`)}
            >
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-3 text-base md:text-lg">
                  <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500 group-hover:bg-purple-500/20 transition-colors">
                    <Layout className="h-5 w-5 md:h-6 md:w-6" />
                  </div>
                  <span className="group-hover:text-primary transition-colors">Escenarios y Equipo</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs md:text-sm text-muted-foreground min-h-[2.5rem]">Gestiona escenarios y equipo técnico</p>
                <Button
                  className="w-full group-hover:shadow-md transition-shadow"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/festival-management/${jobId}/gear`);
                  }}
                >
                  {isViewOnly ? "Ver Equipo" : "Gestionar Equipo"}
                </Button>
              </CardContent>
            </Card>

            <Card
              className="group hover:shadow-xl hover:scale-[1.02] transition-all duration-300 cursor-pointer border-2 hover:border-primary/50 bg-gradient-to-br from-background to-accent/5"
              onClick={() => navigate(`/festival-management/${jobId}/scheduling`)}
            >
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-3 text-base md:text-lg">
                  <div className="p-2 rounded-lg bg-green-500/10 text-green-500 group-hover:bg-green-500/20 transition-colors">
                    <Calendar className="h-5 w-5 md:h-6 md:w-6" />
                  </div>
                  <span className="group-hover:text-primary transition-colors">Planificación</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs md:text-sm text-muted-foreground min-h-[2.5rem]">
                  Gestiona turnos y asignaciones de personal
                </p>
                <Button
                  className="w-full group-hover:shadow-md transition-shadow"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/festival-management/${jobId}/scheduling`);
                  }}
                >
                  {isViewOnly ? "Ver Planificación" : "Gestionar Planificación"}
                </Button>
              </CardContent>
            </Card>
          </div>

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
                        {departmentOptions.map((dept) => (
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

                {/* Upload Documents */}
                {canEdit && (
                  <div className="rounded-lg border p-3 md:p-4 space-y-2 md:space-y-3 bg-gradient-to-br from-background to-blue-500/5">
                    <div className="flex items-center gap-2 text-xs md:text-sm font-semibold text-foreground">
                      <Upload className="h-4 w-4 flex-shrink-0 text-blue-500" />
                      Subir Documentos
                    </div>
                    <p className="text-xs md:text-sm text-muted-foreground">Sube documentos de trabajo y archivos técnicos.</p>
                    <div className="relative">
                      <input
                        type="file"
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
                          "Elegir Archivo"
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

                {/* WhatsApp Group */}
                {(userRole === "management" || userRole === "admin") && (
                  <div className="rounded-lg border p-3 md:p-4 space-y-2 md:space-y-3 bg-gradient-to-br from-background to-green-500/5">
                    <div className="flex items-center gap-2 text-xs md:text-sm font-semibold text-foreground">
                      <MessageCircle className="h-4 w-4 flex-shrink-0 text-green-500" />
                      Grupo de WhatsApp
                    </div>
                    <p className="text-xs md:text-sm text-muted-foreground">
                      Crea grupo de WhatsApp para coordinación del trabajo.
                    </p>
                    <Button onClick={() => setIsWhatsappDialogOpen(true)} size="sm" className="w-full" variant="outline">
                      Crear Grupo
                    </Button>
                  </div>
                )}

                {/* Almacén Messaging */}
                {(userRole === "management" || userRole === "admin") && (
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
                {userRole === "management" && (
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
                {userRole === "management" && (
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
                {userRole === "technician" && (
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

          {/* Add Weather Section */}
          <FestivalWeatherSection jobId={jobId} venue={venueData} jobDates={jobDates} />

          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                  <FileText className="h-4 w-4 md:h-5 md:w-5" />
                  Documentos y Riders
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
                  {isLoadingDocuments ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isLoadingDocuments ? "Actualizando…" : "Actualizar"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 md:space-y-6">
              {isLoadingDocuments ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando documentos…
                </div>
              ) : (
                <>
                  <div>
                    <h4 className="text-xs md:text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                      <FileText className="h-4 w-4 flex-shrink-0" />
                      Documentos del Trabajo
                    </h4>
                    {jobDocuments.length > 0 ? (
                      <div className="space-y-2">
                        {jobDocuments.map((doc) => {
                          const isTemplate = doc.template_type === "soundvision";
                          const isReadOnly = Boolean(doc.read_only);
                          return (
                            <div
                              key={doc.id}
                              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-md border bg-card p-3"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="text-xs md:text-sm font-medium text-foreground flex flex-wrap items-center gap-2">
                                  <span className="truncate">{doc.file_name}</span>
                                  {isTemplate && (
                                    <Badge variant="outline" className="text-[10px] uppercase tracking-wide flex-shrink-0">
                                      Template SoundVision File
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  Uploaded {formatDateLabel(doc.uploaded_at)}
                                  {isReadOnly && <span className="ml-2 italic">Read-only</span>}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 sm:flex-shrink-0">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleJobDocumentView(doc);
                                  }}
                                  title="View"
                                  className="h-8 w-8 p-0"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleJobDocumentDownload(doc);
                                  }}
                                  title="Download"
                                  className="h-8 w-8 p-0"
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs md:text-sm text-muted-foreground">Aún no se han subido documentos del trabajo.</p>
                    )}
                  </div>

                  <div>
                    <h4 className="text-xs md:text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                      <Users className="h-4 w-4 flex-shrink-0" />
                      Riders de Artistas
                    </h4>
                    {groupedRiderFiles.length > 0 ? (
                      <div className="space-y-4">
                        {groupedRiderFiles.map((artist) => (
                          <div key={artist.artistId} className="space-y-2">
                            <div className="text-xs md:text-sm font-medium text-foreground">{artist.artistName}</div>
                            <div className="space-y-2">
                              {artist.files.map((file) => (
                                <div
                                  key={file.id}
                                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-md border bg-accent/20 p-3"
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="text-xs md:text-sm font-medium text-foreground truncate">{file.file_name}</div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                      Uploaded {formatDateLabel(file.created_at)}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 sm:flex-shrink-0">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRiderView(file);
                                      }}
                                      title="View"
                                      className="h-8 w-8 p-0"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRiderDownload(file);
                                      }}
                                      title="Download"
                                      className="h-8 w-8 p-0"
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
                      <p className="text-xs md:text-sm text-muted-foreground">
                        Aún no se han subido riders de artistas. Los riders añadidos a través de la tabla de artistas aparecerán aquí automáticamente.
                      </p>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <FestivalManagementDialogs vm={vm} />
    </div>
  );
};
