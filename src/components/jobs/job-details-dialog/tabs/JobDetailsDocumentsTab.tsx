import React, { useMemo } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { AlertCircle, Download, Eye, FileText, Loader2, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { resolveJobDocLocation } from "@/utils/jobDocuments";

interface JobDetailsDocumentsTabProps {
  open: boolean;
  jobId: string;
  resolvedDocuments: any[];
  documentsLoading: boolean;
  jobDocumentsError: any;
}

export const JobDetailsDocumentsTab: React.FC<JobDetailsDocumentsTabProps> = ({
  open,
  jobId,
  resolvedDocuments,
  documentsLoading,
  jobDocumentsError,
}) => {
  const { data: jobArtists = [], isLoading: isArtistsLoading, error: artistsError } = useQuery({
    queryKey: ["job-artists", jobId],
    enabled: open && !!jobId,
    queryFn: async () => {
      const { data, error } = await supabase.from("festival_artists").select("id, name").eq("job_id", jobId);
      if (error) {
        console.error("[JobDetailsDialog] Error fetching artists:", error);
        throw error;
      }
      console.log("[JobDetailsDialog] Fetched artists for job:", jobId, "Count:", data?.length || 0);
      return (data || []) as Array<{ id: string; name: string }>;
    },
  });

  const artistIdList = useMemo(() => {
    const ids = jobArtists.map((a) => a.id);
    console.log("[JobDetailsDialog] Artist IDs:", ids);
    return ids;
  }, [jobArtists]);

  const artistNameMap = useMemo(() => new Map(jobArtists.map((a) => [a.id, a.name])), [jobArtists]);

  const { data: riderFiles = [], isLoading: isRidersLoading, error: ridersError } = useQuery({
    queryKey: ["job-rider-files", jobId, artistIdList],
    enabled: open && !!jobId && artistIdList.length > 0,
    queryFn: async () => {
      console.log("[JobDetailsDialog] Fetching rider files for artists:", artistIdList);
      let query = supabase
        .from("festival_artist_files")
        .select("id, file_name, file_path, uploaded_at, artist_id")
        .order("uploaded_at", { ascending: false });
      if (artistIdList.length === 1) {
        query = query.eq("artist_id", artistIdList[0]);
      } else {
        const orExpr = artistIdList.map((id) => `artist_id.eq.${id}`).join(",");
        query = query.or(orExpr);
      }
      const { data, error } = await query;
      if (error) {
        console.error("[JobDetailsDialog] Error fetching rider files:", error);
        throw error;
      }
      console.log("[JobDetailsDialog] Fetched rider files:", data?.length || 0, "files");
      return (data || []) as Array<{ id: string; file_name: string; file_path: string; uploaded_at: string; artist_id: string }>;
    },
  });

  const viewRider = async (file: { file_path: string; file_name: string }) => {
    try {
      console.log("[JobDetailsDialog] Viewing rider:", file.file_path);
      const { data, error } = await supabase.storage.from("festival_artist_files").createSignedUrl(file.file_path, 3600);

      if (error) throw error;

      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank", "noopener");
      } else {
        throw new Error("No se pudo generar el enlace de visualización");
      }
    } catch (error) {
      console.error("[JobDetailsDialog] Error viewing rider:", error);
      toast.error(`Error al visualizar el rider: ${(error as Error).message || "Error desconocido"}`);
    }
  };

  const downloadRider = async (file: { file_path: string; file_name: string }) => {
    try {
      console.log("[JobDetailsDialog] Downloading rider:", file.file_path);
      const { data, error } = await supabase.storage.from("festival_artist_files").download(file.file_path);

      if (error) throw error;

      const url = window.URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success("Descargando rider");
    } catch (error) {
      console.error("[JobDetailsDialog] Error downloading rider:", error);
      toast.error(`Error al descargar el rider: ${(error as Error).message || "Error desconocido"}`);
    }
  };

  const handleDownloadDocument = async (doc: any) => {
    try {
      const { bucket, path } = resolveJobDocLocation(doc.file_path);
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);

      if (error) throw error;

      if (data?.signedUrl) {
        const link = document.createElement("a");
        link.href = data.signedUrl;
        link.download = doc.file_name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Descargando documento");
      } else {
        throw new Error("No se pudo generar el enlace de descarga");
      }
    } catch (error) {
      console.error("Error downloading document:", error);
      toast.error(`Error al descargar el documento: ${(error as Error).message || "Error desconocido"}`);
    }
  };

  const handleViewDocument = async (doc: any) => {
    try {
      const { bucket, path } = resolveJobDocLocation(doc.file_path);
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);

      if (error) throw error;

      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank", "noopener");
      } else {
        throw new Error("No se pudo generar el enlace de visualización");
      }
    } catch (error) {
      console.error("Error viewing document:", error);
      toast.error(`Error al visualizar el documento: ${(error as Error).message || "Error desconocido"}`);
    }
  };

  return (
    <TabsContent value="documents" className="space-y-4 min-w-0 overflow-x-hidden">
      <Card className="p-4 w-full min-w-0 overflow-hidden">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Documentos del trabajo
        </h3>

        {jobDocumentsError && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>No se pudieron cargar todos los documentos. {jobDocumentsError.message}</AlertDescription>
          </Alert>
        )}

        {documentsLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : resolvedDocuments.length > 0 ? (
          <div className="space-y-2">
            {resolvedDocuments.map((doc: any) => {
              const isTemplate = doc.template_type === "soundvision";
              const isReadOnly = Boolean(doc.read_only);
              return (
                <div
                  key={doc.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 bg-[#0f1219] border border-[#1f232e] rounded min-w-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium flex items-center gap-2 break-words">
                      {doc.file_name}
                      {isTemplate && (
                        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                          Plantilla SoundVision
                        </Badge>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground break-words">
                      {doc.uploaded_at
                        ? `Subido el ${format(new Date(doc.uploaded_at), "PPP", { locale: es })}`
                        : "Fecha de subida desconocida"}
                      {isReadOnly && <span className="ml-2 italic">Solo lectura</span>}
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto sm:shrink-0">
                    <Button onClick={() => handleViewDocument(doc)} size="sm" variant="outline" className="w-full sm:w-auto">
                      <Eye className="h-4 w-4 mr-2" />
                      Ver
                    </Button>
                    <Button
                      onClick={() => handleDownloadDocument(doc)}
                      size="sm"
                      variant="outline"
                      className="w-full sm:w-auto"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Descargar
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-muted-foreground">No se han subido documentos</p>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Users className="h-4 w-4" />
          Riders de artistas
          {jobArtists.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {jobArtists.length} {jobArtists.length === 1 ? "artista" : "artistas"}
            </Badge>
          )}
        </h3>

        {artistsError && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Error al cargar artistas: {artistsError.message}</AlertDescription>
          </Alert>
        )}

        {ridersError && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Error al cargar riders: {ridersError.message}</AlertDescription>
          </Alert>
        )}

        {isArtistsLoading || isRidersLoading ? (
          <div className="text-center py-4 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            Cargando riders…
          </div>
        ) : jobArtists.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No hay artistas asociados a este trabajo</p>
            <p className="text-xs text-muted-foreground mt-1">Los riders aparecerán aquí cuando se agreguen artistas al trabajo</p>
          </div>
        ) : riderFiles.length > 0 ? (
          <div className="space-y-2">
            {riderFiles.map((file) => (
              <div key={file.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 bg-muted rounded min-w-0">
                <div className="min-w-0 flex-1">
                  <p className="font-medium break-words">{file.file_name}</p>
                  <p className="text-sm text-muted-foreground break-words">
                    Artista: {artistNameMap.get(file.artist_id) || "Desconocido"}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto sm:shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => viewRider({ file_path: file.file_path, file_name: file.file_name })}
                    className="w-full sm:w-auto"
                  >
                    <Eye className="h-4 w-4 mr-1" /> Ver
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadRider({ file_path: file.file_path, file_name: file.file_name })}
                    className="w-full sm:w-auto"
                  >
                    <Download className="h-4 w-4 mr-1" /> Descargar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No se han subido riders para los {jobArtists.length} {jobArtists.length === 1 ? "artista" : "artistas"} de este trabajo
            </p>
            <p className="text-xs text-muted-foreground mt-1">{jobArtists.map((a) => a.name).join(", ")}</p>
          </div>
        )}
      </Card>
    </TabsContent>
  );
};

