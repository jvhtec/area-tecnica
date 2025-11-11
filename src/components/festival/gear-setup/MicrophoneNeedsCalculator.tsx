
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calculator, Download, FileText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { WiredMic } from "./WiredMicConfig";
import { exportWiredMicrophoneMatrixPDF, WiredMicrophoneMatrixData, organizeArtistsByDateAndStage } from "@/utils/wiredMicrophoneNeedsPdfExport";

interface MicrophoneNeedsCalculatorProps {
  jobId: string;
}

export const MicrophoneNeedsCalculator = ({ jobId }: MicrophoneNeedsCalculatorProps) => {
  const [open, setOpen] = useState(false);

  const { data: artists = [], isLoading } = useQuery({
    queryKey: ['festival-artists-mics', jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('festival_artists')
        .select('id, name, stage, date, show_start, show_end, wired_mics, mic_kit')
        .eq('job_id', jobId)
        .eq('mic_kit', 'festival')
        .not('wired_mics', 'is', null);
      
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!jobId
  });

  // Query for job details to get title and logo for PDF export
  const { data: jobDetails } = useQuery({
    queryKey: ['job-details', jobId],
    queryFn: async () => {
      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .select('title')
        .eq('id', jobId)
        .single();
      
      if (jobError) throw jobError;

      const { data: logo, error: logoError } = await supabase
        .from('festival_logos')
        .select('file_path')
        .eq('job_id', jobId)
        .maybeSingle();
      
      return {
        title: job.title,
        logoUrl: logo?.file_path || undefined
      };
    },
    enabled: open && !!jobId
  });

  // Filter artists with valid wired microphone data
  const validArtists = artists.filter(artist => 
    artist.wired_mics && 
    Array.isArray(artist.wired_mics) && 
    artist.wired_mics.length > 0
  );

  // Get unique microphone models for preview
  const getMicrophoneModels = () => {
    const models = new Set<string>();
    validArtists.forEach(artist => {
      if (artist.wired_mics && Array.isArray(artist.wired_mics)) {
        artist.wired_mics.forEach((mic: WiredMic) => {
          if (mic.model && mic.quantity > 0) {
            models.add(mic.model);
          }
        });
      }
    });
    return Array.from(models).sort();
  };

  const exportMatrixPDF = async () => {
    if (!jobDetails || validArtists.length === 0) return;

    const artistsByDateAndStage = organizeArtistsByDateAndStage(validArtists);

    const matrixData: WiredMicrophoneMatrixData = {
      jobTitle: jobDetails.title,
      logoUrl: jobDetails.logoUrl,
      artistsByDateAndStage
    };

    try {
      const pdfBlob = await exportWiredMicrophoneMatrixPDF(matrixData);
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${jobDetails.title}_Wired_Microphone_Matrix.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

  const microphoneModels = getMicrophoneModels();

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        variant="outline"
        className="w-full"
      >
        <Calculator className="h-4 w-4 mr-2" />
        Matriz de Micrófonos Cableados
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Matriz de Requisitos de Micrófonos Cableados</span>
              <div className="flex gap-2">
                {validArtists.length > 0 && (
                  <Button onClick={exportMatrixPDF} variant="outline" size="sm">
                    <FileText className="h-4 w-4 mr-2" />
                    Exportar Matriz PDF
                  </Button>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>

          {isLoading ? (
            <div className="text-center py-8">Cargando datos de artistas...</div>
          ) : validArtists.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No se encontraron artistas con requisitos de micrófonos cableados usando kit de festival.
              <br />
              Asegúrese de que los artistas tengan micrófonos cableados configurados con kit de festival seleccionado.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-sm text-muted-foreground">
                Esta matriz muestra todos los artistas que usan micrófonos cableados del festival. La exportación PDF calculará
                los requisitos máximos considerando los horarios de shows y las restricciones de compartir micrófonos.
              </div>

              {/* Summary Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-blue-700">{validArtists.length}</div>
                  <div className="text-sm text-blue-600">Artistas con Micrófonos Cableados</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-green-700">{microphoneModels.length}</div>
                  <div className="text-sm text-green-600">Modelos de Micrófonos</div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-purple-700">
                    {new Set(validArtists.map(a => `${a.date}-${a.stage}`)).size}
                  </div>
                  <div className="text-sm text-purple-600">Combinaciones Fecha/Stage</div>
                </div>
              </div>

              {/* Microphone Models Overview */}
              {microphoneModels.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Modelos de Micrófonos Requeridos</h3>
                  <div className="flex flex-wrap gap-2">
                    {microphoneModels.map((model) => (
                      <Badge key={model} variant="outline" className="text-sm">
                        {model}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Artists Preview Table */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Artistas Incluidos en la Matriz</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Artista</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>Hora del Show</TableHead>
                      <TableHead>Micrófonos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {validArtists.map((artist) => (
                      <TableRow key={artist.id}>
                        <TableCell className="font-medium">{artist.name}</TableCell>
                        <TableCell>{artist.date}</TableCell>
                        <TableCell>
                          <Badge variant="outline">Stage {artist.stage}</Badge>
                        </TableCell>
                        <TableCell>
                          {artist.show_start && artist.show_end ? 
                            `${artist.show_start} - ${artist.show_end}` : 'TBD'
                          }
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {artist.wired_mics && Array.isArray(artist.wired_mics) ? 
                              artist.wired_mics.map((mic: WiredMic, idx: number) => (
                                <div key={idx} className="text-xs">
                                  <Badge variant="secondary" className="mr-1">
                                    {mic.quantity}x {mic.model}
                                  </Badge>
                                  {mic.exclusive_use && (
                                    <Badge variant="destructive" className="text-xs">
                                      Exclusivo
                                    </Badge>
                                  )}
                                </div>
                              )) : null
                            }
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                <div className="text-sm text-yellow-800">
                  <strong>Nota:</strong> El PDF de la matriz calculará los requisitos máximos exactos analizando
                  los horarios de shows, requisitos de uso exclusivo y restricciones de compartir en todas las fechas y stages.
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
