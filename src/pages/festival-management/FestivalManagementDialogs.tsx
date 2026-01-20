import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { FestivalScheduling } from "@/components/festival/scheduling/FestivalScheduling";
import { PrintOptionsDialog } from "@/components/festival/pdf/PrintOptionsDialog";
import { FlexFolderPicker } from "@/components/flex/FlexFolderPicker";
import { ModernHojaDeRuta } from "@/components/hoja-de-ruta/ModernHojaDeRuta";
import { JobAssignmentDialog } from "@/components/jobs/JobAssignmentDialog";
import { JobDetailsDialog } from "@/components/jobs/JobDetailsDialog";
import { FlexSyncLogDialog } from "@/components/jobs/FlexSyncLogDialog";
import { JobPresetManagerDialog } from "@/components/jobs/JobPresetManagerDialog";

export const FestivalManagementDialogs = ({ vm }: { vm: any }) => {
  const {
    job,
    jobId,
    navigate,
    isSchedulingRoute,
    jobDates,
    isViewOnly,

    isAssignmentDialogOpen,
    setIsAssignmentDialogOpen,
    handleAssignmentChange,
    assignmentDepartment,

    isJobDetailsOpen,
    setIsJobDetailsOpen,

    isFlexLogOpen,
    setIsFlexLogOpen,

    isFlexPickerOpen,
    setIsFlexPickerOpen,
    handleFlexPickerConfirm,
    flexPickerOptions,

    isRouteSheetOpen,
    setIsRouteSheetOpen,

    isPrintDialogOpen,
    setIsPrintDialogOpen,
    handlePrintAllDocumentation,
    maxStages,

    isJobPresetsOpen,
    setIsJobPresetsOpen,

    isArchiveDialogOpen,
    setIsArchiveDialogOpen,
    archiveMode,
    setArchiveMode,
    archiveIncludeTemplates,
    setArchiveIncludeTemplates,
    archiveDryRun,
    setArchiveDryRun,
    isArchiving,
    archiveResult,
    archiveError,
    handleArchiveToFlex,

    isBackfillDialogOpen,
    setIsBackfillDialogOpen,
    bfSound,
    setBfSound,
    bfLights,
    setBfLights,
    bfVideo,
    setBfVideo,
    bfProduction,
    setBfProduction,
    uuidSound,
    setUuidSound,
    uuidLights,
    setUuidLights,
    uuidVideo,
    setUuidVideo,
    uuidProduction,
    setUuidProduction,
    isBackfilling,
    backfillMessage,
    handleBackfill,

    isWhatsappDialogOpen,
    setIsWhatsappDialogOpen,
    waDepartment,
    setWaDepartment,
    waGroup,
    waRequest,
    isSendingWa,
    handleCreateWhatsappGroup,
    handleRetryWhatsappGroup,

    isAlmacenDialogOpen,
    setIsAlmacenDialogOpen,
    waMessage,
    setWaMessage,
    handleSendToAlmacen,

    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    isDeleting,
    handleDeleteJob,
  } = vm;

  return (
    <>
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
        <JobDetailsDialog open={isJobDetailsOpen} onOpenChange={setIsJobDetailsOpen} job={job} department={assignmentDepartment} />
      )}

      {jobId && <FlexSyncLogDialog jobId={jobId} open={isFlexLogOpen} onOpenChange={setIsFlexLogOpen} />}

      <FlexFolderPicker
        open={isFlexPickerOpen}
        onOpenChange={setIsFlexPickerOpen}
        onConfirm={handleFlexPickerConfirm}
        initialOptions={flexPickerOptions}
      />

      <Dialog open={isRouteSheetOpen} onOpenChange={setIsRouteSheetOpen}>
        <DialogContent className="max-w-[96vw] w-[96vw] max-h-[90vh] md:h-[90vh] p-0 overflow-hidden flex flex-col">
          <div className="h-full overflow-auto">{jobId && <ModernHojaDeRuta jobId={jobId} />}</div>
        </DialogContent>
      </Dialog>

      {isSchedulingRoute && (
        <div>
          <div className="mb-4">
            <Button variant="outline" onClick={() => navigate(`/festival-management/${jobId}`)} className="flex items-center gap-1">
              Volver al Festival
            </Button>
          </div>

          {jobDates.length > 0 ? (
            <FestivalScheduling jobId={jobId} jobDates={jobDates} isViewOnly={isViewOnly} />
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground mb-4">
                  No hay fechas disponibles para planificación. Por favor, actualiza primero las fechas del festival.
                </p>
                <Button onClick={() => navigate(`/festival-management/${jobId}`)}>Volver</Button>
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
          jobTitle={job?.title || ""}
          jobId={jobId}
        />
      )}

      {jobId && <JobPresetManagerDialog open={isJobPresetsOpen} onOpenChange={setIsJobPresetsOpen} jobId={jobId} />}

      <Dialog open={isArchiveDialogOpen} onOpenChange={setIsArchiveDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Archivar documentos en Flex</DialogTitle>
            <DialogDescription>
              Sube todos los documentos del trabajo a la Documentación Técnica de cada departamento en Flex y los elimina de Supabase.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Modo</label>
                <select
                  className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                  value={archiveMode}
                  onChange={(e) => setArchiveMode(e.target.value as "by-prefix" | "all-tech")}
                >
                  <option value="by-prefix">Por prefijo (predeterminado)</option>
                  <option value="all-tech">Todos los depts. técnicos</option>
                </select>
              </div>
              <div className="flex items-center gap-2 mt-6 sm:mt-[30px]">
                <input
                  id="includeTemplates"
                  type="checkbox"
                  checked={archiveIncludeTemplates}
                  onChange={(e) => setArchiveIncludeTemplates(e.target.checked)}
                />
                <label htmlFor="includeTemplates" className="text-sm">
                  Incluir templates
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input id="dryRun" type="checkbox" checked={archiveDryRun} onChange={(e) => setArchiveDryRun(e.target.checked)} />
                <label htmlFor="dryRun" className="text-sm">
                  Prueba (sin eliminar)
                </label>
              </div>
            </div>

            {isArchiving && (
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> Archivando...
              </div>
            )}

            {archiveError && <div className="text-sm text-red-600">{archiveError}</div>}

            {archiveResult && (
              <div className="space-y-3">
                <div className="text-sm">Resumen</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    Intentados: <span className="font-medium">{archiveResult.attempted ?? 0}</span>
                  </div>
                  <div>
                    Subidos: <span className="font-medium">{archiveResult.uploaded ?? 0}</span>
                  </div>
                  <div>
                    Omitidos: <span className="font-medium">{archiveResult.skipped ?? 0}</span>
                  </div>
                  <div>
                    Fallidos: <span className="font-medium">{archiveResult.failed ?? 0}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsArchiveDialogOpen(false)} disabled={isArchiving}>
              Cerrar
            </Button>
            <Button onClick={handleArchiveToFlex} disabled={isArchiving}>
              {isArchiving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {archiveDryRun ? "Ejecutar Prueba" : "Iniciar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isBackfillDialogOpen} onOpenChange={setIsBackfillDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Rellenar Documentación Técnica</DialogTitle>
            <DialogDescription>
              Encuentra y persiste elementos de Documentación Técnica faltantes para este trabajo, permitiendo que el archivado los localice de forma fiable.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={bfSound} onChange={(e) => setBfSound(e.target.checked)} /> Sonido
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={bfLights} onChange={(e) => setBfLights(e.target.checked)} /> Luces
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={bfVideo} onChange={(e) => setBfVideo(e.target.checked)} /> Video
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={bfProduction} onChange={(e) => setBfProduction(e.target.checked)} /> Producción
              </label>
            </div>
            <div className="mt-2">
              <div className="text-xs text-muted-foreground mb-1">UUIDs manuales (opcional)</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-xs">UUID Sonido</label>
                  <input
                    className="w-full h-8 rounded border px-2 text-xs"
                    value={uuidSound}
                    onChange={(e) => setUuidSound(e.target.value)}
                    placeholder="pegar elementId"
                  />
                </div>
                <div>
                  <label className="text-xs">UUID Luces</label>
                  <input
                    className="w-full h-8 rounded border px-2 text-xs"
                    value={uuidLights}
                    onChange={(e) => setUuidLights(e.target.value)}
                    placeholder="pegar elementId"
                  />
                </div>
                <div>
                  <label className="text-xs">UUID Video</label>
                  <input
                    className="w-full h-8 rounded border px-2 text-xs"
                    value={uuidVideo}
                    onChange={(e) => setUuidVideo(e.target.value)}
                    placeholder="pegar elementId"
                  />
                </div>
                <div>
                  <label className="text-xs">UUID Producción</label>
                  <input
                    className="w-full h-8 rounded border px-2 text-xs"
                    value={uuidProduction}
                    onChange={(e) => setUuidProduction(e.target.value)}
                    placeholder="pegar elementId"
                  />
                </div>
              </div>
            </div>

            {isBackfilling && (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Rellenando…
              </div>
            )}
            {backfillMessage && <div className="text-muted-foreground">{backfillMessage}</div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBackfillDialogOpen(false)} disabled={isBackfilling}>
              Cerrar
            </Button>
            <Button onClick={handleBackfill} disabled={isBackfilling}>
              {isBackfilling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Iniciar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isWhatsappDialogOpen} onOpenChange={setIsWhatsappDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Grupo de WhatsApp</DialogTitle>
            <DialogDescription>Crea un grupo de WhatsApp para coordinar este trabajo con tu equipo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <p className="text-sm text-muted-foreground mb-3">
                Se creará un grupo de WhatsApp con el título del trabajo: <span className="font-semibold">{job?.title}</span>
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Departamento</label>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="radio" name="wa-dept-festival" checked={waDepartment==='sound'} onChange={() => setWaDepartment('sound')} />
                  <span>Sonido</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="radio" name="wa-dept-festival" checked={waDepartment==='lights'} onChange={() => setWaDepartment('lights')} />
                  <span>Luces</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="radio" name="wa-dept-festival" checked={waDepartment==='video'} onChange={() => setWaDepartment('video')} />
                  <span>Vídeo</span>
                </label>
              </div>
            </div>
            {/* Show status if group exists or request pending */}
            {waGroup && (
              <div className="rounded-md bg-green-50 border border-green-200 p-3">
                <p className="text-sm text-green-800 font-medium">
                  ✓ Grupo ya creado para este departamento
                </p>
              </div>
            )}
            {!waGroup && waRequest && (
              <div className="rounded-md bg-orange-50 border border-orange-200 p-3">
                <p className="text-sm text-orange-800 font-medium">
                  ⚠ Creación fallida. Puedes reintentar.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsWhatsappDialogOpen(false)} disabled={isSendingWa}>
              Cancelar
            </Button>
            {waRequest && !waGroup ? (
              <Button
                onClick={handleRetryWhatsappGroup}
                disabled={isSendingWa}
                className="bg-orange-500 hover:bg-orange-600"
              >
                {isSendingWa ? "Reintentando..." : "Reintentar Crear Grupo"}
              </Button>
            ) : (
              <Button
                onClick={handleCreateWhatsappGroup}
                disabled={isSendingWa || !!waGroup}
              >
                {isSendingWa ? "Creando..." : waGroup ? "Grupo Creado" : "Crear Grupo"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAlmacenDialogOpen} onOpenChange={setIsAlmacenDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar a Almacén sonido</DialogTitle>
            <DialogDescription>
              Este mensaje se enviará al grupo de WhatsApp "Almacén sonido" desde tu endpoint WAHA.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Mensaje</label>
            <Textarea
              value={waMessage}
              onChange={(e) => setWaMessage(e.target.value)}
              placeholder="Escribe tu mensaje…"
              className="min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAlmacenDialogOpen(false)} disabled={isSendingWa}>
              Cancelar
            </Button>
            <Button onClick={handleSendToAlmacen} disabled={isSendingWa}>
              {isSendingWa ? "Enviando…" : "Enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Trabajo</DialogTitle>
            <DialogDescription>¿Estás seguro de que quieres eliminar este trabajo? Esta acción no se puede deshacer.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm">
              Trabajo: <span className="font-semibold">{job?.title}</span>
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteJob} disabled={isDeleting}>
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Eliminando...
                </>
              ) : (
                "Eliminar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

