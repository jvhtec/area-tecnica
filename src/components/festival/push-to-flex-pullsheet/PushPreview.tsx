import { AlertTriangle, CheckCircle2, Loader2, XCircle } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import type { EquipmentItem } from '@/services/flexPullsheets';
import type { EquipmentLookupResult } from './model';

interface PushPreviewProps {
  isLookingUp: boolean;
  equipmentToPush: EquipmentItem[];
  gearLookup: EquipmentLookupResult | null;
  presetLookup: EquipmentLookupResult | null;
  /** Whether a PA preset is part of this push (its skipped items are only news then). */
  presetSelected: boolean;
}

const SkippedItems = ({ count, label, names }: { count: number; label: string; names: string[] }) => (
  <Alert variant="destructive">
    <AlertTriangle className="h-4 w-4" />
    <AlertDescription>
      {count} {label} se omitirán (sin ID de recurso en Flex):
      <div className="mt-1 text-xs max-h-20 overflow-y-auto">{names.join(', ')}</div>
    </AlertDescription>
  </Alert>
);

/** What would be pushed, and what would be skipped because it has no Flex resource. */
export function PushPreview({ isLookingUp, equipmentToPush, gearLookup, presetLookup, presetSelected }: PushPreviewProps) {
  if (isLookingUp) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Buscando equipo...
      </div>
    );
  }

  const gearMissing = gearLookup?.missing ?? [];
  const presetMissing = presetSelected ? (presetLookup?.missing ?? []) : [];
  const totalUnits = equipmentToPush.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="space-y-2">
      {equipmentToPush.length > 0 && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            Listo para enviar {equipmentToPush.length} artículos ({totalUnits} unidades en total)
          </AlertDescription>
        </Alert>
      )}
      {gearMissing.length > 0 && <SkippedItems count={gearMissing.length} label="artículos" names={gearMissing} />}
      {presetMissing.length > 0 && (
        <SkippedItems count={presetMissing.length} label="artículos del preset" names={presetMissing} />
      )}
      {equipmentToPush.length === 0 && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            Ningún artículo está vinculado a recursos de Flex. Vincula primero los modelos de equipo a recursos de Flex.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
