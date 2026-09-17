import { dataLayerClient } from "@/services/dataLayerClient";

type ExpenseDecisionInput = {
  jobId: string;
  expenseId: string;
  approved: boolean;
  technicianId?: string | null;
  amountEur?: number | null;
  rejectionReason?: string;
};

/**
 * Tells a technician that their expense was decided.
 *
 * Deliberately fire-and-forget: the decision is already durable once the
 * approve_job_expense RPC returns, so a push failure must never surface as a
 * failed approval.
 */
export function notifyExpenseDecision(input: ExpenseDecisionInput): void {
  void dataLayerClient.functions
    .invoke("push", {
      body: {
        action: "broadcast",
        type: input.approved ? "expense.approved" : "expense.rejected",
        job_id: input.jobId,
        expense_id: input.expenseId,
        technician_id: input.technicianId ?? undefined,
        recipient_id: input.technicianId ?? undefined,
        amount_eur: input.amountEur ?? undefined,
        rejection_reason: input.approved ? undefined : input.rejectionReason,
      },
    })
    .catch(() => undefined);
}
