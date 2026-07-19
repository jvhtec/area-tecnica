import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import {
  FileText,
  Network,
  Plus,
  RefreshCw,
  Upload,
  UploadCloud,
  Wand2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { generateAmpRackLayoutPdf } from '@/utils/amplifierRackLayoutPdf';
import type { AmplifierResults } from '@/components/sound/amplifier-tool/types';
import type {
  RackDesignerAmp,
  RackDesignerBlock,
  RackDesignerLayout,
} from '@/components/sound/amplifier-tool/rack-designer/types';
import {
  BLOCK_HEADER_HEIGHT,
  BLOCK_WIDTH,
  AMP_CELL_HEIGHT,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  DEFAULT_IP_BASE,
  DEFAULT_LAYOUT_TITLE,
  RACK_COLOR_PALETTE,
  assignSequentialIps,
  computeResultsFingerprint,
  createEmptyRackDesignerLayout,
  generateLayoutFromResults,
  isValidIp,
  loadStoredLayout,
  makeDesignerId,
  saveStoredLayout,
} from '@/components/sound/amplifier-tool/rack-designer/layout-utils';
import { RackBlockCard } from '@/components/sound/amplifier-tool/rack-designer/RackBlockCard';
import { SoundvisionFlysheetButton } from '@/components/sound/amplifier-tool/rack-designer/SoundvisionFlysheetButton';
import { BlockEditorPanel } from '@/components/sound/amplifier-tool/rack-designer/BlockEditorPanel';
import { AmpEditFields } from '@/components/sound/amplifier-tool/rack-designer/AmpEditFields';
import { useCanvasZoom } from '@/components/sound/amplifier-tool/rack-designer/useCanvasZoom';
import {
  isLaSessionFileName,
  nwmMapToLayout,
  type NwmMap,
} from '@/components/sound/amplifier-tool/rack-designer/nwm-import';
import { supabase } from '@/integrations/supabase/client';

const MADRID_TZ = 'Europe/Madrid';

/** Reads a File as a base64 string (no data: prefix). */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}

export interface AmpRackDesignerProps {
  results?: AmplifierResults;
  jobId?: string;
  tourId?: string;
  standalone?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
  storageScope?: string;
}

interface AmpTarget {
  blockId: string;
  ampId: string;
}

export function AmpRackDesigner({
  results,
  jobId,
  tourId,
  standalone = false,
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
  storageScope,
}: AmpRackDesignerProps) {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [internalOpen, setInternalOpen] = useState(false);
  const [layout, setLayout] = useState<RackDesignerLayout | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [ampTarget, setAmpTarget] = useState<AmpTarget | null>(null);
  const [mobileBlockEditorOpen, setMobileBlockEditorOpen] = useState(false);
  const [baseIp, setBaseIp] = useState(DEFAULT_IP_BASE);
  const [includeRackLabels, setIncludeRackLabels] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const nwmInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (nextOpen: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };
  const { zoom, zoomIn, zoomOut, fitToView, pinchActiveRef, scrollRef } = useCanvasZoom({
    enabled: open,
    contentWidth: CANVAS_WIDTH,
    contentHeight: CANVAS_HEIGHT,
  });

  const scope =
    storageScope ?? (standalone ? 'sound-session-rack-designer' : jobId ?? tourId ?? 'standalone');

  useEffect(() => {
    if (!open) return;
    const stored = loadStoredLayout(scope);
    if (!results) {
      setLayout(stored ?? createEmptyRackDesignerLayout());
      setSelectedBlockId(null);
      setAmpTarget(null);
      setMobileBlockEditorOpen(false);
      return;
    }
    // A calculator layout is only reused when it came from the same calculation;
    // otherwise it would silently contradict the results summary next to it.
    const fingerprint = computeResultsFingerprint(results);
    setLayout(
      stored && stored.resultsFingerprint === fingerprint
        ? stored
        : generateLayoutFromResults(results, stored?.title ?? DEFAULT_LAYOUT_TITLE),
    );
    setSelectedBlockId(null);
    setAmpTarget(null);
    setMobileBlockEditorOpen(false);
  }, [open, scope, results]);

  useEffect(() => {
    if (open) return;
    dragDepthRef.current = 0;
    setIsDraggingFile(false);
  }, [open]);

  // On phones start zoomed out so the whole plan is visible; pinch in from there.
  useEffect(() => {
    if (!open || !isMobile) return;
    const frame = requestAnimationFrame(() => fitToView());
    return () => cancelAnimationFrame(frame);
  }, [open, isMobile, fitToView]);

  useEffect(() => {
    if (open && layout) saveStoredLayout(scope, layout);
  }, [open, scope, layout]);

  const selectedBlock = useMemo(
    () => layout?.blocks.find((block) => block.id === selectedBlockId) ?? null,
    [layout, selectedBlockId],
  );

  const targetedAmp = useMemo(() => {
    if (!layout || !ampTarget) return null;
    const block = layout.blocks.find((candidate) => candidate.id === ampTarget.blockId);
    const amp = block?.amps.find((candidate) => candidate.id === ampTarget.ampId);
    if (!block || !amp) return null;
    return { block, amp, ampIndex: block.amps.indexOf(amp) };
  }, [layout, ampTarget]);

  const updateBlock = (next: RackDesignerBlock) => {
    setLayout((prev) =>
      prev
        ? { ...prev, blocks: prev.blocks.map((block) => (block.id === next.id ? next : block)) }
        : prev,
    );
  };

  const updateAmp = (blockId: string, ampId: string, patch: Partial<RackDesignerAmp>) => {
    setLayout((prev) =>
      prev
        ? {
            ...prev,
            blocks: prev.blocks.map((block) =>
              block.id === blockId
                ? {
                    ...block,
                    amps: block.amps.map((amp) => (amp.id === ampId ? { ...amp, ...patch } : amp)),
                  }
                : block,
            ),
          }
        : prev,
    );
  };

  const moveBlock = (id: string, x: number, y: number) => {
    setLayout((prev) =>
      prev
        ? { ...prev, blocks: prev.blocks.map((block) => (block.id === id ? { ...block, x, y } : block)) }
        : prev,
    );
  };

  const deleteBlock = (id: string) => {
    setLayout((prev) =>
      prev ? { ...prev, blocks: prev.blocks.filter((block) => block.id !== id) } : prev,
    );
    setSelectedBlockId((current) => (current === id ? null : current));
    setAmpTarget((current) => (current?.blockId === id ? null : current));
    setMobileBlockEditorOpen(false);
  };

  // Blocks are built outside the setLayout updaters so the updaters stay pure —
  // React may invoke them more than once (e.g. StrictMode).
  const duplicateBlock = (id: string) => {
    const source = layout?.blocks.find((block) => block.id === id);
    if (!source) return;
    const copy: RackDesignerBlock = {
      ...source,
      id: makeDesignerId(),
      label: `${source.label} (copia)`,
      x: Math.min(source.x + 20, CANVAS_WIDTH - 200),
      y: Math.min(source.y + 20, CANVAS_HEIGHT - 100),
      amps: source.amps.map((amp) => ({ ...amp, id: makeDesignerId() })),
    };
    setLayout((prev) => (prev ? { ...prev, blocks: [...prev.blocks, copy] } : prev));
    setSelectedBlockId(copy.id);
  };

  const addBlock = () => {
    if (!layout) return;
    const block: RackDesignerBlock = {
      id: makeDesignerId(),
      label: `RACK ${layout.blocks.length + 1}`,
      color: RACK_COLOR_PALETTE[7].value,
      x: 40,
      y: 40,
      amps: [{ id: makeDesignerId(), presetName: 'PRESET', ip: DEFAULT_IP_BASE, model: 'LA12X' }],
    };
    setLayout((prev) => (prev ? { ...prev, blocks: [...prev.blocks, block] } : prev));
    setSelectedBlockId(block.id);
  };

  const regenerate = () => {
    if (!results) return;
    setLayout(generateLayoutFromResults(results, layout?.title ?? DEFAULT_LAYOUT_TITLE));
    setSelectedBlockId(null);
    setAmpTarget(null);
    toast({
      title: 'Diseño regenerado',
      description: 'Los racks se han vuelto a generar desde el cálculo actual.',
    });
  };

  const autoAssignIps = () => {
    if (!isValidIp(baseIp)) {
      toast({
        title: 'IP no válida',
        description: 'Introduce una dirección IP inicial válida (p. ej. 192.168.1.11).',
        variant: 'destructive',
      });
      return;
    }
    setLayout((prev) =>
      prev ? { ...prev, blocks: assignSequentialIps(prev.blocks, baseIp) } : prev,
    );
    toast({
      title: 'IPs asignadas',
      description: `IPs secuenciales asignadas a partir de ${baseIp}.`,
    });
  };

  const parseLaSessionFile = async (file: File): Promise<NwmMap> => {
    const base64 = await fileToBase64(file);
    const { data, error } = await supabase.functions.invoke('parse-la-session', {
      body: { file: base64, fileName: file.name },
    });
    if (error) throw error;
    const map = (data as { map?: NwmMap } | null)?.map;
    if (!map) throw new Error('No se pudo interpretar el archivo de L-Acoustics.');
    return map;
  };

  const importSession = async (file: File) => {
    if (isImporting) return;
    if (!isLaSessionFileName(file.name)) {
      toast({
        title: 'Archivo no compatible',
        description: 'Selecciona una sesión de Network Manager (.nwm) o Soundvision (.xmlp).',
        variant: 'destructive',
      });
      return;
    }
    setIsImporting(true);
    try {
      const map = await parseLaSessionFile(file);
      if (!map.units?.length) throw new Error('La sesión no contiene amplificadores.');
      setLayout(nwmMapToLayout(map, results ? computeResultsFingerprint(results) : undefined));
      setSelectedBlockId(null);
      setAmpTarget(null);
      toast({
        title: 'Sesión importada',
        description: `${map.units.length} amplificadores cargados desde ${file.name}.`,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'No se pudo importar el archivo de NM/SV.';
      toast({ title: 'Error al importar', description: message, variant: 'destructive' });
    } finally {
      setIsImporting(false);
    }
  };

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!event.dataTransfer.types.includes('Files')) return;
    dragDepthRef.current += 1;
    setIsDraggingFile(true);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDraggingFile(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepthRef.current = 0;
    setIsDraggingFile(false);
    const file = event.dataTransfer.files[0];
    if (file) void importSession(file);
  };

  const exportPdf = async () => {
    if (!layout) return;
    setIsExporting(true);
    try {
      const blob = await generateAmpRackLayoutPdf(layout, { includeRackLabels });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `distribucion-amplificadores-${formatInTimeZone(new Date(), MADRID_TZ, 'yyyy-MM-dd')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: 'PDF generado', description: 'El PDF se ha descargado correctamente.' });
    } catch (error) {
      console.error('Error generating rack layout PDF:', error);
      toast({
        title: 'Error',
        description: 'No se pudo generar el PDF. Inténtalo de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleBlockTap = (blockId: string, ampId: string | null) => {
    if (ampId) {
      setAmpTarget({ blockId, ampId });
      setMobileBlockEditorOpen(false);
    } else {
      setAmpTarget(null);
      if (isMobile) setMobileBlockEditorOpen(true);
    }
  };

  const clearCanvasSelection = () => {
    setSelectedBlockId(null);
    setAmpTarget(null);
  };

  const blockEditor = selectedBlock ? (
    <BlockEditorPanel
      key={selectedBlock.id}
      block={selectedBlock}
      onChange={updateBlock}
      onDuplicate={duplicateBlock}
      onDelete={deleteBlock}
    />
  ) : null;

  return (
    <>
      {!hideTrigger && (
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
          <Network className="h-4 w-4" />
          Diseñador de racks
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-dvh max-h-dvh w-screen max-w-none flex-col gap-2 rounded-none p-3 md:h-[92vh] md:max-h-[92vh] md:w-[96vw] md:max-w-[1400px] md:gap-3 md:rounded-lg md:p-4">
          <DialogHeader className="space-y-0.5 text-left">
            <DialogTitle>
              {standalone ? 'Diseñador NM/SV de racks' : 'Diseñador visual de racks'}
            </DialogTitle>
            <DialogDescription className="hidden md:block">
              {standalone
                ? 'Suelta una sesión .nwm o .xmlp, ajusta los racks y exporta el plano a PDF.'
                : 'Arrastra los racks para posicionarlos, edita presets, colores e IPs y exporta el plano a PDF.'}
            </DialogDescription>
            <DialogDescription className="md:hidden">
              {standalone
                ? 'Importa una sesión NM/SV, edita los racks y exporta el plano a PDF.'
                : 'Toca un amplificador para editar su IP y preset; toca la cabecera para editar el rack.'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap items-end gap-1.5 md:gap-2">
            <div className="space-y-1">
              <Label htmlFor="layout-title" className="text-xs">Título del plano</Label>
              <Input
                id="layout-title"
                value={layout?.title ?? ''}
                onChange={(event) =>
                  setLayout((prev) => (prev ? { ...prev, title: event.target.value } : prev))
                }
                placeholder={DEFAULT_LAYOUT_TITLE}
                className="h-8 w-36 font-semibold md:w-48"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="global-base-ip" className="text-xs">IP inicial</Label>
              <Input
                id="global-base-ip"
                value={baseIp}
                onChange={(event) => setBaseIp(event.target.value)}
                placeholder={DEFAULT_IP_BASE}
                inputMode="decimal"
                className={cn('h-8 w-32 font-mono text-xs md:w-36', !isValidIp(baseIp) && 'border-destructive')}
              />
            </div>
            <Button type="button" variant="secondary" size="sm" className="gap-1" onClick={autoAssignIps}>
              <Wand2 className="h-3.5 w-3.5" />
              Auto-IP
            </Button>
            <Button type="button" variant="outline" size="sm" className="gap-1" onClick={addBlock}>
              <Plus className="h-3.5 w-3.5" />
              Añadir rack
            </Button>
            <input
              ref={nwmInputRef}
              type="file"
              accept=".nwm,.xmlp"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) void importSession(file);
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1"
              disabled={isImporting}
              onClick={() => nwmInputRef.current?.click()}
              title="Importar sesión de L-Acoustics: Network Manager (.nwm) o Soundvision (.xmlp)"
            >
              <Upload className="h-3.5 w-3.5" />
              {isImporting ? 'Importando…' : 'Importar NM/SV'}
            </Button>
            <SoundvisionFlysheetButton parseSessionFile={parseLaSessionFile} />
            {results && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className="gap-1">
                    <RefreshCw className="h-3.5 w-3.5" />
                    Regenerar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Regenerar el diseño?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Se descartarán los cambios manuales (posiciones, colores, presets e IPs) y los
                      racks se volverán a generar desde el cálculo actual.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={regenerate}>Regenerar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <div className="flex h-8 items-center gap-1.5">
              <Checkbox
                id="include-rack-labels"
                checked={includeRackLabels}
                onCheckedChange={(checked) => setIncludeRackLabels(checked === true)}
              />
              <Label htmlFor="include-rack-labels" className="text-xs">Nombres de rack en PDF</Label>
            </div>
            <Button
              type="button"
              size="sm"
              className="ml-auto gap-1"
              onClick={exportPdf}
              disabled={isExporting || !layout?.blocks.length}
            >
              <FileText className="h-3.5 w-3.5" />
              {isExporting ? 'Generando…' : 'Exportar PDF'}
            </Button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-3 md:flex-row">
            <div
              className={cn(
                'relative min-h-[240px] flex-1 rounded-md transition-shadow',
                isDraggingFile && 'ring-2 ring-primary ring-offset-2',
              )}
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div
                ref={scrollRef}
                className="absolute inset-0 overflow-auto rounded-md border bg-muted/20"
                style={{ touchAction: 'pan-x pan-y' }}
                onPointerDown={clearCanvasSelection}
              >
                <div
                  className="relative"
                  style={{ width: CANVAS_WIDTH * zoom, height: CANVAS_HEIGHT * zoom }}
                >
                  <div
                    className="relative origin-top-left"
                    style={{
                      width: CANVAS_WIDTH,
                      height: CANVAS_HEIGHT,
                      transform: `scale(${zoom})`,
                      backgroundImage:
                        'linear-gradient(to right, hsl(var(--border) / 0.35) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border) / 0.35) 1px, transparent 1px)',
                      backgroundSize: '50px 50px',
                    }}
                  >
                    {layout?.blocks.map((block) => (
                      <RackBlockCard
                        key={block.id}
                        block={block}
                        selected={block.id === selectedBlockId}
                        zoom={zoom}
                        pinchActiveRef={pinchActiveRef}
                        onSelect={setSelectedBlockId}
                        onMove={moveBlock}
                        onTap={handleBlockTap}
                      />
                    ))}
                  </div>

                  {/* Unscaled layer so the editor card stays readable at any zoom. */}
                  {!isMobile && targetedAmp && (
                    <div
                      className="absolute z-20 w-60 rounded-md border bg-background p-3 shadow-lg"
                      style={{
                        left: Math.max(
                          0,
                          Math.min(
                            (targetedAmp.block.x + BLOCK_WIDTH) * zoom + 10,
                            CANVAS_WIDTH * zoom - 250,
                          ),
                        ),
                        top: Math.max(
                          0,
                          Math.min(
                            (targetedAmp.block.y +
                              BLOCK_HEADER_HEIGHT +
                              targetedAmp.ampIndex * AMP_CELL_HEIGHT) * zoom,
                            CANVAS_HEIGHT * zoom - 190,
                          ),
                        ),
                      }}
                      onPointerDown={(event) => event.stopPropagation()}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-semibold">Editar amplificador</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => setAmpTarget(null)}
                          aria-label="Cerrar editor de amplificador"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <AmpEditFields
                        amp={targetedAmp.amp}
                        autoFocusIp
                        onChange={(patch) => updateAmp(targetedAmp.block.id, targetedAmp.amp.id, patch)}
                      />
                    </div>
                  )}
                </div>
              </div>

              {standalone && !layout?.blocks.length && (
                <button
                  type="button"
                  className={cn(
                    'absolute inset-4 z-10 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed bg-background/90 px-6 text-center transition-colors',
                    isDraggingFile
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-muted-foreground/30 hover:border-primary/60 hover:bg-muted/60',
                  )}
                  onClick={() => nwmInputRef.current?.click()}
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  <UploadCloud className="h-10 w-10" />
                  <span className="font-semibold">Suelta aquí una sesión NM o Soundvision</span>
                  <span className="text-sm text-muted-foreground">
                    o pulsa para seleccionar un archivo .nwm o .xmlp
                  </span>
                </button>
              )}

              {isDraggingFile && !!layout?.blocks.length && (
                <div className="pointer-events-none absolute inset-4 z-30 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-background/90 text-center text-sm font-semibold text-primary shadow-lg">
                  Suelta el archivo para reemplazar el diseño actual
                </div>
              )}

              <div className="absolute bottom-2 right-2 z-20 flex items-center gap-0.5 rounded-md border bg-background/95 p-0.5 shadow-sm">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={zoomOut}
                  aria-label="Alejar"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </Button>
                <button
                  type="button"
                  className="w-11 text-center text-xs tabular-nums text-muted-foreground hover:text-foreground"
                  onClick={fitToView}
                  title="Ajustar a la vista"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={zoomIn}
                  aria-label="Acercar"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="hidden shrink-0 overflow-y-auto rounded-md border p-3 md:block md:w-80">
              {blockEditor ?? (
                <p className="text-sm text-muted-foreground">
                  Selecciona un rack en el lienzo para editar su nombre, color, presets e IPs. Haz
                  clic en un amplificador para editar su IP y preset directamente.
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Sheet
        open={isMobile && !!targetedAmp}
        onOpenChange={(sheetOpen) => {
          if (!sheetOpen) setAmpTarget(null);
        }}
      >
        <SheetContent side="bottom" className="rounded-t-lg">
          <SheetHeader className="pb-2 text-left">
            <SheetTitle>Editar amplificador</SheetTitle>
          </SheetHeader>
          <div className="pb-4">
            {targetedAmp && (
              <AmpEditFields
                amp={targetedAmp.amp}
                onChange={(patch) => updateAmp(targetedAmp.block.id, targetedAmp.amp.id, patch)}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet
        open={isMobile && mobileBlockEditorOpen && !!selectedBlock}
        onOpenChange={setMobileBlockEditorOpen}
      >
        <SheetContent side="bottom" className="rounded-t-lg">
          <SheetHeader className="pb-2 text-left">
            <SheetTitle>Editar rack</SheetTitle>
          </SheetHeader>
          <div className="max-h-[65dvh] overflow-y-auto pb-4">{blockEditor}</div>
        </SheetContent>
      </Sheet>
    </>
  );
}
