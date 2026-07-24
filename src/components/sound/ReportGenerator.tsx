import React, { useEffect, useMemo, useState } from 'react';
import { Check, FolderOpen, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  formatTechnicalStageLabel,
  TechnicalStageSelector,
  useSelectedTechnicalStage,
} from '@/features/technical-tools/stage/stageAllocation';
import { getTechnicalStageStorageScope } from '@/features/technical-tools/stage/stageUtils';
import {
  buildSoundvisionReportFilename,
  formatSoundvisionDateRange,
  formatSoundvisionIssueDate,
  MAX_SOUNDVISION_SCHEDULE_ROWS,
  parseSoundvisionEquipment,
  SOUNDVISION_PLOT_DEFINITIONS,
  SOUNDVISION_REPORT_BRANDS,
  soundvisionPlotImageKey,
  validateSoundvisionReport,
  type SoundvisionPlotId,
  type SoundvisionReportConditions,
  type SoundvisionReportModel,
  type SoundvisionReportSystem,
  type SoundvisionPlotView,
} from '@/features/technical-tools/soundvision/reportModel';
import { DocumentationJobPicker } from '@/features/technical-tools/jobs/DocumentationJobPicker';
import { useJobSelection } from '@/hooks/useJobSelection';
import { useToast } from '@/hooks/use-toast';
import { uploadJobPdfWithCleanup } from '@/utils/jobDocumentsUpload';
import { fetchJobLogo } from '@/utils/pdf/logoUtils';
import {
  blobToSoundvisionPdfImage,
  generateSoundvisionReportPdf,
  loadSoundvisionPdfImage,
} from '@/utils/pdf/soundvisionReportPdf';

type ImageFiles = Record<string, File | null>;
type IsoSelection = Partial<Record<SoundvisionPlotId, boolean>>;

type MappingItem = {
  filename: string;
  plotTitle: string;
  viewLabel: string;
};

type MappingResult = {
  found: MappingItem[];
  missing: MappingItem[];
};

type DirectoryInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  webkitdirectory: string;
};

const DIRECTORY_INPUT_PROPS: DirectoryInputProps = { webkitdirectory: '' };
const COMPANY_LOGO_PATH = '/sector pro logo.png';

const DEFAULT_CONDITIONS: SoundvisionReportConditions = {
  temperatureC: '15',
  humidityPercent: '70',
  inputLevelDbu: '0',
  audiencePlaneM: '1.60',
};

const VIEW_LABELS: Record<SoundvisionPlotView, string> = {
  top: 'Vista en planta',
  iso: 'Vista isométrica',
};

const expectedFiles = SOUNDVISION_PLOT_DEFINITIONS.flatMap((plot) => [
  { fileBase: plot.topFileBase, plotId: plot.id, plotTitle: plot.title, view: 'top' as const },
  ...(plot.isoFileBase
    ? [{ fileBase: plot.isoFileBase, plotId: plot.id, plotTitle: plot.title, view: 'iso' as const }]
    : []),
]);

const downloadPdfBlob = (blob: Blob, filename: string): void => {
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = window.document.createElement('a');
  link.href = downloadUrl;
  link.download = filename;
  link.click();
  window.setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 0);
};

const baseFilename = (file: File): string =>
  file.name.replace(/\.[^.]+$/, '').trim().toUpperCase();

export const ReportGenerator = () => {
  const { toast } = useToast();
  const { data: jobs } = useJobSelection();
  const [selectedJobId, setSelectedJobId] = useState('');
  const [reportSystem, setReportSystem] = useState<SoundvisionReportSystem>('LA');
  const [revision, setRevision] = useState('A');
  const [equipment, setEquipment] = useState('');
  const [conditions, setConditions] = useState(DEFAULT_CONDITIONS);
  const [images, setImages] = useState<ImageFiles>({});
  const [isoSelection, setIsoSelection] = useState<IsoSelection>({});
  const [jobLogo, setJobLogo] = useState<string>();
  const [mappingResult, setMappingResult] = useState<MappingResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const {
    hasMultipleStages,
    isLoadingStages,
    selectedStage,
    selectedStageNumber,
    setSelectedStageNumber,
    stages: jobStages,
  } = useSelectedTechnicalStage({
    enabled: Boolean(selectedJobId),
    jobId: selectedJobId,
  });

  const selectedJob = useMemo(
    () => jobs?.find((job) => job.id === selectedJobId),
    [jobs, selectedJobId],
  );

  useEffect(() => {
    let active = true;
    if (!selectedJobId) {
      setJobLogo(undefined);
      return () => {
        active = false;
      };
    }

    void fetchJobLogo(selectedJobId)
      .then((logo) => {
        if (active) setJobLogo(logo);
      })
      .catch((error) => {
        console.error('Error loading job logo:', error);
        if (active) setJobLogo(undefined);
      });

    return () => {
      active = false;
    };
  }, [selectedJobId]);

  const setCondition = (key: keyof SoundvisionReportConditions, value: string) => {
    setConditions((current) => ({ ...current, [key]: value }));
  };

  const handleImageChange = (
    plotId: SoundvisionPlotId,
    view: SoundvisionPlotView,
    file: File | null,
  ) => {
    setImages((current) => ({ ...current, [soundvisionPlotImageKey(plotId, view)]: file }));
  };

  const handleFolderSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    if (selectedFiles.length === 0) return;

    const found: MappingItem[] = [];
    const missing: MappingItem[] = [];
    const mappedImages: ImageFiles = { ...images };
    const mappedIso: IsoSelection = { ...isoSelection };

    expectedFiles.forEach((expected) => {
      const match = selectedFiles.find((file) => baseFilename(file) === expected.fileBase);
      const item = {
        filename: match?.name ?? `${expected.fileBase}.png`,
        plotTitle: expected.plotTitle,
        viewLabel: VIEW_LABELS[expected.view],
      };

      if (match) {
        found.push(item);
        mappedImages[soundvisionPlotImageKey(expected.plotId, expected.view)] = match;
        if (expected.view === 'iso') mappedIso[expected.plotId] = true;
      } else {
        missing.push(item);
      }
    });

    setImages(mappedImages);
    setIsoSelection(mappedIso);
    setMappingResult({ found, missing });
    event.target.value = '';
    toast({
      title: 'Importación completada',
      description: `${found.length} archivos asignados; ${missing.length} no encontrados.`,
    });
  };

  const clearAutoMapping = () => {
    setImages({});
    setIsoSelection({});
    setMappingResult(null);
    toast({
      title: 'Asignación eliminada',
      description: 'Se han retirado todas las imágenes del informe.',
    });
  };

  const buildReportModel = async (): Promise<SoundvisionReportModel> => {
    if (!selectedJob) throw new Error('Seleccione un trabajo antes de generar el informe.');

    const plots = await Promise.all(SOUNDVISION_PLOT_DEFINITIONS.map(async (definition) => {
      const topFile = images[soundvisionPlotImageKey(definition.id, 'top')];
      const isoFile = isoSelection[definition.id]
        ? images[soundvisionPlotImageKey(definition.id, 'iso')]
        : null;
      return {
        id: definition.id,
        title: definition.title,
        descriptor: definition.descriptor,
        weighting: definition.weighting,
        band: definition.band,
        topView: topFile ? await blobToSoundvisionPdfImage(topFile) : null,
        isoView: isoFile ? await blobToSoundvisionPdfImage(isoFile) : null,
      };
    }));

    return {
      system: reportSystem,
      eventTitle: selectedJob.title || 'Trabajo sin nombre',
      stageLabel: formatTechnicalStageLabel(selectedStage) ?? '',
      eventDate: formatSoundvisionDateRange(selectedJob.start_time, selectedJob.end_time),
      issuedDate: formatSoundvisionIssueDate(new Date()),
      revision: revision.trim() || 'A',
      equipment: parseSoundvisionEquipment(equipment),
      conditions,
      plots,
    };
  };

  const generateReport = async () => {
    if (isLoadingStages) {
      toast({
        title: 'Cargando escenarios',
        description: 'Espere a que termine la carga antes de generar el informe.',
      });
      return;
    }
    if (hasMultipleStages && selectedStageNumber == null) {
      toast({
        title: 'Falta el escenario',
        description: 'Seleccione un escenario antes de generar el informe.',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    try {
      const model = await buildReportModel();
      const validationErrors = validateSoundvisionReport(model);
      if (validationErrors.length > 0) throw new Error(validationErrors.join(' '));

      const brand = SOUNDVISION_REPORT_BRANDS[model.system];
      const [companyLogo, clientLogo, predictionLogo] = await Promise.all([
        loadSoundvisionPdfImage(COMPANY_LOGO_PATH),
        loadSoundvisionPdfImage(jobLogo),
        loadSoundvisionPdfImage(brand.logoPath),
      ]);
      const blob = await generateSoundvisionReportPdf(model, {
        companyLogo,
        clientLogo,
        predictionLogo,
      });
      const filename = buildSoundvisionReportFilename(
        model.system,
        model.eventTitle,
        model.stageLabel,
      );

      downloadPdfBlob(blob, filename);
      toast({
        title: 'Descarga iniciada',
        description: 'El informe se está guardando también en los documentos del trabajo.',
      });

      void uploadJobPdfWithCleanup(selectedJobId, blob, filename, 'calculators/sv-report', {
        cleanupScope: getTechnicalStageStorageScope(selectedStage),
      })
        .then(() => {
          toast({
            title: 'Informe guardado',
            description: 'El PDF está disponible en los documentos del trabajo.',
          });
        })
        .catch((error) => {
          console.error('Error uploading prediction report:', error);
          toast({
            title: 'Subida fallida',
            description: 'El PDF se descargó, pero no se pudo guardar en el trabajo.',
            variant: 'destructive',
          });
        });
    } catch (error) {
      toast({
        title: 'No se pudo generar el informe',
        description: error instanceof Error ? error.message : 'Revise los datos del informe.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="mx-auto my-6 w-full max-w-4xl">
      <CardHeader className="space-y-1">
        <CardTitle className="text-center text-2xl font-bold">
          Informe de predicción acústica
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="jobSelect">Trabajo</Label>
            <DocumentationJobPicker
              id="jobSelect"
              jobs={jobs}
              onValueChange={setSelectedJobId}
              value={selectedJobId}
            />
          </div>

          <TechnicalStageSelector
            label="Escenario"
            selectedStageNumber={selectedStageNumber}
            stages={jobStages}
            onChange={setSelectedStageNumber}
          />

          <div className="grid gap-4 md:grid-cols-[1fr_120px]">
            <div className="space-y-2">
              <Label>Sistema del informe</Label>
              <RadioGroup
                value={reportSystem}
                onValueChange={(value) => setReportSystem(value as SoundvisionReportSystem)}
                className="flex flex-col gap-3 sm:flex-row sm:gap-6"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="LA" id="report-la" />
                  <Label htmlFor="report-la" className="cursor-pointer">L&apos;Acoustics</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Turbo" id="report-turbo" />
                  <Label htmlFor="report-turbo" className="cursor-pointer">Turbosound</Label>
                </div>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-revision">Revisión</Label>
              <Input
                id="report-revision"
                value={revision}
                onChange={(event) => setRevision(event.target.value)}
                maxLength={4}
              />
            </div>
          </div>

          <div className="space-y-3 rounded-lg border p-4">
            <div>
              <h3 className="text-sm font-semibold">Condiciones de predicción</h3>
              <p className="text-xs text-muted-foreground">
                Estos valores aparecerán en todas las páginas de gráficos.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="temperature">Temperatura (°C)</Label>
                <Input
                  id="temperature"
                  inputMode="decimal"
                  value={conditions.temperatureC}
                  onChange={(event) => setCondition('temperatureC', event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="humidity">Humedad relativa (%)</Label>
                <Input
                  id="humidity"
                  inputMode="decimal"
                  value={conditions.humidityPercent}
                  onChange={(event) => setCondition('humidityPercent', event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="input-level">Nivel de entrada (dBu)</Label>
                <Input
                  id="input-level"
                  inputMode="decimal"
                  value={conditions.inputLevelDbu}
                  onChange={(event) => setCondition('inputLevelDbu', event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="audience-plane">Plano de audiencia (m)</Label>
                <Input
                  id="audience-plane"
                  inputMode="decimal"
                  value={conditions.audiencePlaneM}
                  onChange={(event) => setCondition('audiencePlaneM', event.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="equipment">Listado de equipo</Label>
            <Textarea
              id="equipment"
              value={equipment}
              onChange={(event) => setEquipment(event.target.value)}
              placeholder={"24 K2 (Main hang)\n12 KS28 (Subwoofer)\n8 X12 (Front fill)"}
              className="min-h-[120px] bg-background text-foreground"
            />
            <p className="text-xs text-muted-foreground">
              Una línea por modelo: cantidad, modelo y función entre paréntesis. Máximo{' '}
              {MAX_SOUNDVISION_SCHEDULE_ROWS} líneas.
            </p>
          </div>

          <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold">Importación automática</h3>
                <p className="text-xs text-muted-foreground">
                  Busca TOP_A, ISO_A, TOP_C, ISO_C y SUB dentro de una carpeta.
                </p>
              </div>
              {mappingResult && (
                <Button variant="outline" size="sm" onClick={clearAutoMapping}>
                  Limpiar imágenes
                </Button>
              )}
            </div>
            <Label htmlFor="report-folder" className="inline-flex cursor-pointer">
              <span className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm hover:bg-accent">
                <FolderOpen className="h-4 w-4" />
                Seleccionar carpeta
              </span>
            </Label>
            <input
              id="report-folder"
              type="file"
              accept="image/png,image/jpeg"
              {...DIRECTORY_INPUT_PROPS}
              multiple
              onChange={handleFolderSelection}
              className="hidden"
            />

            {mappingResult && (
              <ScrollArea className="max-h-44">
                <div className="space-y-1 pr-4">
                  {mappingResult.found.map((item) => (
                    <div key={`${item.filename}-${item.viewLabel}`} className="flex items-center gap-2 text-xs">
                      <Check className="h-3 w-3 shrink-0 text-green-600" />
                      <span className="font-mono">{item.filename}</span>
                      <span className="text-muted-foreground">→</span>
                      <span>{item.plotTitle} · {item.viewLabel}</span>
                    </div>
                  ))}
                  {mappingResult.missing.map((item) => (
                    <div key={`${item.filename}-${item.viewLabel}`} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <X className="h-3 w-3 shrink-0 text-red-600" />
                      <span className="font-mono">{item.filename}</span>
                      <span>→</span>
                      <span>{item.plotTitle} · {item.viewLabel}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          <div className="space-y-4">
            {SOUNDVISION_PLOT_DEFINITIONS.map((plot) => {
              const topFile = images[soundvisionPlotImageKey(plot.id, 'top')];
              const isoFile = images[soundvisionPlotImageKey(plot.id, 'iso')];
              return (
                <div key={plot.id} className="rounded-lg border bg-muted/20 p-4">
                  <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <Label className="text-sm font-semibold">{plot.title}</Label>
                      <p className="text-xs text-muted-foreground">
                        PNG recomendado, 1800 px de ancho o más.
                      </p>
                    </div>
                    {plot.isoFileBase && (
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`iso-${plot.id}`}
                          checked={Boolean(isoSelection[plot.id])}
                          onCheckedChange={(checked) => {
                            setIsoSelection((current) => ({ ...current, [plot.id]: checked === true }));
                          }}
                        />
                        <Label htmlFor={`iso-${plot.id}`} className="cursor-pointer text-xs">
                          Incluir vista isométrica
                        </Label>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`top-${plot.id}`} className="text-xs">Vista en planta</Label>
                        {topFile && <Check className="h-3 w-3 text-green-600" />}
                      </div>
                      <Input
                        id={`top-${plot.id}`}
                        type="file"
                        accept="image/png,image/jpeg"
                        onChange={(event) => handleImageChange(plot.id, 'top', event.target.files?.[0] ?? null)}
                      />
                      {topFile && <p className="text-xs text-muted-foreground">{topFile.name}</p>}
                    </div>

                    {plot.isoFileBase && isoSelection[plot.id] && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`iso-file-${plot.id}`} className="text-xs">Vista isométrica</Label>
                          {isoFile && <Check className="h-3 w-3 text-green-600" />}
                        </div>
                        <Input
                          id={`iso-file-${plot.id}`}
                          type="file"
                          accept="image/png,image/jpeg"
                          onChange={(event) => handleImageChange(plot.id, 'iso', event.target.files?.[0] ?? null)}
                        />
                        {isoFile && <p className="text-xs text-muted-foreground">{isoFile.name}</p>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <Button onClick={generateReport} className="w-full" disabled={isGenerating}>
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generando informe…
              </>
            ) : (
              `Generar ${SOUNDVISION_REPORT_BRANDS[reportSystem].reportLabel}`
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
