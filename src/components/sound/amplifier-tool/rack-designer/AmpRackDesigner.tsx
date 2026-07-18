import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { FileText, Network, Plus, RefreshCw, Wand2, X } from 'lucide-react';
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
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { generateAmpRackLayoutPdf } from '@/utils/amplifierRackLayoutPdf';
import type { AmplifierResults } from '../types';
import type { RackDesignerAmp, RackDesignerBlock, RackDesignerLayout } from './types';
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
  generateLayoutFromResults,
  isValidIp,
  loadStoredLayout,
  makeDesignerId,
  saveStoredLayout,
} from './layout-utils';
import { RackBlockCard } from './RackBlockCard';
import { BlockEditorPanel } from './BlockEditorPanel';
import { AmpEditFields } from './AmpEditFields';

export interface AmpRackDesignerProps {
  results: AmplifierResults;
  jobId?: string;
  tourId?: string;
}

interface AmpTarget {
  blockId: string;
  ampId: string;
}

export function AmpRackDesigner({ results, jobId, tourId }: AmpRackDesignerProps) {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [layout, setLayout] = useState<RackDesignerLayout | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [ampTarget, setAmpTarget] = useState<AmpTarget | null>(null);
  const [mobileBlockEditorOpen, setMobileBlockEditorOpen] = useState(false);
  const [baseIp, setBaseIp] = useState(DEFAULT_IP_BASE);
  const [includeRackLabels, setIncludeRackLabels] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const scope = jobId ?? tourId ?? 'standalone';

  useEffect(() => {
    if (!open) return;
    setLayout(loadStoredLayout(scope) ?? generateLayoutFromResults(results));
    setSelectedBlockId(null);
    setAmpTarget(null);
    setMobileBlockEditorOpen(false);
  }, [open, scope, results]);

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

  const duplicateBlock = (id: string) => {
    setLayout((prev) => {
      if (!prev) return prev;
      const source = prev.blocks.find((block) => block.id === id);
      if (!source) return prev;
      const copy: RackDesignerBlock = {
        ...source,
        id: makeDesignerId(),
        label: `${source.label} (copia)`,
        x: Math.min(source.x + 20, CANVAS_WIDTH - 200),
        y: Math.min(source.y + 20, CANVAS_HEIGHT - 100),
        amps: source.amps.map((amp) => ({ ...amp, id: makeDesignerId() })),
      };
      setSelectedBlockId(copy.id);
      return { ...prev, blocks: [...prev.blocks, copy] };
    });
  };

  const addBlock = () => {
    setLayout((prev) => {
      if (!prev) return prev;
      const block: RackDesignerBlock = {
        id: makeDesignerId(),
        label: `RACK ${prev.blocks.length + 1}`,
        color: RACK_COLOR_PALETTE[7].value,
        x: 40,
        y: 40,
        amps: [{ id: makeDesignerId(), presetName: 'PRESET', ip: DEFAULT_IP_BASE, model: 'LA12X' }],
      };
      setSelectedBlockId(block.id);
      return { ...prev, blocks: [...prev.blocks, block] };
    });
  };

  const regenerate = () => {
    setLayout((prev) => generateLayoutFromResults(results, prev?.title ?? DEFAULT_LAYOUT_TITLE));
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

  const exportPdf = async () => {
    if (!layout) return;
    setIsExporting(true);
    try {
      const blob = await generateAmpRackLayoutPdf(layout, { includeRackLabels });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `distribucion-amplificadores-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
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
      <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <Network className="h-4 w-4" />
        Diseñador de racks
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-dvh max-h-dvh w-screen max-w-none flex-col gap-2 rounded-none p-3 md:h-[92vh] md:max-h-[92vh] md:w-[96vw] md:max-w-[1400px] md:gap-3 md:rounded-lg md:p-4">
          <DialogHeader className="space-y-0.5 text-left">
            <DialogTitle>Diseñador visual de racks</DialogTitle>
            <DialogDescription className="hidden md:block">
              Arrastra los racks para posicionarlos, edita presets, colores e IPs y exporta el plano a PDF.
            </DialogDescription>
            <DialogDescription className="md:hidden">
              Toca un amplificador para editar su IP y preset; toca la cabecera para editar el rack.
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
            <div className="flex h-8 items-center gap-1.5">
              <Checkbox
                id="include-rack-labels"
                checked={includeRackLabels}
                onCheckedChange={(checked) => setIncludeRackLabels(checked === true)}
              />
              <Label htmlFor="include-rack-labels" className="text-xs">Nombres de rack en PDF</Label>
            </div>
            <Button type="button" size="sm" className="ml-auto gap-1" onClick={exportPdf} disabled={isExporting || !layout}>
              <FileText className="h-3.5 w-3.5" />
              {isExporting ? 'Generando…' : 'Exportar PDF'}
            </Button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-3 md:flex-row">
            <div
              className="relative min-h-[240px] flex-1 overflow-auto rounded-md border bg-muted/20"
              onPointerDown={clearCanvasSelection}
            >
              <div
                className="relative"
                style={{
                  width: CANVAS_WIDTH,
                  height: CANVAS_HEIGHT,
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
                    onSelect={setSelectedBlockId}
                    onMove={moveBlock}
                    onTap={handleBlockTap}
                  />
                ))}

                {!isMobile && targetedAmp && (
                  <div
                    className="absolute z-20 w-60 rounded-md border bg-background p-3 shadow-lg"
                    style={{
                      left: Math.min(targetedAmp.block.x + BLOCK_WIDTH + 10, CANVAS_WIDTH - 250),
                      top: Math.min(
                        targetedAmp.block.y + BLOCK_HEADER_HEIGHT + targetedAmp.ampIndex * AMP_CELL_HEIGHT,
                        CANVAS_HEIGHT - 190,
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

      <Drawer
        open={isMobile && !!targetedAmp}
        onOpenChange={(drawerOpen) => {
          if (!drawerOpen) setAmpTarget(null);
        }}
      >
        <DrawerContent>
          <DrawerHeader className="pb-2 text-left">
            <DrawerTitle>Editar amplificador</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-8">
            {targetedAmp && (
              <AmpEditFields
                amp={targetedAmp.amp}
                onChange={(patch) => updateAmp(targetedAmp.block.id, targetedAmp.amp.id, patch)}
              />
            )}
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer
        open={isMobile && mobileBlockEditorOpen && !!selectedBlock}
        onOpenChange={setMobileBlockEditorOpen}
      >
        <DrawerContent>
          <DrawerHeader className="pb-2 text-left">
            <DrawerTitle>Editar rack</DrawerTitle>
          </DrawerHeader>
          <div className="max-h-[65dvh] overflow-y-auto px-4 pb-8">{blockEditor}</div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
