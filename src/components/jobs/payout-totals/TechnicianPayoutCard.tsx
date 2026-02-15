import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { AlertCircle, Clock, CheckCircle, ExternalLink, Send, Receipt } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { getAutonomoBadgeLabel } from '@/utils/autonomo';
import { JobPayoutOverrideSection, type JobPayoutOverride } from '../JobPayoutOverrideSection';
import type { JobPayoutTotals } from '@/types/jobExtras';
import type { TechnicianProfileWithEmail } from '@/lib/job-payout-email';
import { surface, controlButton, NON_AUTONOMO_DEDUCTION_EUR } from './types';

const categoryLabels: Record<string, string> = {
  'dietas': 'Dietas',
  'transporte': 'Transporte',
  'alojamiento': 'Alojamiento',
  'material': 'Material',
  'otros': 'Otros',
};

interface TechnicianPayoutCardProps {
  payout: JobPayoutTotals;
  jobId: string;
  isTourDate: boolean;
  isManager: boolean;
  profileMap: Map<string, TechnicianProfileWithEmail>;
  autonomoMap: Map<string, boolean | null>;
  getTechName: (id: string) => string;
  lpoMap: Map<string, string | null>;
  flexElementMap: Map<string, string | null>;
  buildFinDocUrl: (elementId: string | null | undefined) => string | null;
  techDaysMap: Map<string, number>;
  techTotalDaysMap: Map<string, number>;
  missingEmailTechIds: string[];
  sendingByTech: Record<string, boolean>;
  /* Override */
  getTechOverride: (techId: string) => JobPayoutOverride | undefined;
  overrideActorMap: Map<string, { name: string; email: string | null }>;
  editingTechId: string | null;
  editingAmount: string;
  setEditingAmount: (v: string) => void;
  onStartEdit: (techId: string, currentAmount: number) => void;
  onSaveOverride: (techId: string, techName: string, calculatedTotal: number) => void;
  onCancelEdit: () => void;
  onRemoveOverride: (techId: string) => void;
  isSavingOverride: boolean;
  isRemovingOverride: boolean;
  /* Approval */
  toggleApprovalMutation: { mutate: (args: { jobId: string; technicianId: string; approved: boolean }) => void; isPending: boolean };
  /* Email */
  onSendEmailForTech: (techId: string, isApproved?: boolean) => Promise<void>;
}

export function TechnicianPayoutCard({
  payout,
  jobId,
  isTourDate,
  isManager,
  profileMap,
  autonomoMap,
  getTechName,
  lpoMap,
  flexElementMap,
  buildFinDocUrl,
  techDaysMap,
  techTotalDaysMap,
  missingEmailTechIds,
  sendingByTech,
  getTechOverride,
  overrideActorMap,
  editingTechId,
  editingAmount,
  setEditingAmount,
  onStartEdit,
  onSaveOverride,
  onCancelEdit,
  onRemoveOverride,
  isSavingOverride,
  isRemovingOverride,
  toggleApprovalMutation,
  onSendEmailForTech,
}: TechnicianPayoutCardProps) {
  const techId = payout.technician_id;
  const techName = getTechName(techId);
  const profile = profileMap.get(techId);
  const autonomoStatus = autonomoMap.get(techId);
  const autonomoBadgeLabel = getAutonomoBadgeLabel(autonomoStatus);
  const isNonAutonomo = autonomoStatus === false;

  /* Deduction calc (standard jobs only) */
  let deduction = 0;
  let daysUsed = 0;
  if (isNonAutonomo && !isTourDate) {
    daysUsed = techDaysMap.get(techId) || (payout.timesheets_total_eur > 0 ? 1 : 0);
    deduction = daysUsed * NON_AUTONOMO_DEDUCTION_EUR;
  }
  const effectiveTotal = payout.total_eur - deduction;

  /* Override */
  const rawOverride = getTechOverride(techId);
  const actor = rawOverride?.set_by ? overrideActorMap.get(rawOverride.set_by) : null;
  const override = rawOverride
    ? {
        ...rawOverride,
        actor_name: actor?.name,
        actor_email: actor?.email ?? undefined,
      }
    : undefined;
  const isEditing = editingTechId === techId;

  /* Days warning */
  const totalDays = techTotalDaysMap.get(techId) || 0;
  const approvedDays = techDaysMap.get(techId) || 0;
  const showDaysWarning = !isTourDate && totalDays > 1 && approvedDays < totalDays;

  return (
    <div
      className={cn(
        'border rounded-lg p-4 space-y-3 transition-colors w-full min-w-0',
        surface,
        (!profile?.email || missingEmailTechIds.includes(techId)) &&
        'border-amber-400/70 bg-amber-500/10'
      )}
    >
      {/* Header row: info + controls */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        {/* Left: tech info */}
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-medium text-base">{techName}</h4>
            {autonomoBadgeLabel && (
              <Badge variant="destructive" className="flex items-center gap-1 text-xs">
                <AlertCircle className="h-3 w-3" />
                {autonomoBadgeLabel}
              </Badge>
            )}
          </div>
          <div className="flex flex-col gap-1 text-xs text-foreground/70 dark:text-muted-foreground break-words">
            <span>Trabajo: {payout.job_id}</span>
            <span>
              Correo:{' '}
              {profile?.email ? (
                profile.email
              ) : (
                <span className="text-amber-700 dark:text-amber-300 font-medium">Sin correo configurado</span>
              )}
            </span>
          </div>
          {!profile?.email && (
            <Badge
              variant="outline"
              className="mt-2 text-amber-600 border-amber-500/40 bg-amber-500/10 dark:text-amber-300"
            >
              Sin correo
            </Badge>
          )}
          {lpoMap.has(techId) && (
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <span>LPO N\u00ba: {lpoMap.get(techId) || '\u2014'}</span>
              {(() => {
                const elId = flexElementMap.get(techId) || null;
                const url = buildFinDocUrl(elId);
                if (!url) return null;
                return (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-primary hover:underline"
                    title="Abrir en Flex"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" /> Abrir en Flex
                  </a>
                );
              })()}
            </div>
          )}
        </div>

        {/* Right: approval toggle + total + send button */}
        <div className="text-right flex flex-col items-end gap-2 sm:min-w-[140px]">
          {!isTourDate && (
            <div className="flex items-center gap-2 mb-1 bg-muted p-1.5 rounded-md border border-border">
              <label htmlFor={`approve-${techId}`} className="text-xs text-muted-foreground cursor-pointer select-none">
                {payout.payout_approved ? 'Aprobado' : 'Pendiente'}
              </label>
              <Switch
                id={`approve-${techId}`}
                checked={!!payout.payout_approved}
                onCheckedChange={(checked) => toggleApprovalMutation.mutate({
                  jobId,
                  technicianId: techId,
                  approved: checked,
                })}
                disabled={toggleApprovalMutation.isPending}
              />
            </div>
          )}
          <div className="text-xl font-bold leading-tight">
            <div className="flex flex-col items-end">
              <span>{formatCurrency(effectiveTotal)}</span>
              {deduction > 0 && (
                <span className="text-[10px] text-red-400 font-normal">
                  (-{formatCurrency(deduction)} IRPF por alta obligatoria)
                </span>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSendEmailForTech(techId, payout.payout_approved)}
            disabled={
              sendingByTech[techId] ||
              (!isTourDate && !payout.payout_approved) ||
              !profile?.email
            }
            title={
              !isTourDate && !payout.payout_approved
                ? 'Aprueba el pago para habilitar el envío'
                : (profile?.email ? 'Enviar sólo a este técnico' : 'Sin correo configurado')
            }
            className={controlButton}
          >
            <Send className="h-3.5 w-3.5 mr-1" />
            {sendingByTech[techId] ? 'Enviando\u2026' : 'Enviar a este'}
          </Button>
        </div>
      </div>

      {/* Timesheets breakdown */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>Partes aprobados:</span>
          </div>
          <Badge variant={payout.timesheets_total_eur > 0 ? 'default' : 'secondary'}>
            {formatCurrency(payout.timesheets_total_eur)}
          </Badge>
        </div>
        {showDaysWarning && (
          <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded px-2 py-1">
            <AlertCircle className="h-3 w-3 shrink-0" />
            <span>
              Solo {approvedDays} de {totalDays} partes aprobados — el total puede no reflejar todos los días asignados
            </span>
          </div>
        )}

        {/* Extras breakdown */}
        {payout.extras_total_eur > 0 && (
          <>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
                <span>Extras del trabajo:</span>
              </div>
              <Badge variant="outline">
                {formatCurrency(payout.extras_total_eur)}
              </Badge>
            </div>

            {payout.extras_breakdown?.items && payout.extras_breakdown.items.length > 0 && (
              <div className="ml-6 space-y-1">
                {payout.extras_breakdown.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-xs text-muted-foreground">
                    <span>
                      {item.extra_type.replaceAll('_', ' ')} \u00d7 {item.quantity}
                    </span>
                    <span>{formatCurrency(item.amount_eur)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Expenses breakdown */}
        {payout.expenses_total_eur > 0 && (
          <>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-muted-foreground" />
                <span>Gastos aprobados:</span>
              </div>
              <Badge variant="outline">
                {formatCurrency(payout.expenses_total_eur)}
              </Badge>
            </div>

            {payout.expenses_breakdown && payout.expenses_breakdown.length > 0 && (
              <div className="ml-6 space-y-1">
                {payout.expenses_breakdown.map((category, idx) => {
                  const label = categoryLabels[category.category_slug] || category.category_slug;
                  const amount = category.approved_total_eur || 0;
                  if (amount <= 0) return null;
                  return (
                    <div key={idx} className="flex justify-between text-xs text-muted-foreground">
                      <span>{label}</span>
                      <span>{formatCurrency(amount)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Vehicle disclaimer */}
      {payout.vehicle_disclaimer && payout.vehicle_disclaimer_text && (
        <>
          <Separator className="border-border" />
          <div className="flex items-start gap-2 text-sm text-yellow-800 bg-yellow-500/10 p-3 rounded border border-yellow-500/30 dark:text-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30 w-full">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-yellow-600 dark:text-amber-300" />
            <span className="break-words whitespace-pre-wrap leading-snug w-full">
              {payout.vehicle_disclaimer_text.includes('Fuel/drive compensation')
                ? 'Puede aplicarse compensación de combustible/conducción al usar vehículo propio. Coordina con RR. HH. por cada trabajo.'
                : payout.vehicle_disclaimer_text}
            </span>
          </div>
        </>
      )}

      <Separator className="border-border" />

      {/* Payout Override Section (Admin/Management only) */}
      {isManager && (
        <JobPayoutOverrideSection
          override={override}
          isEditing={isEditing}
          techName={techName}
          calculatedTotalEur={payout.total_eur}
          editingAmount={editingAmount}
          onEditingAmountChange={setEditingAmount}
          onStartEdit={() => onStartEdit(techId, payout.total_eur)}
          onSave={() => onSaveOverride(techId, techName, payout.total_eur)}
          onCancel={onCancelEdit}
          onRemove={() => onRemoveOverride(techId)}
          isSaving={isSavingOverride}
          isRemoving={isRemovingOverride}
        />
      )}

      <Separator className="border-border" />

      {/* Final total */}
      <div className="flex items-center justify-between font-medium">
        <span>Total final:</span>
        <Badge variant="default" className="text-base px-3 py-1">
          {formatCurrency(getTechOverride(techId)?.override_amount_eur ?? effectiveTotal)}
        </Badge>
      </div>
    </div>
  );
}
