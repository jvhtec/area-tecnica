import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar as CalendarIcon, CalendarDays, CalendarRange } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface CoverageModeSelectorProps {
  coverageMode: 'full' | 'single' | 'multi';
  setCoverageMode: (mode: 'full' | 'single' | 'multi') => void;
  isModifyingSelectedJob: boolean;
  existingTimesheets?: string[];
  modificationMode: 'add' | 'replace';
  setModificationMode: (mode: 'add' | 'replace') => void;
  singleDate: Date | null;
  setSingleDate: (date: Date | null) => void;
  multiDates: Date[];
  setMultiDates: (dates: Date[]) => void;
  isAllowedDate: (date: Date) => boolean;
  assignAsConfirmed: boolean;
  handleCheckboxChange: (checked: boolean | 'indeterminate') => void;
}

export const CoverageModeSelector = ({
  coverageMode,
  setCoverageMode,
  isModifyingSelectedJob,
  existingTimesheets,
  modificationMode,
  setModificationMode,
  singleDate,
  setSingleDate,
  multiDates,
  setMultiDates,
  isAllowedDate,
  assignAsConfirmed,
  handleCheckboxChange,
}: CoverageModeSelectorProps) => {
  return (
    <div className="space-y-4">
      {isModifyingSelectedJob && coverageMode !== 'full' && existingTimesheets && existingTimesheets.length > 0 && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <label className="text-sm font-medium text-blue-900 block mb-2">Modo de Modificación</label>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={modificationMode === 'add' ? 'default' : 'outline'}
              onClick={() => setModificationMode('add')}
              className="flex-1"
            >
              Añadir Fechas
            </Button>
            <Button
              type="button"
              size="sm"
              variant={modificationMode === 'replace' ? 'default' : 'outline'}
              onClick={() => setModificationMode('replace')}
              className="flex-1"
            >
              Reemplazar Fechas
            </Button>
          </div>
          <p className="text-xs text-blue-700 mt-2">
            {modificationMode === 'add'
              ? `Añadir: Las fechas seleccionadas se añadirán a las ${existingTimesheets.length} fecha(s) existente(s).`
              : 'Reemplazar: Las fechas existentes serán reemplazadas por las fechas seleccionadas.'}
          </p>
        </div>
      )}

      <Tabs value={coverageMode} onValueChange={(v) => setCoverageMode(v as 'full' | 'single' | 'multi')} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="full">
            <CalendarRange className="h-4 w-4 mr-2" />
            Completo
          </TabsTrigger>
          <TabsTrigger value="single">
            <CalendarIcon className="h-4 w-4 mr-2" />
            Día Suelto
          </TabsTrigger>
          <TabsTrigger value="multi">
            <CalendarDays className="h-4 w-4 mr-2" />
            Varios Días
          </TabsTrigger>
        </TabsList>

        <TabsContent value="full" className="mt-4">
          <div className="p-4 bg-muted/50 rounded-lg border border-border text-sm text-muted-foreground flex items-center gap-3">
            <CalendarRange className="h-5 w-5 text-primary" />
            <div>
              <p className="font-medium text-foreground">Asignación Completa</p>
              <p>El técnico será asignado a todos los días de este trabajo.</p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="single" className="mt-4 space-y-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Seleccionar Fecha</label>
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {singleDate ? format(singleDate, 'PPP', { locale: es }) : <span>Elige una fecha</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarPicker
                    mode="single"
                    selected={singleDate ?? undefined}
                    onSelect={(d) => {
                      if (d && isAllowedDate(d)) setSingleDate(d);
                    }}
                    disabled={(d) => !isAllowedDate(d)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <p className="text-xs text-muted-foreground">Crea una asignación de un solo día para la fecha seleccionada.</p>
          </div>
        </TabsContent>

        <TabsContent value="multi" className="mt-4 space-y-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Seleccionar Días</label>
            <div className="border rounded-md p-2 flex justify-center">
              <CalendarPicker
                mode="multiple"
                selected={multiDates}
                onSelect={(ds) => setMultiDates((ds || []).filter((d) => isAllowedDate(d)))}
                disabled={(d) => !isAllowedDate(d)}
                className="rounded-md border-none shadow-none"
                numberOfMonths={1}
              />
            </div>
            <p className="text-xs text-muted-foreground">Selecciona varios días para esta asignación.</p>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex items-center space-x-2 pt-2 border-t">
        <Checkbox
          id="confirm-assignment"
          checked={assignAsConfirmed}
          onCheckedChange={handleCheckboxChange}
        />
        <label
          htmlFor="confirm-assignment"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Asignar como confirmado (omitir invitación)
        </label>
      </div>
    </div>
  );
};
