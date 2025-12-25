import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Download, Upload } from "lucide-react";
import { useJobs } from "@/hooks/useJobs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function StagePlot() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: jobs } = useJobs();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const pendingSaveJobIdRef = useRef<string | null>(null);

  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Filter jobs to only sound department
  const soundJobs = jobs?.filter(job =>
    job.job_departments?.some(dept => dept.department === 'sound')
  ) || [];

  // Load plot data when job is selected
  useEffect(() => {
    if (!selectedJobId) return;

    const loadPlotData = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('job_stage_plots')
          .select('plot_data')
          .eq('job_id', selectedJobId)
          .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
          throw error;
        }

        if (data?.plot_data) {
          // Send plot data to iframe
          iframeRef.current?.contentWindow?.postMessage({
            type: 'LOAD_PLOT',
            data: data.plot_data
          }, '*');

          toast({
            title: "Plano cargado",
            description: "Se ha cargado el plano guardado para este trabajo.",
          });
        }
      } catch (error) {
        console.error('Error loading plot:', error);
        toast({
          title: "Error al cargar",
          description: "No se pudo cargar el plano guardado.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadPlotData();
  }, [selectedJobId, toast]);

  // Save plot data to database
  const handleSave = async () => {
    if (!selectedJobId) {
      toast({
        title: "Selecciona un trabajo",
        description: "Debes seleccionar un trabajo antes de guardar.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    pendingSaveJobIdRef.current = selectedJobId;

    // Request plot data from iframe
    iframeRef.current?.contentWindow?.postMessage({
      type: 'GET_PLOT_DATA'
    }, '*');
  };

  // Listen for messages from iframe
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data.type === 'PLOT_DATA') {
        const jobIdToSave = pendingSaveJobIdRef.current;
        if (!jobIdToSave) {
          setIsSaving(false);
          return;
        }

        try {
          const { data, error } = await supabase
            .from('job_stage_plots')
            .upsert({
              job_id: jobIdToSave,
              plot_data: event.data.data,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'job_id'
            });

          if (error) throw error;

          toast({
            title: "✅ Plano guardado",
            description: "El plano de escenario se ha guardado correctamente.",
          });
        } catch (error) {
          console.error('Error saving plot:', error);
          toast({
            title: "❌ Error al guardar",
            description: "No se pudo guardar el plano de escenario.",
            variant: "destructive",
          });
        } finally {
          setIsSaving(false);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [selectedJobId, toast]);

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/sound')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
          <h1 className="text-xl font-semibold">Plano de Escenario</h1>
        </div>

        <div className="flex items-center gap-3">
          <Select value={selectedJobId} onValueChange={setSelectedJobId}>
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder="Seleccionar trabajo..." />
            </SelectTrigger>
            <SelectContent>
              {soundJobs.map((job) => (
                <SelectItem key={job.id} value={job.id}>
                  {job.title} - {new Date(job.start_time).toLocaleDateString('es-ES')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            onClick={handleSave}
            disabled={!selectedJobId || isSaving}
            variant="default"
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </div>

      {/* Stage Plot iframe */}
      <div className="flex-1 overflow-hidden">
        <iframe
          ref={iframeRef}
          src="/stageplot/index.html"
          className="w-full h-full border-0"
          title="Plano de Escenario"
          sandbox="allow-scripts allow-same-origin allow-downloads allow-modals"
        />
      </div>
    </div>
  );
}
