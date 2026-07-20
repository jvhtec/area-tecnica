import { useEffect, useMemo, useState, type MouseEventHandler } from 'react';
import { AlertTriangle, Loader2, Plus, RefreshCw, Send } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  buildXmlpFlexExportPlan,
  type XmlpFlexCandidate,
  type XmlpEquipmentRow,
  type XmlpFlexExportPlan,
} from '@/features/technical-tools/flex/xmlpFlexExportPlan';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  getJobFlexEquipmentTargets,
  pushEquipmentToFlexDocumentStrict,
  type FlexEquipmentDocumentType,
  type JobFlexEquipmentTarget,
  type StrictGroupedPushResult,
} from '@/services/flexPullsheets';
import {
  extractFlexElementId,
  extractFlexEquipmentDocumentType,
} from '@/utils/flexUrlParser';

import type { ImportedLaSession } from './importedLaSession';
import { XmlpFlexPlanPreview } from './XmlpFlexPlanPreview';

interface XmlpFlexExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: ImportedLaSession;
  onCreateFlexTarget?: MouseEventHandler<HTMLButtonElement>;
}

interface XmlpFlexPushOutcome extends StrictGroupedPushResult {
  skippedUnmappedItems: XmlpFlexCandidate[];
  skippedAmbiguousItems: XmlpFlexCandidate[];
}

export function XmlpFlexExportDialog({
  open,
  onOpenChange,
  session,
  onCreateFlexTarget,
}: XmlpFlexExportDialogProps) {
  const { toast } = useToast();
  const [plan, setPlan] = useState<XmlpFlexExportPlan | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [targets, setTargets] = useState<JobFlexEquipmentTarget[]>([]);
  const [selectedTargetKey, setSelectedTargetKey] = useState('');
  const [targetMode, setTargetMode] = useState<'job' | 'url'>(session.jobId ? 'job' : 'url');
  const [url, setUrl] = useState('');
  const [urlDocumentType, setUrlDocumentType] = useState<FlexEquipmentDocumentType>('pullsheet');
  const [confirmedAdditive, setConfirmedAdditive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshingTargets, setIsRefreshingTargets] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [result, setResult] = useState<XmlpFlexPushOutcome | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setIsLoading(true);
    setPlan(null);
    setResult(null);
    setConfirmedAdditive(false);
    Promise.all([
      supabase.from('equipment').select('id, name, department, category, resource_id').limit(1000),
      session.jobId ? getJobFlexEquipmentTargets(session.jobId) : Promise.resolve([]),
    ])
      .then(([equipmentResult, discoveredTargets]) => {
        if (!active) return;
        if (equipmentResult.error) throw equipmentResult.error;
        const nextPlan = buildXmlpFlexExportPlan(
          session.map,
          (equipmentResult.data ?? []) as XmlpEquipmentRow[],
        );
        setPlan(nextPlan);
        setSelectedIds(new Set(
          nextPlan.groups.flatMap((group) =>
            group.items
              .filter((item) => item.mappingStatus === 'mapped')
              .map((item) => item.id),
          ),
        ));
        setTargets(discoveredTargets);
        if (discoveredTargets.length === 1) {
          setSelectedTargetKey(`${discoveredTargets[0].document_type}:${discoveredTargets[0].element_id}`);
        }
      })
      .catch((error) => {
        if (!active) return;
        toast({
          title: 'No se pudo preparar el envío',
          description: error instanceof Error ? error.message : 'Error al resolver el paquete XMLP.',
          variant: 'destructive',
        });
      })
      .finally(() => active && setIsLoading(false));
    return () => { active = false; };
  }, [open, session, toast]);

  useEffect(() => {
    const detected = extractFlexEquipmentDocumentType(url);
    if (detected) setUrlDocumentType(detected);
  }, [url]);

  const selectedCandidates = useMemo(
    () => plan?.groups.flatMap((group) => group.items).filter(
      (item) => selectedIds.has(item.id) && item.mappingStatus === 'mapped' && item.resourceId,
    ) ?? [],
    [plan, selectedIds],
  );
  const allCandidates = plan
    ? [...plan.groups.flatMap((group) => group.items), ...plan.unassignedItems]
    : [];
  const mapped = allCandidates.filter((item) => item.mappingStatus === 'mapped' && item.flexCategoryKey);
  const unmapped = allCandidates.filter(
    (item) => item.mappingStatus === 'missing-equipment' || item.mappingStatus === 'missing-resource-id',
  );
  const ambiguous = allCandidates.filter((item) => item.mappingStatus === 'ambiguous');
  const selectedQuantity = selectedCandidates.reduce((sum, item) => sum + item.quantity, 0);
  const urlElementId = extractFlexElementId(url);
  const selectedJobTarget = targets.find(
    (target) => `${target.document_type}:${target.element_id}` === selectedTargetKey,
  );
  const target = targetMode === 'job' && selectedJobTarget
    ? { elementId: selectedJobTarget.element_id, documentType: selectedJobTarget.document_type }
    : targetMode === 'url' && urlElementId
      ? { elementId: urlElementId, documentType: urlDocumentType }
      : null;

  const handleRefreshTargets = async () => {
    if (!session.jobId || isRefreshingTargets) return;
    setIsRefreshingTargets(true);
    try {
      const discoveredTargets = await getJobFlexEquipmentTargets(session.jobId);
      setTargets(discoveredTargets);
      setSelectedTargetKey((current) => {
        if (discoveredTargets.some(
          (item) => `${item.document_type}:${item.element_id}` === current,
        )) return current;
        return discoveredTargets.length === 1
          ? `${discoveredTargets[0].document_type}:${discoveredTargets[0].element_id}`
          : '';
      });
      if (discoveredTargets.length > 0) setTargetMode('job');
      toast({
        title: 'Documentos Flex actualizados',
        description: discoveredTargets.length > 0
          ? discoveredTargets.length === 1
            ? '1 destino disponible.'
            : `${discoveredTargets.length} destinos disponibles.`
          : 'Todavía no hay Pull Sheets ni Presupuestos disponibles para este trabajo.',
      });
    } catch (error) {
      toast({
        title: 'No se pudieron actualizar los documentos',
        description: error instanceof Error ? error.message : 'Error consultando Flex.',
        variant: 'destructive',
      });
    } finally {
      setIsRefreshingTargets(false);
    }
  };

  const handlePush = async () => {
    if (!target || selectedCandidates.length === 0 || !confirmedAdditive) return;
    setIsPushing(true);
    setResult(null);
    try {
      const pushed = await pushEquipmentToFlexDocumentStrict(
        target,
        selectedCandidates.map((item) => ({
          resourceId: item.resourceId!,
          quantity: item.quantity,
          name: item.displayName,
          flexCategoryKey: item.flexCategoryKey!,
        })),
      );
      setResult({
        ...pushed,
        skippedUnmappedItems: unmapped,
        skippedAmbiguousItems: ambiguous,
      });
      const failed = pushed.groupsFailed.length + pushed.failedChildItems.length;
      toast({
        title: failed === 0 ? 'Paquete enviado a Flex' : 'Envío parcial a Flex',
        description: `${pushed.equipmentLinesAdded} líneas y ${pushed.totalQuantitiesRepresented} unidades añadidas.`,
        variant: pushed.equipmentLinesAdded === 0 ? 'destructive' : 'default',
      });
    } catch (error) {
      toast({
        title: 'Error al enviar a Flex',
        description: error instanceof Error ? error.message : 'El envío no pudo completarse.',
        variant: 'destructive',
      });
    } finally {
      setIsPushing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-5xl flex-col">
        <DialogHeader>
          <DialogTitle>Enviar paquete XMLP a Flex</DialogTitle>
          <DialogDescription>
            Revisa el paquete de {session.sourceFileName}; solo se enviarán líneas mapeadas y seleccionadas.
          </DialogDescription>
        </DialogHeader>

        {isLoading && <div className="flex items-center gap-2 py-8"><Loader2 className="h-4 w-4 animate-spin" /> Preparando vista previa…</div>}
        {plan && (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            <div className="flex flex-wrap gap-2">
              <Badge>{mapped.length} líneas mapeadas</Badge>
              <Badge variant="secondary">{mapped.reduce((sum, item) => sum + item.quantity, 0)} unidades mapeadas</Badge>
              <Badge variant="destructive">{unmapped.length} sin mapear</Badge>
              <Badge variant="outline">{ambiguous.length} ambiguas</Badge>
              <Badge variant="outline">{allCandidates.length - selectedCandidates.length} excluidas</Badge>
              <Badge variant="outline">{plan.warnings.length} avisos</Badge>
            </div>

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Envío aditivo</AlertTitle>
              <AlertDescription>
                Flex no ofrece aquí una lectura fiable para reconciliar líneas y anidación existentes. Repetir el envío puede duplicar cantidades.
              </AlertDescription>
            </Alert>

            <XmlpFlexPlanPreview plan={plan} selectedIds={selectedIds} onSelectedIdsChange={setSelectedIds} />

            <Tabs value={targetMode} onValueChange={(value) => setTargetMode(value as 'job' | 'url')}>
              <TabsList>
                <TabsTrigger value="job" disabled={!session.jobId}>Documentos del trabajo</TabsTrigger>
                <TabsTrigger value="url">URL de Flex</TabsTrigger>
              </TabsList>
              <TabsContent value="job" className="space-y-2">
                <Label>Pull Sheet o Presupuesto</Label>
                <Select value={selectedTargetKey} onValueChange={setSelectedTargetKey}>
                  <SelectTrigger><SelectValue placeholder="Selecciona un documento" /></SelectTrigger>
                  <SelectContent>
                    {targets.map((item) => (
                      <SelectItem key={`${item.document_type}:${item.element_id}`} value={`${item.document_type}:${item.element_id}`}>
                        {item.document_type === 'pullsheet' ? 'Pull Sheet' : 'Presupuesto'} · {item.display_name ?? item.department ?? item.element_id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex flex-wrap gap-2">
                  {onCreateFlexTarget && (
                    <Button type="button" variant="outline" size="sm" onClick={onCreateFlexTarget}>
                      <Plus className="mr-2 h-4 w-4" />
                      Crear documento Flex
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isRefreshingTargets}
                    onClick={() => void handleRefreshTargets()}
                  >
                    {isRefreshingTargets
                      ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      : <RefreshCw className="mr-2 h-4 w-4" />}
                    Actualizar documentos
                  </Button>
                </div>
                {onCreateFlexTarget && (
                  <p className="text-xs text-muted-foreground">
                    “Crear documento Flex” abre el selector de carpetas del trabajo. Al terminar, vuelve aquí y actualiza la lista.
                  </p>
                )}
              </TabsContent>
              <TabsContent value="url" className="space-y-2">
                <Label htmlFor="xmlp-flex-url">URL de Pull Sheet o Presupuesto</Label>
                <Input id="xmlp-flex-url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://…#equipment-list/… o #fin-doc/…" />
                <Select value={urlDocumentType} onValueChange={(value) => setUrlDocumentType(value as FlexEquipmentDocumentType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pullsheet">Pull Sheet</SelectItem>
                    <SelectItem value="presupuesto">Presupuesto</SelectItem>
                  </SelectContent>
                </Select>
                {url && !urlElementId && <p className="text-sm text-destructive">La URL no contiene un ID Flex válido.</p>}
              </TabsContent>
            </Tabs>

            <div className="flex items-start gap-2 rounded-md border p-3">
              <Checkbox id="confirm-additive" checked={confirmedAdditive} onCheckedChange={(value) => setConfirmedAdditive(value === true)} />
              <Label htmlFor="confirm-additive" className="leading-5">
                Entiendo que el envío es aditivo, que las líneas sin mapear se omitirán y que solo se enviarán las {selectedCandidates.length} líneas seleccionadas ({selectedQuantity} unidades).
              </Label>
            </div>

            {result && (
              <Alert variant={result.equipmentLinesAdded === 0 ? 'destructive' : 'default'}>
                <Send className="h-4 w-4" />
                <AlertTitle>
                  {result.equipmentLinesAdded === 0 && result.groupsFailed.length > 0
                    ? 'Fallo de cabecera'
                    : result.equipmentLinesAdded === 0
                      ? 'No se añadió equipo'
                      : result.groupsFailed.length > 0 || result.failedChildItems.length > 0
                        ? 'Envío parcial'
                        : 'Envío completo'}
                </AlertTitle>
                <AlertDescription>
                  {result.groupsCreated.length} grupos creados; {result.equipmentLinesAdded} líneas añadidas; {result.groupsFailed.length} grupos fallidos; {result.failedChildItems.length} líneas hijas fallidas; {result.childrenSkippedBecauseParentFailed.length} hijas omitidas por fallo de cabecera; {result.skippedUnmappedItems.length} sin mapear omitidas; {result.skippedAmbiguousItems.length} ambiguas omitidas.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPushing}>Cerrar</Button>
          <Button onClick={() => void handlePush()} disabled={!target || selectedCandidates.length === 0 || !confirmedAdditive || isPushing}>
            {isPushing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Enviar seleccionados a Flex
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
