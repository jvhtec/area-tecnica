import { Download, Eye, FileText, Loader2, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FestivalManagementVm } from "@/features/festival-management/types";

export const FestivalDocumentsCard = ({ vm }: { vm: FestivalManagementVm }) => {
  const {
    isLoadingDocuments,
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
  );
};
