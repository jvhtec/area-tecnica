import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatFestivalInstant } from '@/features/festival-management/dateFormatting';
import type { JobPullsheet } from '@/services/flexPullsheets';

interface PullsheetTargetProps {
  mode: 'select' | 'url';
  onModeChange: (mode: 'select' | 'url') => void;
  pullsheets: JobPullsheet[];
  isLoading: boolean;
  selectedId: string | null;
  onSelect: (elementId: string) => void;
  url: string;
  onUrlChange: (url: string) => void;
  isValidUrl: boolean;
  elementId: string | null;
  disabled: boolean;
}

const UNKNOWN_CREATION_DATE = '2000-01-01T00:00:00.000Z';

const pullsheetLabel = (pullsheet: JobPullsheet): string =>
  pullsheet.display_name ||
  (pullsheet.department
    ? `Pullsheet de ${pullsheet.department.charAt(0).toUpperCase()}${pullsheet.department.slice(1)}`
    : 'Pullsheet');

const pullsheetDate = (pullsheet: JobPullsheet): string =>
  pullsheet.source === 'flex_api' && pullsheet.created_at === UNKNOWN_CREATION_DATE
    ? 'Desconocida'
    : formatFestivalInstant(pullsheet.created_at, 'dd/MM/yyyy');

/** Where to push: one of the job's pullsheets, or any Flex pullsheet by URL. */
export function PullsheetTarget({
  mode,
  onModeChange,
  pullsheets,
  isLoading,
  selectedId,
  onSelect,
  url,
  onUrlChange,
  isValidUrl,
  elementId,
  disabled,
}: PullsheetTargetProps) {
  return (
    <Tabs value={mode} onValueChange={(value) => onModeChange(value as 'select' | 'url')}>
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="select" disabled={pullsheets.length === 0 && !isLoading}>
          Elegir pullsheet {pullsheets.length > 0 && `(${pullsheets.length})`}
        </TabsTrigger>
        <TabsTrigger value="url">Introducir URL</TabsTrigger>
      </TabsList>

      <TabsContent value="select" className="space-y-2">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando pullsheets...
          </div>
        ) : pullsheets.length === 0 ? (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              No se encontraron pullsheets para este trabajo. Crea uno primero o usa la opción de URL.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <Label htmlFor="pullsheet-select">Pullsheets disponibles</Label>
            <Select value={selectedId || ''} onValueChange={onSelect}>
              <SelectTrigger id="pullsheet-select">
                <SelectValue placeholder="Selecciona un pullsheet..." />
              </SelectTrigger>
              <SelectContent>
                {pullsheets.map((pullsheet) => (
                  <SelectItem key={pullsheet.id} value={pullsheet.element_id}>
                    {pullsheetLabel(pullsheet)}{' '}
                    <span className="text-xs text-muted-foreground">
                      {pullsheet.source === 'flex_api' && '(de Flex) '}({pullsheetDate(pullsheet)})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedId && <p className="text-sm text-muted-foreground">ID del elemento: {selectedId}</p>}
          </>
        )}
      </TabsContent>

      <TabsContent value="url" className="space-y-2">
        <Label htmlFor="pullsheet-url">URL del pullsheet</Label>
        <div className="flex gap-2">
          <Input
            id="pullsheet-url"
            placeholder="Pega aquí la URL del pullsheet de Flex..."
            value={url}
            onChange={(event) => onUrlChange(event.target.value)}
            disabled={disabled}
            className={isValidUrl ? 'border-green-500' : ''}
          />
          {isValidUrl && <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-2" />}
        </div>
        {url && !isValidUrl && <p className="text-sm text-destructive">Formato de URL de Flex no válido</p>}
        {isValidUrl && elementId && <p className="text-sm text-muted-foreground">ID del elemento: {elementId}</p>}
      </TabsContent>
    </Tabs>
  );
}
