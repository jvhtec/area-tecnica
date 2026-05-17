import { Calendar, Filter, RefreshCw, Refrigerator, Users } from 'lucide-react';

import { DateRangeExpander } from '@/components/matrix/DateRangeExpander';
import { SkillsFilter } from '@/components/matrix/SkillsFilter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AVAILABLE_DEPARTMENTS,
  DEPARTMENT_LABELS,
  formatLabel,
  type Department,
} from '@/pages/job-assignment-matrix/utils';

type MatrixPageControlsProps = {
  selectedDepartment: Department;
  defaultDepartment: Department;
  handleDepartmentChange: (value: Department) => void;
  resetDepartmentToDefault: () => void;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  selectedSkills: string[];
  setSelectedSkills: (value: string[]) => void;
  specialtyOptions: readonly string[];
  toggleSpecialty: (name: string) => void;
  hideFridge: boolean;
  setHideFridge: (value: boolean) => void;
  fridgeCount: number;
  allowDirectAssign: boolean;
  setAllowDirectAssign: (value: boolean) => void;
  allowMarkUnavailable: boolean;
  setAllowMarkUnavailable: (value: boolean) => void;
  canMarkUnavailable: boolean;
  hideStaffingEmailButtons: boolean;
  setHideStaffingEmailButtons: (value: boolean) => void;
  hideStaffingWhatsappButtons: boolean;
  setHideStaffingWhatsappButtons: (value: boolean) => void;
  filtersOpen: boolean;
  setFiltersOpen: (updater: boolean | ((value: boolean) => boolean)) => void;
  activeFilterCount: number;
  isRefreshing: boolean;
  handleRefresh: () => void;
  isBackgroundFetchingMatrix: boolean;
  filteredTechnicianCount: number;
  jobsCount: number;
  canExpandBefore: boolean;
  canExpandAfter: boolean;
  expandBefore: () => void;
  expandAfter: () => void;
  resetRange: () => void;
  jumpToMonth: (year: number, month: number) => void;
  rangeInfo: any;
  setShowStaffingReminder: (value: boolean) => void;
  handleReminderOpenChange: (open: boolean) => void;
  outstandingJobsCount: number | null;
  outstandingJobsDescription: string;
};

export const MatrixPageControls = ({
  selectedDepartment,
  defaultDepartment,
  handleDepartmentChange,
  resetDepartmentToDefault,
  searchTerm,
  setSearchTerm,
  selectedSkills,
  setSelectedSkills,
  specialtyOptions,
  toggleSpecialty,
  hideFridge,
  setHideFridge,
  fridgeCount,
  allowDirectAssign,
  setAllowDirectAssign,
  allowMarkUnavailable,
  setAllowMarkUnavailable,
  canMarkUnavailable,
  hideStaffingEmailButtons,
  setHideStaffingEmailButtons,
  hideStaffingWhatsappButtons,
  setHideStaffingWhatsappButtons,
  filtersOpen,
  setFiltersOpen,
  activeFilterCount,
  isRefreshing,
  handleRefresh,
  isBackgroundFetchingMatrix,
  filteredTechnicianCount,
  jobsCount,
  canExpandBefore,
  canExpandAfter,
  expandBefore,
  expandAfter,
  resetRange,
  jumpToMonth,
  rangeInfo,
  setShowStaffingReminder,
  handleReminderOpenChange,
  outstandingJobsCount,
  outstandingJobsDescription,
}: MatrixPageControlsProps) => (
  <>
    <div className="flex-shrink-0 border-b bg-card p-2 md:p-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 md:h-6 md:w-6" />
          <h1 className="text-lg md:text-2xl font-bold">Matriz de asignación de trabajos</h1>
        </div>
        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setShowStaffingReminder(true);
              handleReminderOpenChange(true);
            }}
            className="shrink-0 flex items-center gap-2"
            aria-label={`Ver recordatorio de staffing. ${outstandingJobsDescription}.`}
          >
            Ver recordatorio de staffing
            {outstandingJobsCount !== null && (
              <Badge variant="outline" className="text-xs" aria-hidden="true">
                {outstandingJobsCount}
              </Badge>
            )}
            <span className="sr-only">{outstandingJobsDescription}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="shrink-0"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refrescar</span>
          </Button>
        </div>
      </div>

      <div className="hidden md:block">
        <DateRangeExpander
          canExpandBefore={canExpandBefore}
          canExpandAfter={canExpandAfter}
          onExpandBefore={expandBefore}
          onExpandAfter={expandAfter}
          onReset={resetRange}
          onJumpToMonth={jumpToMonth}
          rangeInfo={rangeInfo}
        />
      </div>

      <div className="hidden md:flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4" />
          <span className="text-sm font-medium">Filtros:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Tabs
            value={selectedDepartment}
            onValueChange={(value) => handleDepartmentChange(value as Department)}
            className="w-full sm:w-auto"
          >
            <TabsList className="flex w-full sm:w-auto overflow-x-auto rounded-md bg-muted p-1 gap-1">
              {AVAILABLE_DEPARTMENTS.map((dept) => (
                <TabsTrigger
                  key={dept}
                  value={dept}
                  className="flex-1 whitespace-nowrap capitalize sm:flex-none"
                >
                  {DEPARTMENT_LABELS[dept] || formatLabel(dept)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <Input
            placeholder="Buscar técnicos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-48 min-w-0 flex-1 sm:flex-none"
          />

          <SkillsFilter selected={selectedSkills} onChange={setSelectedSkills} department={selectedDepartment} />
          {specialtyOptions.length > 0 && (
            <div className="flex items-center gap-1">
              {specialtyOptions.map((opt) => (
                <Badge
                  key={opt}
                  variant={selectedSkills.includes(opt) ? 'default' : 'outline'}
                  className="cursor-pointer capitalize"
                  onClick={() => toggleSpecialty(opt)}
                >
                  {opt}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <div className="flex items-center gap-2 pr-2 border-r">
            <Refrigerator className="h-4 w-4" />
            <span className="text-sm font-medium">{hideFridge ? 'Abrir la nevera' : 'Cerrar la nevera'}</span>
            <Switch
              checked={hideFridge}
              onCheckedChange={(v) => setHideFridge(Boolean(v))}
              aria-label={hideFridge ? 'Abrir la nevera' : 'Cerrar la nevera'}
            />
            <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{fridgeCount}</Badge>
          </div>
          <div className="flex items-center gap-2 pr-2 border-r">
            <span className="text-sm font-medium">Asignación directa</span>
            <Switch
              checked={allowDirectAssign}
              onCheckedChange={(v) => { setAllowDirectAssign(Boolean(v)); if (v) setAllowMarkUnavailable(false); }}
              aria-label="Alternar asignación directa"
            />
          </div>
          {canMarkUnavailable && (
            <div className="flex items-center gap-2 pr-2 border-r">
              <span className="text-sm font-medium">No disponible</span>
              <Switch
                checked={allowMarkUnavailable}
                onCheckedChange={(v) => { setAllowMarkUnavailable(Boolean(v)); if (v) setAllowDirectAssign(false); }}
                aria-label="Alternar marcar no disponible"
              />
            </div>
          )}
          <div className="flex items-center gap-2 pr-2 border-r">
            <span className="text-sm font-medium">Email</span>
            <Switch
              checked={!hideStaffingEmailButtons}
              onCheckedChange={(v) => setHideStaffingEmailButtons(!v)}
              aria-label="Mostrar botones de email"
            />
          </div>
          <div className="flex items-center gap-2 pr-2 border-r">
            <span className="text-sm font-medium">WhatsApp</span>
            <Switch
              checked={!hideStaffingWhatsappButtons}
              onCheckedChange={(v) => setHideStaffingWhatsappButtons(!v)}
              aria-label="Mostrar botones de WhatsApp"
            />
          </div>
          <Users className="h-4 w-4" />
          <Badge variant="secondary" className="text-xs">
            {filteredTechnicianCount} técnicos
          </Badge>
          <Badge variant="outline" className="text-xs">
            {jobsCount} trabajos
          </Badge>
          {isBackgroundFetchingMatrix && (
            <Badge variant="outline" className="text-xs flex items-center gap-1">
              <RefreshCw className="h-3 w-3 animate-spin" />
              Actualizando...
            </Badge>
          )}
        </div>
      </div>
    </div>

    <div className="md:hidden mt-2">
      <div className="flex items-center justify-between gap-2">
        <button
          className="text-sm font-medium px-3 py-2 border rounded-md bg-background"
          onClick={() => setFiltersOpen((v) => !v)}
          aria-expanded={filtersOpen}
          aria-controls="mobile-filters"
        >
          Filtros {activeFilterCount > 0 && <span className="ml-2 inline-flex items-center justify-center text-[10px] h-5 min-w-[20px] px-1.5 rounded-full bg-primary/10 text-primary border border-primary/20">{activeFilterCount}</span>}
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs">Directa</span>
          <Switch
            checked={allowDirectAssign}
            onCheckedChange={(v) => { setAllowDirectAssign(Boolean(v)); if (v) setAllowMarkUnavailable(false); }}
            aria-label="Alternar asignación directa"
          />
        </div>
        {canMarkUnavailable && (
          <div className="flex items-center gap-2">
            <span className="text-xs">No disp.</span>
            <Switch
              checked={allowMarkUnavailable}
              onCheckedChange={(v) => { setAllowMarkUnavailable(Boolean(v)); if (v) setAllowDirectAssign(false); }}
              aria-label="Alternar marcar no disponible"
            />
          </div>
        )}
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          <Badge variant="secondary" className="text-xs">
            {filteredTechnicianCount} técnicos
          </Badge>
          <Badge variant="outline" className="text-xs">
            {jobsCount} trabajos
          </Badge>
          {isBackgroundFetchingMatrix && (
            <Badge variant="outline" className="text-[10px] flex items-center gap-1">
              <RefreshCw className="h-3 w-3 animate-spin" />
              Actualizando...
            </Badge>
          )}
        </div>
      </div>
      {filtersOpen && (
        <div id="mobile-filters" className="mt-2 max-h-[300px] overflow-y-auto p-2 border rounded-md bg-muted/30 space-y-2">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <span className="text-sm font-medium">Filtros</span>
            {activeFilterCount > 0 && (
              <button
                className="ml-auto text-xs underline"
                onClick={() => {
                  resetDepartmentToDefault();
                  setSearchTerm('');
                  setSelectedSkills([]);
                  setHideFridge(false);
                  setAllowDirectAssign(false);
                  setHideStaffingEmailButtons(false);
                  setHideStaffingWhatsappButtons(false);
                }}
              >
                Limpiar
              </button>
            )}
          </div>
          <Tabs
            value={selectedDepartment}
            onValueChange={(value) => handleDepartmentChange(value as Department)}
            className="w-full"
          >
            <TabsList className="flex w-full overflow-x-auto rounded-md bg-muted p-1 gap-1">
              {AVAILABLE_DEPARTMENTS.map((dept) => (
                <TabsTrigger
                  key={dept}
                  value={dept}
                  className="flex-1 whitespace-nowrap capitalize"
                >
                  {DEPARTMENT_LABELS[dept] || formatLabel(dept)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Input
            placeholder="Buscar técnicos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <SkillsFilter selected={selectedSkills} onChange={setSelectedSkills} department={selectedDepartment} />
          {specialtyOptions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {specialtyOptions.map((opt) => (
                <Badge
                  key={opt}
                  variant={selectedSkills.includes(opt) ? 'default' : 'outline'}
                  className="cursor-pointer capitalize"
                  onClick={() => toggleSpecialty(opt)}
                >
                  {opt}
                </Badge>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Refrigerator className="h-4 w-4" />
              <span className="text-sm font-medium">{hideFridge ? 'Abrir la nevera' : 'Cerrar la nevera'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={hideFridge} onCheckedChange={(v) => setHideFridge(Boolean(v))} aria-label={hideFridge ? 'Abrir la nevera' : 'Cerrar la nevera'} />
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{fridgeCount}</Badge>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Asignación directa</span>
            <Switch checked={allowDirectAssign} onCheckedChange={(v) => { setAllowDirectAssign(Boolean(v)); if (v) setAllowMarkUnavailable(false); }} aria-label="Alternar asignación directa" />
          </div>
          {canMarkUnavailable && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Marcar no disponible</span>
              <Switch checked={allowMarkUnavailable} onCheckedChange={(v) => { setAllowMarkUnavailable(Boolean(v)); if (v) setAllowDirectAssign(false); }} aria-label="Alternar marcar no disponible" />
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Mostrar email</span>
            <Switch
              checked={!hideStaffingEmailButtons}
              onCheckedChange={(v) => setHideStaffingEmailButtons(!v)}
              aria-label="Mostrar botones de email"
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Mostrar WhatsApp</span>
            <Switch
              checked={!hideStaffingWhatsappButtons}
              onCheckedChange={(v) => setHideStaffingWhatsappButtons(!v)}
              aria-label="Mostrar botones de WhatsApp"
            />
          </div>
        </div>
      )}
    </div>
  </>
);
