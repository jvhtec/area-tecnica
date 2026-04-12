import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Euro, Search } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { TECHNICAL_DEPARTMENTS, DEPARTMENT_LABELS } from '@/types/department';
import { normalizeDepartmentKey } from '@/utils/permissions';
import { PayoutEmailPreview } from '@/components/jobs/PayoutEmailPreview';
import { useJobPayoutData } from './useJobPayoutData';
import { usePayoutActions } from './usePayoutActions';
import { PayoutPanelHeader } from './PayoutPanelHeader';
import { RehearsalDateToggles } from './RehearsalDateToggles';
import { TechnicianPayoutCard } from './TechnicianPayoutCard';
import { PayoutGrandTotal } from './PayoutGrandTotal';
import { cardBase, subtleText, NON_AUTONOMO_DEDUCTION_EUR } from './types';
import type { JobPayoutTotalsPanelProps } from './types';

export function JobPayoutTotalsPanel({ jobId, technicianId }: JobPayoutTotalsPanelProps) {
  const data = useJobPayoutData(jobId, technicianId);
  const isCicloJob = data.jobMeta?.job_type === 'ciclo';

  /* ── Filter state (admin/administrative only — must come before usePayoutActions) ── */
  const [filterDepartment, setFilterDepartment] = React.useState<string>('all');
  const [filterName, setFilterName] = React.useState<string>('');

  /* ── Filtered payout list ── */
  const displayedPayouts = React.useMemo(() => {
    let list = data.payoutTotals;
    if (!data.isAdminOrAdministrative) {
      // Dept managers: auto-filter to their own department only
      const normalizedUserDept = normalizeDepartmentKey(data.userDepartment);
      list = list.filter(p => {
        const techDept = normalizeDepartmentKey(data.profileMap.get(p.technician_id)?.department);
        return techDept === normalizedUserDept;
      });
    } else {
      // Admin/Administrative: apply UI-driven filters
      if (filterDepartment !== 'all') {
        list = list.filter(p =>
          normalizeDepartmentKey(data.profileMap.get(p.technician_id)?.department) === normalizeDepartmentKey(filterDepartment)
        );
      }
      if (filterName.trim()) {
        const needle = filterName.trim().toLowerCase();
        list = list.filter(p => data.getTechName(p.technician_id).toLowerCase().includes(needle));
      }
    }
    return list;
  }, [data.payoutTotals, data.isAdminOrAdministrative, data.userDepartment, data.profileMap, data.getTechName, filterDepartment, filterName]);

  /* ── Scope bulk-action inputs to the filtered set ── */
  const displayedTechIds = React.useMemo(
    () => new Set(displayedPayouts.map(p => p.technician_id)),
    [displayedPayouts]
  );

  const filteredStandardPayoutTotals = React.useMemo(
    () => data.standardPayoutTotals.filter(p => displayedTechIds.has(p.technician_id)),
    [data.standardPayoutTotals, displayedTechIds]
  );

  const filteredVisibleTourQuotes = React.useMemo(
    () => data.visibleTourQuotes.filter(q => displayedTechIds.has(q.technician_id)),
    [data.visibleTourQuotes, displayedTechIds]
  );

  const filteredProfilesWithEmail = React.useMemo(
    () => data.profilesWithEmail.filter(p => displayedTechIds.has(p.id)),
    [data.profilesWithEmail, displayedTechIds]
  );

  const filteredPayoutOverrides = React.useMemo(
    () => data.payoutOverrides.filter(o => displayedTechIds.has(o.technician_id)),
    [data.payoutOverrides, displayedTechIds]
  );

  /* ── Grand total for filtered view ── */
  const filteredCalculatedGrandTotal = React.useMemo(() => {
    return displayedPayouts.reduce((sum, payout) => {
      const override = data.getTechOverride(payout.technician_id);
      let deduction = 0;
      const isNonAutonomo = data.autonomoMap.get(payout.technician_id) === false;
      if (isNonAutonomo && !override && !data.isTourDate) {
        const days = data.techDaysMap.get(payout.technician_id) || (payout.timesheets_total_eur > 0 ? 1 : 0);
        deduction = days * NON_AUTONOMO_DEDUCTION_EUR;
      }
      return sum + ((override?.override_amount_eur ?? payout.total_eur) - (override ? 0 : deduction));
    }, 0);
  }, [displayedPayouts, data.getTechOverride, data.autonomoMap, data.isTourDate, data.techDaysMap]);

  /* ── Bulk actions receive only the visible, department-scoped collections ── */
  const actions = usePayoutActions({
    jobId,
    technicianId,
    isTourDate: data.isTourDate,
    jobMeta: data.jobMeta,
    standardPayoutTotals: filteredStandardPayoutTotals,
    visibleTourQuotes: filteredVisibleTourQuotes,
    payoutTotals: displayedPayouts,
    profilesWithEmail: filteredProfilesWithEmail,
    profileMap: data.profileMap,
    lpoMap: data.lpoMap,
    getTechName: data.getTechName,
    getTechOverride: data.getTechOverride,
  });

  /* ── Loading state ── */
  if (data.isLoading) {
    return (
      <Card className={`${cardBase} w-full`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Euro className="h-5 w-5" />
            Pagos del trabajo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={subtleText}>Cargando información de pagos...</div>
        </CardContent>
      </Card>
    );
  }

  /* ── Error state ── */
  if (data.error) {
    return (
      <Card className={`${cardBase} w-full`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Euro className="h-5 w-5" />
            Pagos del trabajo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-400">Error al cargar los pagos</div>
          <div className="text-xs text-red-300 mt-2">
            No se pudo obtener la información de pagos. Inténtalo de nuevo o contacta con soporte.
          </div>
        </CardContent>
      </Card>
    );
  }

  /* ── Empty state ── */
  if (data.payoutTotals.length === 0) {
    return (
      <Card className={`${cardBase} w-full`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Euro className="h-5 w-5" />
            Pagos del trabajo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={subtleText}>No hay información de pagos para este trabajo.</div>
        </CardContent>
      </Card>
    );
  }

  /* ── Main content ── */
  return (
    <Card className={`${cardBase} w-full`}>
      <CardHeader>
        <PayoutPanelHeader
          isManager={data.isManager}
          isExporting={actions.isExporting}
          isSendingEmails={actions.isSendingEmails}
          isLoadingPreview={actions.isLoadingPreview}
          hasPayouts={data.payoutTotals.length > 0}
          visibleCount={displayedPayouts.length}
          approvedCount={
            data.isTourDate
              ? filteredVisibleTourQuotes.length
              : filteredStandardPayoutTotals.filter(p => p.payout_approved).length
          }
          onExport={actions.handleExport}
          onPreview={actions.handlePreviewEmails}
          onSendEmails={actions.handleSendEmails}
        />

        {/* Per-date rehearsal rate toggles - managers only */}
        {data.isManager && (
          <RehearsalDateToggles
            jobId={jobId}
            jobTimesheetDates={data.jobTimesheetDates}
            rehearsalDateSet={data.rehearsalDateSet}
            allDatesMarked={data.allDatesMarked}
            toggleDateRehearsalMutation={data.toggleDateRehearsalMutation}
            toggleAllDatesRehearsalMutation={data.toggleAllDatesRehearsalMutation}
          />
        )}
      </CardHeader>

      <CardContent className="space-y-4 w-full overflow-hidden">
        {/* Filter bar — admin/administrative only */}
        {data.isAdminOrAdministrative && (
          <div className="flex flex-col sm:flex-row gap-2 pb-2 border-b border-border">
            <Select value={filterDepartment} onValueChange={setFilterDepartment}>
              <SelectTrigger className="w-full sm:w-44 h-8 text-xs">
                <SelectValue placeholder="Todos los departamentos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los departamentos</SelectItem>
                {TECHNICAL_DEPARTMENTS.map(dept => (
                  <SelectItem key={dept} value={dept}>{DEPARTMENT_LABELS[dept]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                className="pl-7 h-8 text-xs"
                placeholder="Buscar técnico..."
                value={filterName}
                onChange={e => setFilterName(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Zero-filter match feedback */}
        {displayedPayouts.length === 0 && data.payoutTotals.length > 0 && (
          <div className="text-sm text-muted-foreground py-4 text-center">
            No hay técnicos que coincidan con el filtro seleccionado.
          </div>
        )}

        {displayedPayouts.map((payout) => (
          <TechnicianPayoutCard
            key={payout.technician_id}
            payout={payout}
            jobId={jobId}
            isTourDate={data.isTourDate}
            isCicloJob={isCicloJob}
            isManager={data.isManager}
            canViewTechnicianRateModePanel={data.canViewTechnicianRateModePanel}
            profileMap={data.profileMap}
            autonomoMap={data.autonomoMap}
            getTechName={data.getTechName}
            lpoMap={data.lpoMap}
            flexElementMap={data.flexElementMap}
            buildFinDocUrl={data.buildFinDocUrl}
            techDaysMap={data.techDaysMap}
            techTotalDaysMap={data.techTotalDaysMap}
            technicianTimesheetDates={data.technicianTimesheetDatesMap.get(payout.technician_id) ?? []}
            rehearsalDateSet={data.rehearsalDateSet}
            missingEmailTechIds={actions.missingEmailTechIds}
            sendingByTech={actions.sendingByTech}
            isClosureLocked={data.isClosureLocked}
            getTechOverride={data.getTechOverride}
            getTechRateModeDateSelection={data.getTechRateModeDateSelection}
            setTechnicianRateModeMutation={data.setTechnicianRateModeMutation}
            overrideActorMap={data.overrideActorMap}
            editingTechId={actions.editingTechId}
            editingAmount={actions.editingAmount}
            setEditingAmount={actions.setEditingAmount}
            onStartEdit={actions.handleStartEdit}
            onSaveOverride={actions.handleSaveOverride}
            onCancelEdit={actions.handleCancelEdit}
            onRemoveOverride={actions.handleRemoveOverride}
            isSavingOverride={actions.isSavingOverride}
            isRemovingOverride={actions.isRemovingOverride}
            toggleApprovalMutation={actions.toggleApprovalMutation}
            onSendEmailForTech={actions.handleSendEmailForTech}
          />
        ))}

        <PayoutGrandTotal
          payoutTotals={displayedPayouts}
          calculatedGrandTotal={filteredCalculatedGrandTotal}
          payoutOverrides={filteredPayoutOverrides}
          isCicloJob={isCicloJob}
        />
      </CardContent>

      <PayoutEmailPreview
        open={actions.previewOpen}
        onClose={actions.closePreview}
        context={actions.previewContext}
        jobTitle={data.jobMeta?.title || 'Trabajo'}
      />
    </Card>
  );
}
