import { AlertTriangle, CheckCircle2, HelpCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import type {
  XmlpFlexCandidate,
  XmlpFlexExportPlan,
  XmlpFlexMappingStatus,
} from '@/features/technical-tools/flex/xmlpFlexExportPlan';

interface XmlpFlexPlanPreviewProps {
  plan: XmlpFlexExportPlan;
  selectedIds: Set<string>;
  onSelectedIdsChange: (ids: Set<string>) => void;
}

const MAPPING_STATUS_LABELS: Record<XmlpFlexMappingStatus, string> = {
  mapped: 'Mapeado',
  'missing-resource-id': 'Sin recurso Flex',
  'missing-equipment': 'Sin equipo',
  ambiguous: 'Ambiguo',
};

const MappingIcon = ({ item }: { item: XmlpFlexCandidate }) => {
  if (item.mappingStatus === 'mapped' && item.flexCategoryKey) {
    return <CheckCircle2 className="h-4 w-4 text-green-600" aria-label="Mapeado" />;
  }
  if (item.mappingStatus === 'ambiguous') {
    return <HelpCircle className="h-4 w-4 text-amber-600" aria-label="Ambiguo" />;
  }
  return <AlertTriangle className="h-4 w-4 text-destructive" aria-label="Sin mapear" />;
};

const CandidateRow = ({
  item,
  checked,
  onCheckedChange,
}: {
  item: XmlpFlexCandidate;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) => {
  const selectable = item.mappingStatus === 'mapped' && item.flexCategoryKey !== null;
  return (
    <div className="rounded-md border p-2 text-xs">
      <div className="flex items-start gap-2">
        <Checkbox
          checked={checked}
          disabled={!selectable}
          onCheckedChange={(value) => onCheckedChange(value === true)}
          aria-label={`Seleccionar ${item.displayName}`}
        />
        <MappingIcon item={item} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold">{item.quantity} × {item.displayName}</span>
            <Badge variant="outline">{item.inference === 'explicit' ? 'Explícito' : 'Inferido'}</Badge>
            <Badge variant={item.mappingStatus === 'mapped' ? 'secondary' : 'destructive'}>
              {MAPPING_STATUS_LABELS[item.mappingStatus]}
            </Badge>
          </div>
          <p className="mt-1 break-all text-muted-foreground">Clave: {item.canonicalKey}</p>
          <p className="text-muted-foreground">Origen: {item.sources.join(', ')}</p>
          <p className="text-muted-foreground">Arrays/tablas: {item.sourceArrays.join(', ') || '—'}</p>
          <p className="text-muted-foreground">
            Equipo: {item.equipmentName ?? 'sin fila'}{item.equipmentId ? ` (${item.equipmentId})` : ''}
          </p>
          <p className="break-all text-muted-foreground">Recurso Flex: {item.resourceId ?? 'sin resource_id'}</p>
          {item.warning && <p className="mt-1 text-amber-700 dark:text-amber-400">{item.warning}</p>}
        </div>
      </div>
    </div>
  );
};

export function XmlpFlexPlanPreview({
  plan,
  selectedIds,
  onSelectedIdsChange,
}: XmlpFlexPlanPreviewProps) {
  const updateItem = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    onSelectedIdsChange(next);
  };

  return (
    <div className="space-y-3">
      {plan.groups.map((group) => {
        const selectableIds = group.items
          .filter((item) => item.mappingStatus === 'mapped')
          .map((item) => item.id);
        const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));
        return (
          <section key={group.flexCategoryKey} className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={allSelected}
                disabled={selectableIds.length === 0}
                onCheckedChange={(value) => {
                  const next = new Set(selectedIds);
                  for (const id of selectableIds) {
                    if (value === true) next.add(id);
                    else next.delete(id);
                  }
                  onSelectedIdsChange(next);
                }}
                aria-label={`Seleccionar grupo ${group.label}`}
              />
              <h3 className="font-semibold">{group.label}</h3>
              <Badge variant="outline">{group.items.length} líneas</Badge>
            </div>
            {group.items.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin requisitos.</p>
            ) : (
              group.items.map((item) => (
                <CandidateRow
                  key={item.id}
                  item={item}
                  checked={selectedIds.has(item.id)}
                  onCheckedChange={(checked) => updateItem(item.id, checked)}
                />
              ))
            )}
          </section>
        );
      })}
      {plan.unassignedItems.length > 0 && (
        <section className="space-y-2 rounded-lg border border-amber-500/50 p-3">
          <h3 className="font-semibold text-amber-700 dark:text-amber-400">Arrays sin clasificar</h3>
          {plan.unassignedItems.map((item) => (
            <CandidateRow key={item.id} item={item} checked={false} onCheckedChange={() => undefined} />
          ))}
        </section>
      )}
    </div>
  );
}
