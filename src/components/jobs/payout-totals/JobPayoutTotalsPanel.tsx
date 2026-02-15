import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Euro } from 'lucide-react';
import { PayoutEmailPreview } from '@/components/jobs/PayoutEmailPreview';
import { useJobPayoutData } from './useJobPayoutData';
import { usePayoutActions } from './usePayoutActions';
import { PayoutPanelHeader } from './PayoutPanelHeader';
import { RehearsalDateToggles } from './RehearsalDateToggles';
import { TechnicianPayoutCard } from './TechnicianPayoutCard';
import { PayoutGrandTotal } from './PayoutGrandTotal';
import { cardBase, subtleText } from './types';
import type { JobPayoutTotalsPanelProps } from './types';

export function JobPayoutTotalsPanel({ jobId, technicianId }: JobPayoutTotalsPanelProps) {
  const data = useJobPayoutData(jobId, technicianId);
  const actions = usePayoutActions({
    jobId,
    technicianId,
    isTourDate: data.isTourDate,
    jobMeta: data.jobMeta,
    standardPayoutTotals: data.standardPayoutTotals,
    visibleTourQuotes: data.visibleTourQuotes,
    tourTimesheetDays: data.tourTimesheetDays,
    payoutTotals: data.payoutTotals,
    profilesWithEmail: data.profilesWithEmail,
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
        {data.payoutTotals.map((payout) => (
          <TechnicianPayoutCard
            key={payout.technician_id}
            payout={payout}
            jobId={jobId}
            isTourDate={data.isTourDate}
            isManager={data.isManager}
            profileMap={data.profileMap}
            autonomoMap={data.autonomoMap}
            getTechName={data.getTechName}
            lpoMap={data.lpoMap}
            flexElementMap={data.flexElementMap}
            buildFinDocUrl={data.buildFinDocUrl}
            techDaysMap={data.techDaysMap}
            techTotalDaysMap={data.techTotalDaysMap}
            missingEmailTechIds={actions.missingEmailTechIds}
            sendingByTech={actions.sendingByTech}
            getTechOverride={data.getTechOverride}
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
          payoutTotals={data.payoutTotals}
          calculatedGrandTotal={data.calculatedGrandTotal}
          payoutOverrides={data.payoutOverrides}
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
