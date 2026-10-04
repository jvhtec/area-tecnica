import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useMatrixV2 } from '@/features/matrix-v2/useMatrixV2';

/**
 * Which matrix this person gets. The new one is the default for managers; this
 * is the way back for as long as the old one exists, and the way to ask for the
 * default again.
 */
export function MatrixVersionSettings() {
  const { enabled, choice, defaultOn, setChoice } = useMatrixV2();
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Label htmlFor="matrix-v2-switch" className="text-sm font-medium">Usar la nueva matriz de asignaciones</Label>
          <p className="text-xs text-muted-foreground">
            Un solo panel junto a la celda en lugar de varios diálogos, enfoque por trabajo, selección en bloque con Deshacer y atajos de teclado.
            Si algo no te encaja puedes volver a la matriz anterior; cuéntanos qué te falta.
          </p>
        </div>
        <Switch
          id="matrix-v2-switch"
          checked={enabled}
          onCheckedChange={(next) => setChoice(next ? 'v2' : 'v1')}
          aria-label="Usar la nueva matriz de asignaciones"
        />
      </div>
      {choice !== null && (
        <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/40 px-3 py-2 text-xs">
          <span>
            Elegiste {choice === 'v2' ? 'la nueva matriz' : 'la matriz anterior'} en este navegador.
            {defaultOn ? ' Por defecto, a ti te sale la nueva.' : ' Por defecto, a ti te sale la anterior.'}
          </span>
          <Button type="button" variant="outline" size="sm" onClick={() => setChoice(null)}>Usar el valor por defecto</Button>
        </div>
      )}
    </div>
  );
}
