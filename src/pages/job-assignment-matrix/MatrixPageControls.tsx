import { AlertCircle, Briefcase, ChevronRight, Filter, LayoutGrid, Mail, MessageCircle, RefreshCw, Refrigerator, Search, Users } from 'lucide-react';

import { DateRangeExpander } from '@/components/matrix/DateRangeExpander';
import { MatrixLegend } from '@/components/matrix/MatrixLegend';
import { SkillsFilter } from '@/components/matrix/SkillsFilter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { MatrixSwitchChip } from '@/pages/job-assignment-matrix/MatrixSwitchChip';
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
}: MatrixPageControlsProps) => {
  const departmentLabel = DEPARTMENT_LABELS[selectedDepartment] || formatLabel(selectedDepartment);
  const hasOutstanding = (outstandingJobsCount ?? 0) > 0;

  const departmentTabs = (className?: string) => (
    <Tabs
      value={selectedDepartment}
      onValueChange={(value) => handleDepartmentChange(value as Department)}
      className={className}
    >
      <TabsList className="flex w-full gap-1 overflow-x-auto rounded-xl bg-muted p-1 sm:w-auto">
        {AVAILABLE_DEPARTMENTS.map((dept) => (
          <TabsTrigger
            key={dept}
            value={dept}
            className="flex-1 whitespace-nowrap rounded-lg text-xs capitalize sm:flex-none"
          >
            {DEPARTMENT_LABELS[dept] || formatLabel(dept)}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );

  const searchField = (className?: string) => (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder="Buscar técnicos..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="h-9 rounded-xl pl-8"
      />
    </div>
  );

  const specialtyChips = (className?: string) =>
    specialtyOptions.length > 0 ? (
      <div className={cn('flex flex-wrap items-center gap-1', className)}>
        {specialtyOptions.map((opt) => (
          <Badge
            key={opt}
            variant={selectedSkills.includes(opt) ? 'default' : 'outline'}
            className="cursor-pointer rounded-full capitalize"
            onClick={() => toggleSpecialty(opt)}
          >
            {opt}
          </Badge>
        ))}
      </div>
    ) : null;

  return (
    <>
      <div className="flex-shrink-0 border-b bg-card/95 px-2 py-2 backdrop-blur supports-[backdrop-filter]:bg-card/80 md:px-4 md:py-3">
        {/* Identity + global actions */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm"
              aria-hidden="true"
            >
              <LayoutGrid className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <span>Staffing</span>
                <ChevronRight className="h-3 w-3" aria-hidden="true" />
                <span className="truncate normal-case tracking-normal text-foreground">{departmentLabel}</span>
              </div>
              <h1 className="truncate text-base font-bold leading-tight md:text-xl">
                Matriz de asignación de trabajos
              </h1>
              {/* On a phone this line carries the counters, which get their own
                  chips only where there is room for them. */}
              <p className="truncate text-xs text-muted-foreground">
                <span className="md:hidden">
                  {filteredTechnicianCount} técnicos · {jobsCount} trabajos
                </span>
                <span className="hidden md:inline">
                  {rangeInfo?.startFormatted} – {rangeInfo?.endFormatted}
                </span>
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              type="button"
              variant={hasOutstanding ? 'outline' : 'ghost'}
              size="sm"
              onClick={() => {
                setShowStaffingReminder(true);
                handleReminderOpenChange(true);
              }}
              className={cn(
                'h-8 gap-1.5 rounded-lg px-2',
                hasOutstanding && 'border-amber-500/40 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300',
              )}
              aria-label={`Ver recordatorio de staffing. ${outstandingJobsDescription}.`}
            >
              <AlertCircle className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold">
                {outstandingJobsCount !== null ? outstandingJobsCount : '—'}
                <span className="hidden sm:inline"> sin cubrir</span>
              </span>
              <span className="sr-only">{outstandingJobsDescription}</span>
            </Button>

            <MatrixLegend className="hidden md:inline-flex" />

            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="h-8 gap-1.5 rounded-lg px-2"
              aria-label="Refrescar la matriz"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
              <span className="hidden text-xs lg:inline">Refrescar</span>
            </Button>
          </div>
        </div>

        {/* Roster counters. The phone reads them from the subtitle above. */}
        <div className="mt-2 hidden flex-wrap items-center gap-1.5 md:flex">
          <span className="inline-flex items-center gap-1 rounded-lg border bg-background/60 px-2 py-1 text-xs font-medium">
            <Users className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            {filteredTechnicianCount} técnicos
          </span>
          <span className="inline-flex items-center gap-1 rounded-lg border bg-background/60 px-2 py-1 text-xs font-medium">
            <Briefcase className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            {jobsCount} trabajos
          </span>
          {isBackgroundFetchingMatrix && (
            <span className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
              <RefreshCw className="h-3 w-3 animate-spin" aria-hidden="true" />
              Actualizando...
            </span>
          )}
          <div className="ml-auto hidden md:block">
            <DateRangeExpander
              compact
              canExpandBefore={canExpandBefore}
              canExpandAfter={canExpandAfter}
              onExpandBefore={expandBefore}
              onExpandAfter={expandAfter}
              onReset={resetRange}
              onJumpToMonth={jumpToMonth}
              rangeInfo={rangeInfo}
            />
          </div>
        </div>

        {/* Desktop toolbar */}
        <div className="mt-2 hidden flex-col gap-2 md:flex">
          <div className="flex flex-wrap items-center gap-2">
            {departmentTabs('w-auto')}
            {searchField('w-56')}
            <SkillsFilter selected={selectedSkills} onChange={setSelectedSkills} department={selectedDepartment} />
            {specialtyChips()}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Filter className="h-3.5 w-3.5" aria-hidden="true" />
              Modos
            </span>
            <MatrixSwitchChip
              label={hideFridge ? 'Abrir la nevera' : 'Cerrar la nevera'}
              ariaLabel={hideFridge ? 'Abrir la nevera' : 'Cerrar la nevera'}
              checked={hideFridge}
              onCheckedChange={setHideFridge}
              icon={<Refrigerator className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />}
              trailing={<Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{fridgeCount}</Badge>}
            />
            <MatrixSwitchChip
              label="Asignación directa"
              ariaLabel="Alternar asignación directa"
              checked={allowDirectAssign}
              onCheckedChange={(value) => {
                setAllowDirectAssign(value);
                if (value) setAllowMarkUnavailable(false);
              }}
            />
            {canMarkUnavailable && (
              <MatrixSwitchChip
                label="No disponible"
                ariaLabel="Alternar marcar no disponible"
                checked={allowMarkUnavailable}
                onCheckedChange={(value) => {
                  setAllowMarkUnavailable(value);
                  if (value) setAllowDirectAssign(false);
                }}
              />
            )}
            <MatrixSwitchChip
              label="Email"
              ariaLabel="Mostrar botones de email"
              checked={!hideStaffingEmailButtons}
              onCheckedChange={(value) => setHideStaffingEmailButtons(!value)}
              icon={<Mail className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />}
            />
            <MatrixSwitchChip
              label="WhatsApp"
              ariaLabel="Mostrar botones de WhatsApp"
              checked={!hideStaffingWhatsappButtons}
              onCheckedChange={(value) => setHideStaffingWhatsappButtons(!value)}
              icon={<MessageCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />}
            />
          </div>
        </div>
      </div>

      {/* Mobile bar: the two modes a coordinator flips constantly stay on screen,
          everything else lives one tap away in the panel. */}
      <div className="flex-shrink-0 border-b bg-card px-2 py-2 md:hidden">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
          {isBackgroundFetchingMatrix && (
            <span className="order-last inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
              <RefreshCw className="h-3 w-3 animate-spin" aria-hidden="true" />
              Actualizando...
            </span>
          )}
          <button
            className="inline-flex items-center gap-1.5 rounded-xl border bg-background px-3 py-2 text-sm font-medium"
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
            aria-controls="mobile-filters"
          >
            <Filter className="h-3.5 w-3.5" aria-hidden="true" />
            Filtros
            {activeFilterCount > 0 && (
              <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full border border-primary/20 bg-primary/10 px-1.5 text-[10px] text-primary">
                {activeFilterCount}
              </span>
            )}
          </button>
          <MatrixSwitchChip
            label="Directa"
            ariaLabel="Alternar asignación directa"
            checked={allowDirectAssign}
            onCheckedChange={(value) => {
              setAllowDirectAssign(value);
              if (value) setAllowMarkUnavailable(false);
            }}
          />
          {canMarkUnavailable && (
            <MatrixSwitchChip
              label="No disp."
              ariaLabel="Alternar marcar no disponible"
              checked={allowMarkUnavailable}
              onCheckedChange={(value) => {
                setAllowMarkUnavailable(value);
                if (value) setAllowDirectAssign(false);
              }}
            />
          )}
        </div>

        {filtersOpen && (
          <div id="mobile-filters" className="mt-2 max-h-[50dvh] space-y-2 overflow-y-auto rounded-xl border bg-muted/30 p-2">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" aria-hidden="true" />
              <span className="text-sm font-medium">Filtros</span>
              {activeFilterCount > 0 && (
                <button
                  className="ml-auto text-xs underline"
                  onClick={() => {
                    resetDepartmentToDefault();
                    setSearchTerm('');
                    setSelectedSkills([]);
                    // The fridge is hidden by default — clearing filters restores
                    // that default rather than revealing fridged technicians.
                    setHideFridge(true);
                    setAllowDirectAssign(false);
                    setAllowMarkUnavailable(false);
                    setHideStaffingEmailButtons(false);
                    setHideStaffingWhatsappButtons(false);
                  }}
                >
                  Limpiar
                </button>
              )}
            </div>

            {departmentTabs('w-full')}
            {searchField()}
            <SkillsFilter selected={selectedSkills} onChange={setSelectedSkills} department={selectedDepartment} />
            {specialtyChips()}

            <MatrixSwitchChip
              block
              label={hideFridge ? 'Abrir la nevera' : 'Cerrar la nevera'}
              ariaLabel={hideFridge ? 'Abrir la nevera' : 'Cerrar la nevera'}
              checked={hideFridge}
              onCheckedChange={setHideFridge}
              icon={<Refrigerator className="h-4 w-4 text-sky-600 dark:text-sky-400" />}
              trailing={<Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{fridgeCount}</Badge>}
            />
            <MatrixSwitchChip
              block
              label="Asignación directa"
              ariaLabel="Alternar asignación directa"
              checked={allowDirectAssign}
              onCheckedChange={(value) => {
                setAllowDirectAssign(value);
                if (value) setAllowMarkUnavailable(false);
              }}
            />
            {canMarkUnavailable && (
              <MatrixSwitchChip
                block
                label="Marcar no disponible"
                ariaLabel="Alternar marcar no disponible"
                checked={allowMarkUnavailable}
                onCheckedChange={(value) => {
                  setAllowMarkUnavailable(value);
                  if (value) setAllowDirectAssign(false);
                }}
              />
            )}
            <MatrixSwitchChip
              block
              label="Mostrar email"
              ariaLabel="Mostrar botones de email"
              checked={!hideStaffingEmailButtons}
              onCheckedChange={(value) => setHideStaffingEmailButtons(!value)}
              icon={<Mail className="h-4 w-4 text-sky-600 dark:text-sky-400" />}
            />
            <MatrixSwitchChip
              block
              label="Mostrar WhatsApp"
              ariaLabel="Mostrar botones de WhatsApp"
              checked={!hideStaffingWhatsappButtons}
              onCheckedChange={(value) => setHideStaffingWhatsappButtons(!value)}
              icon={<MessageCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
            />

            <MatrixLegend className="w-full justify-center" showLabel />

            <DateRangeExpander
              compact
              canExpandBefore={canExpandBefore}
              canExpandAfter={canExpandAfter}
              onExpandBefore={expandBefore}
              onExpandAfter={expandAfter}
              onReset={resetRange}
              onJumpToMonth={jumpToMonth}
              rangeInfo={rangeInfo}
            />
          </div>
        )}
      </div>
    </>
  );
};
