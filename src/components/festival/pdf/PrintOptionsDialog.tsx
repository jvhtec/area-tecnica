
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { Download, Mail } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { exportMissingRiderReportPDF, MissingRiderReportData } from "@/utils/missingRiderReportPdfExport";
import { exportArtistTablePDF, ArtistTablePdfData } from "@/utils/artistTablePdfExport";
import { exportShiftsTablePDF, ShiftsTablePdfData } from "@/utils/shiftsTablePdfExport";
import { exportRfIemTablePDF, RfIemTablePdfData } from "@/utils/rfIemTablePdfExport";
import { exportInfrastructureTablePDF, InfrastructureTablePdfData } from "@/utils/infrastructureTablePdfExport";
import { exportWiredMicrophoneMatrixPDF, WiredMicrophoneMatrixData, organizeArtistsByDateAndStage } from "@/utils/wiredMicrophoneNeedsPdfExport";
import { generateStageGearPDF } from "@/utils/gearSetupPdfExport";
import { fetchJobLogo, fetchLogoUrl } from "@/utils/pdf/logoUtils";
import { ensurePublicArtistFormLinks } from "@/utils/publicArtistFormLinks";
import { buildReadableFilename } from "@/utils/fileName";
import { toast } from "sonner";

export interface PrintOptions {
  includeGearSetup: boolean;
  gearSetupStages: number[];
  includeShiftSchedules: boolean;
  shiftScheduleStages: number[];
  includeArtistTables: boolean;
  artistTableStages: number[];
  includeArtistRequirements: boolean;
  artistRequirementStages: number[];
  includeRfIemTable: boolean;
  rfIemTableStages: number[];
  includeInfrastructureTable: boolean;
  infrastructureTableStages: number[];
  includeMissingRiderReport: boolean;
  includeWiredMicNeeds: boolean;
  wiredMicNeedsStages: number[];
  includeWeatherPrediction: boolean;
  generateIndividualStagePDFs: boolean;
}

interface PrintOptionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (options: PrintOptions, filename: string) => void;
  maxStages: number;
  jobTitle: string;
  jobId?: string;
}

export const PrintOptionsDialog = ({ 
  open, 
  onOpenChange, 
  onConfirm,
  maxStages,
  jobTitle,
  jobId
}: PrintOptionsDialogProps) => {
  const [options, setOptions] = useState<PrintOptions>({
    includeGearSetup: true,
    gearSetupStages: Array.from({ length: maxStages }, (_, i) => i + 1),
    includeShiftSchedules: true,
    shiftScheduleStages: Array.from({ length: maxStages }, (_, i) => i + 1),
    includeArtistTables: true,
    artistTableStages: Array.from({ length: maxStages }, (_, i) => i + 1),
    includeArtistRequirements: true,
    artistRequirementStages: Array.from({ length: maxStages }, (_, i) => i + 1),
    includeRfIemTable: true,
    rfIemTableStages: Array.from({ length: maxStages }, (_, i) => i + 1),
    includeInfrastructureTable: true,
    infrastructureTableStages: Array.from({ length: maxStages }, (_, i) => i + 1),
    includeMissingRiderReport: true,
    includeWiredMicNeeds: true,
    wiredMicNeedsStages: Array.from({ length: maxStages }, (_, i) => i + 1),
    includeWeatherPrediction: true,
    generateIndividualStagePDFs: false
  });
  const [missingRiderRecipientEmails, setMissingRiderRecipientEmails] = useState("");
  const [isSendingMissingRiderEmail, setIsSendingMissingRiderEmail] = useState(false);

  const parseRecipientEmails = (value: string) =>
    Array.from(
      new Set(
        value
          .split(/[,\n;]+/)
          .map((email) => email.trim())
          .filter(Boolean),
      ),
    );

  const escapeHtml = (value: string) =>
    value.replace(/[&<>"']/g, (char) => {
      const escaped: Record<string, string> = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };
      return escaped[char] || char;
    });

  const blobToBase64 = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = String(reader.result || "");
        const base64 = result.includes(",") ? result.split(",")[1] : result;
        if (!base64) {
          reject(new Error("No se pudo convertir el PDF a base64"));
          return;
        }
        resolve(base64);
      };
      reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer el PDF"));
      reader.readAsDataURL(blob);
    });

  const handleStageChange = (section: keyof PrintOptions, stageNumber: number, checked: boolean) => {
    if (section === 'gearSetupStages' || section === 'shiftScheduleStages' || 
        section === 'artistTableStages' || section === 'artistRequirementStages' || 
        section === 'rfIemTableStages' || section === 'infrastructureTableStages' ||
        section === 'wiredMicNeedsStages') {
      setOptions(prev => ({
        ...prev,
        [section]: checked 
          ? [...prev[section], stageNumber].sort((a, b) => a - b)
          : prev[section].filter(s => s !== stageNumber)
      }));
    }
  };

  const handleSelectAllStages = () => {
    const allStages = Array.from({ length: maxStages }, (_, i) => i + 1);
    setOptions(prev => ({
      ...prev,
      gearSetupStages: allStages,
      shiftScheduleStages: allStages,
      artistTableStages: allStages,
      artistRequirementStages: allStages,
      rfIemTableStages: allStages,
      infrastructureTableStages: allStages,
      wiredMicNeedsStages: allStages
    }));
  };

  const handleDeselectAllStages = () => {
    setOptions(prev => ({
      ...prev,
      gearSetupStages: [],
      shiftScheduleStages: [],
      artistTableStages: [],
      artistRequirementStages: [],
      rfIemTableStages: [],
      infrastructureTableStages: [],
      wiredMicNeedsStages: []
    }));
  };

  const generateFilename = (): string => {
    const baseTitle = jobTitle || "Festival";

    if (options.generateIndividualStagePDFs) {
      return buildReadableFilename([baseTitle, "Documentación por escenario"], "zip");
    }

    const sectionLabels: string[] = [];
    if (options.includeShiftSchedules) sectionLabels.push("Horarios de turnos");
    if (options.includeGearSetup) sectionLabels.push("Dotación técnica");
    if (options.includeArtistTables) sectionLabels.push("Cronograma artistas");
    if (options.includeRfIemTable) sectionLabels.push("Tabla RF IEM");
    if (options.includeInfrastructureTable) sectionLabels.push("Tabla infraestructura");
    if (options.includeMissingRiderReport) sectionLabels.push("Riders faltantes");
    if (options.includeArtistRequirements) sectionLabels.push("Fichas individuales artistas");
    if (options.includeWiredMicNeeds) sectionLabels.push("Micrófonos cableados");
    if (options.includeWeatherPrediction) sectionLabels.push("Predicción meteorológica");

    const allSelectedStages = new Set([
      ...(options.includeGearSetup ? options.gearSetupStages : []),
      ...(options.includeShiftSchedules ? options.shiftScheduleStages : []),
      ...(options.includeArtistTables ? options.artistTableStages : []),
      ...(options.includeArtistRequirements ? options.artistRequirementStages : []),
      ...(options.includeRfIemTable ? options.rfIemTableStages : []),
      ...(options.includeInfrastructureTable ? options.infrastructureTableStages : []),
      ...(options.includeWiredMicNeeds ? options.wiredMicNeedsStages : [])
    ]);
    const sortedStages = Array.from(allSelectedStages).sort((a, b) => a - b);
    const stageLabel =
      sortedStages.length > 0 && sortedStages.length < maxStages
        ? sortedStages.length === 1
          ? `Escenario ${sortedStages[0]}`
          : `Escenarios ${sortedStages.join(", ")}`
        : "";

    if (sectionLabels.length === 1) {
      return buildReadableFilename([baseTitle, stageLabel, sectionLabels[0]]);
    }

    return buildReadableFilename([baseTitle, stageLabel, "Documentación completa"]);
  };

  const renderStageSelections = (section: 'gearSetupStages' | 'shiftScheduleStages' | 'artistTableStages' | 'artistRequirementStages' | 'rfIemTableStages' | 'infrastructureTableStages' | 'wiredMicNeedsStages') => {
    return (
      <div className="pl-4 sm:pl-6 space-y-2">
        <p className="text-xs sm:text-sm text-muted-foreground">Select stages:</p>
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-2">
          {Array.from({ length: maxStages }, (_, i) => i + 1).map((stageNum) => (
            <div key={stageNum} className="flex items-center space-x-2">
              <Checkbox
                id={`${section}-${stageNum}`}
                checked={options[section].includes(stageNum)}
                onCheckedChange={(checked) => 
                  handleStageChange(section, stageNum, checked as boolean)
                }
                className="data-[state=checked]:bg-primary data-[state=checked]:border-primary dark:border-gray-500 dark:data-[state=checked]:bg-primary dark:data-[state=checked]:border-primary"
              />
              <Label 
                htmlFor={`${section}-${stageNum}`}
                className="text-xs sm:text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-gray-200"
              >
                Stage {stageNum}
              </Label>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const handleConfirm = () => {
    const filename = generateFilename();
    onConfirm(options, filename);
    onOpenChange(false);
  };

  const buildMissingRiderReport = async () => {
    if (!jobId) {
      throw new Error('Se requiere el ID del trabajo para generar el reporte de riders faltantes');
    }

    console.log('Generating Missing Rider Report for job:', jobId);
    
    // Fetch festival artists
    const { data: artists, error } = await supabase
      .from('festival_artists')
      .select('*')
      .eq('job_id', jobId);

    if (error) {
      console.error('Error fetching artists:', error);
      throw error;
    }

    // Filter artists with missing riders
    const missingRiderArtists = artists?.filter(artist => 
      Boolean(artist.rider_missing)
    ) || [];

    const { data: stageRows } = await supabase
      .from('festival_stages')
      .select('number, name')
      .eq('job_id', jobId);
    const stageNameByNumber = new Map<number, string>(
      (stageRows || []).map((row) => [Number(row.number), row.name || `Escenario ${row.number}`]),
    );

    const publicFormLinksByArtistId = await ensurePublicArtistFormLinks(
      missingRiderArtists.map((artist) => ({
        id: artist.id,
        form_language: artist.form_language,
      })),
    );

    console.log(`Found ${missingRiderArtists.length} artists with missing riders out of ${artists?.length || 0} total artists`);

    // Fetch logo (festival first, fallback to tour/job resolution)
    const logoUrl = (await fetchJobLogo(jobId)) || '';

    // Prepare data for PDF
    const missingRiderData: MissingRiderReportData = {
      jobTitle,
      logoUrl,
      artists: missingRiderArtists.map(artist => ({
        id: artist.id,
        name: artist.name || 'Unnamed Artist',
        stage: artist.stage || 1,
        stageName: stageNameByNumber.get(Number(artist.stage || 1)) || `Escenario ${artist.stage || 1}`,
        date: artist.date || '',
        showTime: {
          start: artist.show_start || '',
          end: artist.show_end || ''
        },
        formUrl: publicFormLinksByArtistId[artist.id],
      }))
    };

    // Generate PDF
    const pdfBlob = await exportMissingRiderReportPDF(missingRiderData);

    return {
      pdfBlob,
      missingCount: missingRiderArtists.length,
    };
  };

  const handleDownloadMissingRiderReport = async () => {
    try {
      const { pdfBlob } = await buildMissingRiderReport();

      // Download file
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = buildReadableFilename([jobTitle || "Festival", "Reporte riders faltantes"]);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Reporte de Riders Faltantes descargado exitosamente');
    } catch (error: any) {
      console.error('Error generating Missing Rider Report:', error);
      toast.error(`Error al generar Reporte de Riders Faltantes: ${error.message}`);
    }
  };

  const handleSendMissingRiderReport = async () => {
    const recipients = parseRecipientEmails(missingRiderRecipientEmails);
    if (recipients.length === 0) {
      toast.error("Añade al menos un correo externo para enviar el reporte.");
      return;
    }

    setIsSendingMissingRiderEmail(true);
    try {
      const { pdfBlob, missingCount } = await buildMissingRiderReport();
      const pdfBase64 = await blobToBase64(pdfBlob);
      const pdfFilename = buildReadableFilename([jobTitle || "Festival", "Reporte riders faltantes"]);

      const bodyHtml = `
        <p>Hola,</p>
        <p>Adjuntamos el <strong>Reporte de Riders Faltantes</strong> del festival <strong>${escapeHtml(jobTitle)}</strong>.</p>
        <p>Artistas con rider pendiente: <strong>${missingCount}</strong>.</p>
        <p>El PDF incluye el QR del formulario público por artista para completar la información técnica cuanto antes.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
        <p style="font-size:12px;color:#6b7280;">
          Este correo es automático. Por favor, no respondas a este email. Si tienes incidencias, contacta con la oficina técnica del festival en
          <a href="mailto:sonido@sector-pro.com">sonido@sector-pro.com</a>.
        </p>
      `;

      const { data, error } = await supabase.functions.invoke("send-corporate-email", {
        body: {
          subject: `Reporte Riders Faltantes - ${jobTitle}`,
          bodyHtml,
          recipients: { emails: recipients },
          pdfAttachments: [
            {
              filename: pdfFilename,
              content: pdfBase64,
              size: pdfBlob.size,
            },
          ],
          senderNameOverride: "Festivales - Sector Pro",
        },
      });

      if (error) {
        throw error;
      }
      if (!data?.success) {
        throw new Error(data?.error || "No se pudo enviar el correo");
      }

      toast.success(`Reporte enviado a ${recipients.length} destinatario(s).`);
    } catch (error: any) {
      console.error('Error sending Missing Rider Report email:', error);
      toast.error(`Error al enviar reporte de riders faltantes: ${error.message}`);
    } finally {
      setIsSendingMissingRiderEmail(false);
    }
  };

  const handleDownloadGearSetup = async () => {
    if (!jobId) {
      toast.error('Se requiere el ID del trabajo para generar el reporte de equipamiento');
      return;
    }

    try {
      console.log('Downloading Gear Setup for job:', jobId);
      
      const logoUrl = await fetchLogoUrl(jobId);
      
      // Generate gear setup PDF for selected stages
      const stagePromises = options.gearSetupStages.map(async (stageNumber) => {
        return await generateStageGearPDF(jobId, stageNumber, logoUrl);
      });

      const gearBlobs = await Promise.all(stagePromises);
      
      if (gearBlobs.length === 1) {
        // Single stage - download directly
        const url = URL.createObjectURL(gearBlobs[0]);
        const a = document.createElement('a');
        a.href = url;
        a.download = buildReadableFilename([
          jobTitle || "Festival",
          `Escenario ${options.gearSetupStages[0]}`,
          "Dotación técnica",
        ]);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        // Multiple stages - merge and download
        const { mergePDFs } = await import('@/utils/pdf/pdfMerge');
        const mergedBlob = await mergePDFs(gearBlobs);
        
        const url = URL.createObjectURL(mergedBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = buildReadableFilename([jobTitle || "Festival", "Dotación técnica"]);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      toast.success('Equipamiento descargado exitosamente');
    } catch (error: any) {
      console.error('Error generating Gear Setup:', error);
      toast.error(`Error al generar Equipamiento: ${error.message}`);
    }
  };

  const handleDownloadShiftSchedules = async () => {
    if (!jobId) {
      toast.error('Se requiere el ID del trabajo para generar horarios de turnos');
      return;
    }

    try {
      console.log('Downloading Shift Schedules for job:', jobId);
      
      const logoUrl = await fetchLogoUrl(jobId);
      
      // Fetch shifts data
      const { data: shifts, error } = await supabase
        .from('festival_shifts')
        .select(`
          *,
          festival_shift_assignments (
            technician_id,
            external_technician_name,
            role,
            profiles (first_name, last_name)
          )
        `)
        .eq('job_id', jobId)
        .in('stage', options.shiftScheduleStages)
        .order('date')
        .order('start_time');

      if (error) throw error;

      const shiftsData: ShiftsTablePdfData = {
        jobTitle,
        date: new Date().toISOString().split('T')[0], // Current date as fallback
        logoUrl,
        shifts: shifts || []
      };

      const pdfBlob = await exportShiftsTablePDF(shiftsData);
      
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = buildReadableFilename([jobTitle || "Festival", "Horarios de turnos"]);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Horarios de Turnos descargados exitosamente');
    } catch (error: any) {
      console.error('Error generating Shift Schedules:', error);
      toast.error(`Error al generar Horarios de Turnos: ${error.message}`);
    }
  };

  const handleDownloadArtistTables = async () => {
    if (!jobId) {
      toast.error('Se requiere el ID del trabajo para generar tablas de artistas');
      return;
    }

    try {
      console.log('Downloading Artist Tables for job:', jobId);
      
      const logoUrl = await fetchLogoUrl(jobId);
      
      // Fetch artists data
      const { data: artists, error } = await supabase
        .from('festival_artists')
        .select('*')
        .eq('job_id', jobId)
        .in('stage', options.artistTableStages)
        .order('date')
        .order('stage')
        .order('show_start');

      if (error) throw error;

      const artistData: ArtistTablePdfData = {
        jobTitle,
        date: new Date().toISOString().split('T')[0], // Current date as fallback
        logoUrl,
        artists: artists || []
      };

      const pdfBlob = await exportArtistTablePDF(artistData);
      
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = buildReadableFilename([jobTitle || "Festival", "Cronograma artistas"]);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Tablas de Artistas descargadas exitosamente');
    } catch (error: any) {
      console.error('Error generating Artist Tables:', error);
      toast.error(`Error al generar Tablas de Artistas: ${error.message}`);
    }
  };

  const handleDownloadRfIemTable = async () => {
    if (!jobId) {
      toast.error('Se requiere el ID del trabajo para generar tabla de RF/IEM');
      return;
    }

    try {
      console.log('Downloading RF/IEM Table for job:', jobId);
      
      const logoUrl = await fetchLogoUrl(jobId);
      
      // Fetch artists data
      const { data: artists, error } = await supabase
        .from('festival_artists')
        .select('*')
        .eq('job_id', jobId)
        .in('stage', options.rfIemTableStages)
        .order('date')
        .order('stage')
        .order('show_start');

      if (error) throw error;

      const rfIemData: RfIemTablePdfData = {
        jobTitle,
        logoUrl,
        artists: artists || []
      };

      const pdfBlob = await exportRfIemTablePDF(rfIemData);
      
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = buildReadableFilename([jobTitle || "Festival", "Tabla RF IEM"]);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Tabla de RF/IEM descargada exitosamente');
    } catch (error: any) {
      console.error('Error generating RF/IEM Table:', error);
      toast.error(`Error al generar Tabla de RF/IEM: ${error.message}`);
    }
  };

  const handleDownloadInfrastructureTable = async () => {
    if (!jobId) {
      toast.error('Se requiere el ID del trabajo para generar tabla de infraestructura');
      return;
    }

    try {
      console.log('Downloading Infrastructure Table for job:', jobId);
      
      const logoUrl = await fetchLogoUrl(jobId);
      
      // Fetch artists data
      const { data: artists, error } = await supabase
        .from('festival_artists')
        .select('*')
        .eq('job_id', jobId)
        .in('stage', options.infrastructureTableStages)
        .order('date')
        .order('stage')
        .order('show_start');

      if (error) throw error;

      const infraData: InfrastructureTablePdfData = {
        jobTitle,
        logoUrl,
        artists: artists || []
      };

      const pdfBlob = await exportInfrastructureTablePDF(infraData);
      
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = buildReadableFilename([jobTitle || "Festival", "Tabla infraestructura"]);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Tabla de Infraestructura descargada exitosamente');
    } catch (error: any) {
      console.error('Error generating Infrastructure Table:', error);
      toast.error(`Error al generar Tabla de Infraestructura: ${error.message}`);
    }
  };

  const handleDownloadWiredMicNeeds = async () => {
    if (!jobId) {
      toast.error('Se requiere el ID del trabajo para generar necesidades de micrófonos cableados');
      return;
    }

    try {
      console.log('Downloading Wired Microphone Needs for job:', jobId);
      
      const logoUrl = await fetchLogoUrl(jobId);
      
      // Fetch artists data
      const { data: artists, error } = await supabase
        .from('festival_artists')
        .select('*')
        .eq('job_id', jobId)
        .in('stage', options.wiredMicNeedsStages)
        .order('date')
        .order('stage')
        .order('show_start');

      if (error) throw error;

      const filteredArtists = artists?.filter(artist => 
        artist.mic_kit === 'festival' &&
        artist.wired_mics &&
        Array.isArray(artist.wired_mics) &&
        artist.wired_mics.length > 0
      ) || [];

      const organizedData = organizeArtistsByDateAndStage(filteredArtists);

      const wiredMicData: WiredMicrophoneMatrixData = {
        jobTitle,
        logoUrl,
        artistsByDateAndStage: organizedData
      };

      const pdfBlob = await exportWiredMicrophoneMatrixPDF(wiredMicData);
      
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = buildReadableFilename([jobTitle || "Festival", "Necesidades micrófonos cableados"]);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Necesidades de Micrófonos Cableados descargadas exitosamente');
    } catch (error: any) {
      console.error('Error generating Wired Microphone Needs:', error);
      toast.error(`Error al generar Necesidades de Micrófonos Cableados: ${error.message}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] sm:max-h-[90vh] w-[95vw] sm:w-auto overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">Seleccionar Documentos para Imprimir</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 sm:space-y-6 py-2 sm:py-4">
          <div className="border rounded-lg p-4 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800">
            <div className="flex items-center space-x-2 mb-2">
              <Checkbox
                id="individual-stage-pdfs"
                checked={options.generateIndividualStagePDFs}
                onCheckedChange={(checked) =>
                  setOptions(prev => ({ ...prev, generateIndividualStagePDFs: checked as boolean }))
                }
                className="data-[state=checked]:bg-primary data-[state=checked]:border-primary dark:border-gray-500 dark:data-[state=checked]:bg-primary dark:data-[state=checked]:border-primary"
              />
              <Label
                htmlFor="individual-stage-pdfs"
                className="font-medium text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-gray-200"
              >
                Generar PDFs Individuales por Stage
              </Label>
            </div>
            <p className="text-sm text-muted-foreground pl-6 dark:text-gray-300">
              {options.generateIndividualStagePDFs
                ? "Crea documentos PDF separados para cada stage conteniendo los tipos de documentos seleccionados. Se descarga como un archivo ZIP con PDFs individuales para cada stage."
                : "Crear un único PDF combinado con los tipos de documentos y stages seleccionados. Usa las selecciones de stage abajo para elegir qué stages incluir para cada tipo de documento."
              }
            </p>
          </div>

          {maxStages > 1 && (
            <div className="border-b pb-4">
              <h3 className="text-sm font-medium mb-3 dark:text-gray-200">Controles Globales de Stage</h3>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAllStages}
                  className="w-full sm:w-auto"
                >
                  Seleccionar Todos los Stages
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDeselectAllStages}
                  className="w-full sm:w-auto"
                >
                  Deseleccionar Todos los Stages
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2 dark:text-gray-400">
                {options.generateIndividualStagePDFs
                  ? "Estos controles aplican a todas las secciones. Se generarán PDFs individuales para stages que tengan contenido en cada tipo de documento seleccionado."
                  : "Estos controles aplican a todas las secciones que tienen selecciones de stage."
                }
              </p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="gear-setup"
                    checked={options.includeGearSetup}
                    onCheckedChange={(checked) => 
                      setOptions(prev => ({ ...prev, includeGearSetup: checked as boolean }))
                    }
                    className="data-[state=checked]:bg-primary data-[state=checked]:border-primary dark:border-gray-500 dark:data-[state=checked]:bg-primary dark:data-[state=checked]:border-primary"
                  />
                  <Label
                    htmlFor="gear-setup"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-gray-200"
                  >
                    Configuración de Equipamiento por Stage
                  </Label>
                </div>
                {jobId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDownloadGearSetup}
                    className="h-8 px-2"
                    title="Download Gear Setup only"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {options.includeGearSetup && maxStages > 1 && renderStageSelections('gearSetupStages')}
            </div>

            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="shift-schedules"
                    checked={options.includeShiftSchedules}
                    onCheckedChange={(checked) => 
                      setOptions(prev => ({ ...prev, includeShiftSchedules: checked as boolean }))
                    }
                    className="data-[state=checked]:bg-primary data-[state=checked]:border-primary dark:border-gray-500 dark:data-[state=checked]:bg-primary dark:data-[state=checked]:border-primary"
                  />
                  <Label
                    htmlFor="shift-schedules"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-gray-200"
                  >
                    Horarios de Turnos de Personal
                  </Label>
                </div>
                {jobId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDownloadShiftSchedules}
                    className="h-8 px-2"
                    title="Download Shift Schedules only"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {options.includeShiftSchedules && maxStages > 1 && renderStageSelections('shiftScheduleStages')}
            </div>

            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="artist-tables"
                    checked={options.includeArtistTables}
                    onCheckedChange={(checked) => 
                      setOptions(prev => ({ ...prev, includeArtistTables: checked as boolean }))
                    }
                    className="data-[state=checked]:bg-primary data-[state=checked]:border-primary dark:border-gray-500 dark:data-[state=checked]:bg-primary dark:data-[state=checked]:border-primary"
                  />
                  <Label
                    htmlFor="artist-tables"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-gray-200"
                  >
                    Tablas de Programación de Artistas
                  </Label>
                </div>
                {jobId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDownloadArtistTables}
                    className="h-8 px-2"
                    title="Download Artist Tables only"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {options.includeArtistTables && maxStages > 1 && renderStageSelections('artistTableStages')}
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="artist-requirements"
                  checked={options.includeArtistRequirements}
                  onCheckedChange={(checked) => 
                    setOptions(prev => ({ ...prev, includeArtistRequirements: checked as boolean }))
                  }
                  className="data-[state=checked]:bg-primary data-[state=checked]:border-primary dark:border-gray-500 dark:data-[state=checked]:bg-primary dark:data-[state=checked]:border-primary"
                />
                <Label
                  htmlFor="artist-requirements"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-gray-200"
                >
                  Requerimientos Individuales de Artistas
                </Label>
              </div>
              {options.includeArtistRequirements && maxStages > 1 && renderStageSelections('artistRequirementStages')}
            </div>

            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="rf-iem-table"
                    checked={options.includeRfIemTable}
                    onCheckedChange={(checked) => 
                      setOptions(prev => ({ ...prev, includeRfIemTable: checked as boolean }))
                    }
                    className="data-[state=checked]:bg-primary data-[state=checked]:border-primary dark:border-gray-500 dark:data-[state=checked]:bg-primary dark:data-[state=checked]:border-primary"
                  />
                  <Label
                    htmlFor="rf-iem-table"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-gray-200"
                  >
                    Resumen de RF e IEM de Artistas
                  </Label>
                </div>
                {jobId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDownloadRfIemTable}
                    className="h-8 px-2"
                    title="Download RF/IEM Table only"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {options.includeRfIemTable && maxStages > 1 && renderStageSelections('rfIemTableStages')}
            </div>

            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="infrastructure-table"
                    checked={options.includeInfrastructureTable}
                    onCheckedChange={(checked) => 
                      setOptions(prev => ({ ...prev, includeInfrastructureTable: checked as boolean }))
                    }
                    className="data-[state=checked]:bg-primary data-[state=checked]:border-primary dark:border-gray-500 dark:data-[state=checked]:bg-primary dark:data-[state=checked]:border-primary"
                  />
                  <Label
                    htmlFor="infrastructure-table"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-gray-200"
                  >
                    Resumen de Necesidades de Infraestructura
                  </Label>
                </div>
                {jobId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDownloadInfrastructureTable}
                    className="h-8 px-2"
                    title="Download Infrastructure Table only"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {options.includeInfrastructureTable && maxStages > 1 && renderStageSelections('infrastructureTableStages')}
            </div>

            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="wired-mic-needs"
                    checked={options.includeWiredMicNeeds}
                    onCheckedChange={(checked) => 
                      setOptions(prev => ({ ...prev, includeWiredMicNeeds: checked as boolean }))
                    }
                    className="data-[state=checked]:bg-primary data-[state=checked]:border-primary dark:border-gray-500 dark:data-[state=checked]:bg-primary dark:data-[state=checked]:border-primary"
                  />
                  <Label
                    htmlFor="wired-mic-needs"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-gray-200"
                  >
                    Requerimientos de Micrófonos Cableados
                  </Label>
                </div>
                {jobId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDownloadWiredMicNeeds}
                    className="h-8 px-2"
                    title="Download Wired Microphone Needs only"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {options.includeWiredMicNeeds && maxStages > 1 && renderStageSelections('wiredMicNeedsStages')}
              <div className="pl-6 text-sm text-muted-foreground dark:text-gray-300">
                Requerimientos detallados de inventario de micrófonos y análisis de uso pico
              </div>
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="weather-prediction"
                  checked={options.includeWeatherPrediction}
                  onCheckedChange={(checked) => 
                    setOptions(prev => ({ ...prev, includeWeatherPrediction: checked as boolean }))
                  }
                  className="data-[state=checked]:bg-primary data-[state=checked]:border-primary dark:border-gray-500 dark:data-[state=checked]:bg-primary dark:data-[state=checked]:border-primary"
                />
                <Label
                  htmlFor="weather-prediction"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-gray-200"
                >
                  Incluir Pronóstico del Tiempo
                </Label>
              </div>
              <div className="pl-6 text-sm text-muted-foreground dark:text-gray-300">
                Pronóstico del tiempo para las fechas del festival de Open-Meteo
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="missing-rider-report"
                    checked={options.includeMissingRiderReport}
                    onCheckedChange={(checked) => 
                      setOptions(prev => ({ ...prev, includeMissingRiderReport: checked as boolean }))
                    }
                    className="data-[state=checked]:bg-primary data-[state=checked]:border-primary dark:border-gray-500 dark:data-[state=checked]:bg-primary dark:data-[state=checked]:border-primary"
                  />
                  <Label
                    htmlFor="missing-rider-report"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-gray-200"
                  >
                    Reporte de Riders Faltantes
                  </Label>
                </div>
                {jobId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDownloadMissingRiderReport}
                    className="h-8 px-2"
                    title="Download Missing Rider Report only"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="pl-6 text-sm text-muted-foreground dark:text-gray-300">
                Resumen de todos los artistas con riders técnicos faltantes
              </div>
              {jobId && (
                <div className="pl-6 mt-3 space-y-2">
                  <Label htmlFor="missing-rider-recipient-emails" className="text-sm font-medium dark:text-gray-200">
                    Enviar reporte por email (externo)
                  </Label>
                  <Textarea
                    id="missing-rider-recipient-emails"
                    value={missingRiderRecipientEmails}
                    onChange={(event) => setMissingRiderRecipientEmails(event.target.value)}
                    placeholder="correo1@dominio.com, correo2@dominio.com"
                    rows={3}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleSendMissingRiderReport}
                    disabled={isSendingMissingRiderEmail}
                    className="w-full sm:w-auto"
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    {isSendingMissingRiderEmail ? "Enviando reporte..." : "Enviar Reporte por Email"}
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="bg-muted/50 p-3 rounded-md dark:bg-muted/20">
              <h4 className="text-xs sm:text-sm font-medium mb-1 dark:text-gray-200">Nombre de archivo generado:</h4>
              <p className="text-xs sm:text-sm text-muted-foreground font-mono dark:text-gray-300 break-all">{generateFilename()}</p>
            </div>
          </div>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Cancelar
          </Button>
          <Button onClick={handleConfirm} className="w-full sm:w-auto">
            <span className="hidden sm:inline">Generar {options.generateIndividualStagePDFs ? 'PDFs Individuales por Stage' : 'PDF'}</span>
            <span className="sm:hidden">Generar</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
