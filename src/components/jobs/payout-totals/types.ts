import type { JobPayoutTotals } from '@/types/jobExtras';
import type { TourJobRateQuote } from '@/types/tourRates';
import type { TechnicianProfileWithEmail, JobPayoutEmailContextResult } from '@/lib/job-payout-email';
import type { JobPayoutOverride } from '../JobPayoutOverrideSection';

/* ── Style tokens ── */
export const cardBase = 'bg-card border-border text-card-foreground overflow-hidden';
export const surface = 'bg-muted/30 border-border';
export const subtleText = 'text-muted-foreground';
export const controlButton = 'variant-outline border-border';

/* ── Domain constant ── */
export const NON_AUTONOMO_DEDUCTION_EUR = 30;

/* ── Props ── */
export interface JobPayoutTotalsPanelProps {
  jobId: string;
  technicianId?: string;
}

/* ── Job metadata shape ── */
export interface JobMetadata {
  id: string;
  title: string;
  start_time: string;
  tour_id: string | null;
  rates_approved: boolean | null;
  job_type: string | null;
  invoicing_company: string | null;
}

/* ── Data returned by the consolidated data hook ── */
export interface JobPayoutData {
  jobMeta: JobMetadata | null | undefined;
  isTourDate: boolean;
  isLoading: boolean;
  error: Error | null;
  payoutTotals: JobPayoutTotals[];
  visibleTourQuotes: TourJobRateQuote[];
  tourTimesheetDays: Map<string, number>;
  profilesWithEmail: TechnicianProfileWithEmail[];
  profileMap: Map<string, TechnicianProfileWithEmail>;
  autonomoMap: Map<string, boolean | null>;
  getTechName: (id: string) => string;
  lpoMap: Map<string, string | null>;
  flexElementMap: Map<string, string | null>;
  buildFinDocUrl: (elementId: string | null | undefined) => string | null;
  techDaysMap: Map<string, number>;
  techTotalDaysMap: Map<string, number>;
  payoutOverrides: JobPayoutOverride[];
  overrideActorMap: Map<string, { name: string; email: string | null }>;
  getTechOverride: (techId: string) => JobPayoutOverride | undefined;
  calculatedGrandTotal: number;
  isManager: boolean;
  rehearsalDateSet: Set<string>;
  jobTimesheetDates: string[];
  allDatesMarked: boolean;
  toggleDateRehearsalMutation: { mutate: (args: { jobId: string; date: string; enabled: boolean }) => void; isPending: boolean };
  toggleAllDatesRehearsalMutation: { mutate: (args: { jobId: string; dates: string[]; enabled: boolean }) => void; isPending: boolean };
  standardPayoutTotals: JobPayoutTotals[];
}

/* ── Actions returned by the actions hook ── */
export interface PayoutActions {
  isExporting: boolean;
  isSendingEmails: boolean;
  sendingByTech: Record<string, boolean>;
  missingEmailTechIds: string[];
  previewOpen: boolean;
  previewContext: JobPayoutEmailContextResult | null;
  isLoadingPreview: boolean;
  editingTechId: string | null;
  editingAmount: string;
  setEditingAmount: (value: string) => void;
  handleExport: () => Promise<void>;
  handleSendEmails: () => Promise<void>;
  handlePreviewEmails: () => Promise<void>;
  handleSendEmailForTech: (techId: string, isApproved?: boolean) => Promise<void>;
  handleStartEdit: (techId: string, currentAmount: number) => void;
  handleSaveOverride: (techId: string, techName: string, calculatedTotal: number) => void;
  handleRemoveOverride: (techId: string) => void;
  handleCancelEdit: () => void;
  closePreview: () => void;
  setOverridePending: boolean;
  removeOverridePending: boolean;
  toggleApprovalMutation: { mutate: (args: { jobId: string; technicianId: string; approved: boolean }) => void; isPending: boolean };
}
