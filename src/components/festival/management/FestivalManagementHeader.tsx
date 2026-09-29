import { Box, Calendar, FileText, Loader2, MapPin, Music2, Printer, RotateCw, Trash2 } from "lucide-react";

import createFolderIcon from "@/assets/icons/icon.png";
import { FestivalLogoManager } from "@/components/festival/FestivalLogoManager";
import { FestivalOfflineControls } from "@/components/festival/FestivalOfflineControls";
import { FestivalPushFeedButton } from "@/components/festival/FestivalPushFeedButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatFestivalInstant } from "@/features/festival-management/dateFormatting";
import type { FestivalManagementVm } from "@/features/festival-management/types";

export const FestivalManagementHeader = ({ vm }: { vm: FestivalManagementVm }) => {
  const {
    job,
    jobId,
    canEdit,
    workspaceProfile,
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
  } = vm;
  const WorkspaceIcon = {
    cycle: RotateCw,
    event: Calendar,
    festival: Music2,
    single: FileText,
    tourdate: MapPin,
  }[workspaceProfile.icon];

  return (
      <Card className="border-0 shadow-lg bg-gradient-to-br from-background via-background to-accent/5">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
            <div className="min-w-0 flex-1 space-y-3">
              <CardTitle className="text-2xl md:text-3xl font-bold flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <WorkspaceIcon className="h-6 w-6 md:h-7 md:w-7" aria-hidden="true" />
                </div>
                <span className="truncate bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  {job?.title}
                </span>
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm text-muted-foreground">
                <Badge variant="secondary" className="font-normal">
                  {workspaceProfile.badgeLabel}
                </Badge>
                <span className="hidden sm:inline">•</span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatFestivalInstant(job?.start_time, "dd/MM/yyyy")} -{" "}
                  {formatFestivalInstant(job?.end_time, "dd/MM/yyyy")}
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
                        alt="Ubicación del trabajo"
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
              <FestivalOfflineControls jobId={jobId} canEdit={canEdit} />
              <FestivalPushFeedButton jobId={jobId} />
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
  );
};
