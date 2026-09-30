import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readRepoFile = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const sendStaffingEmail = readRepoFile("supabase/functions/send-staffing-email/index.ts");
const staffingClick = readRepoFile("supabase/functions/staffing-click/index.ts");
const staffingOrchestrator = readRepoFile("supabase/functions/staffing-orchestrator/index.ts");
const campaignFinalization = readRepoFile("supabase/functions/staffing-orchestrator/campaignFinalization.ts");
const staffingSweeper = readRepoFile("supabase/functions/staffing-sweeper/index.ts");
const staffingHook = readRepoFile("src/features/staffing/hooks/useStaffing.ts");
const assignJobDialog = readRepoFile("src/components/matrix/AssignJobDialog.tsx");
const assignmentStatusDialog = readRepoFile("src/components/matrix/AssignmentStatusDialog.tsx");
const matrixAssignmentRemoval = readRepoFile(
  "src/components/matrix/optimized-matrix-cell/useMatrixCellAssignmentRemoval.ts",
);
const driverAssignmentMigration = readRepoFile(
  "supabase/migrations/20260924134000_driver_assignment_delivery.sql",
);
const productionSchema = readRepoFile("supabase/migrations/00000000000000_production_schema.sql");

function indexOrFail(source: string, marker: string) {
  const index = source.indexOf(marker);
  expect(index, `missing marker: ${marker}`).toBeGreaterThanOrEqual(0);
  return index;
}

function expectOrdered(source: string, earlier: string, later: string) {
  expect(indexOrFail(source, earlier)).toBeLessThan(indexOrFail(source, later));
}

describe("Staffing Phase 1 characterization", () => {
  describe("request persistence and delivery ordering", () => {
    it("persists the staffing request before attempting external delivery", () => {
      expectOrdered(
        sendStaffingEmail,
        "// Step 5: Insert/update staffing request(s)",
        "// Step 6: Deliver via chosen channel",
      );
    });

    it("returns a delivery error without rolling back the persisted staffing request", () => {
      const deliverySection = sendStaffingEmail.slice(
        indexOrFail(sendStaffingEmail, "// Step 6: Deliver via chosen channel"),
      );

      expect(deliverySection).toContain("WhatsApp delivery failed");
      expect(deliverySection).toContain("Email delivery failed");
      expect(deliverySection).not.toMatch(
        /from\(["']staffing_requests["']\)[\s\S]{0,180}\.(?:delete|update)\(/,
      );
    });

    it("treats idempotency as persisted-request identity rather than proven delivery", () => {
      const start = indexOrFail(sendStaffingEmail, "// Idempotency check: prevent duplicate sends within 24h");
      const end = indexOrFail(sendStaffingEmail, "// Check required environment variables");
      const idempotencyBlock = sendStaffingEmail.slice(start, end);

      expect(idempotencyBlock).toContain(".from('staffing_requests')");
      expect(idempotencyBlock).toContain(".eq('idempotency_key', idempotency_key)");
      expect(idempotencyBlock).toContain("success: true");
      expect(idempotencyBlock).toContain("cached: true");
      expect(idempotencyBlock).not.toContain("staffing_events");
      expect(idempotencyBlock).not.toContain("email_sent");
      expect(idempotencyBlock).not.toContain("whatsapp_sent");
    });
  });

  describe("technician response ordering", () => {
    it("records the request response before any offer auto-assignment work", () => {
      expectOrdered(
        staffingClick,
        ".update({ status: newStatus })",
        "if (newStatus === 'confirmed' && row.phase === 'offer')",
      );
    });

    it("does not auto-assign availability confirmations", () => {
      expect(staffingClick).toContain(
        "if (newStatus === 'confirmed' && row.phase === 'offer')",
      );
      expect(staffingClick).not.toContain(
        "if (newStatus === 'confirmed' && row.phase === 'availability')",
      );
    });

    it("refuses to mutate a staffing request that is no longer pending", () => {
      expectOrdered(
        staffingClick,
        "if (row.status !== 'pending')",
        "const newStatus = action === "confirm" ? "confirmed" : "declined"",
      );
    });

    it("batch responses only transition still-pending rows in the matching tuple", () => {
      const start = indexOrFail(staffingClick, "if ((row as any)?.batch_id) {");
      const end = indexOrFail(staffingClick, "} else {", start);
      const batchUpdate = staffingClick.slice(start, end);

      expect(batchUpdate).toContain(".eq('batch_id', (row as any).batch_id)");
      expect(batchUpdate).toContain(".eq('job_id', row.job_id)");
      expect(batchUpdate).toContain(".eq('profile_id', row.profile_id)");
      expect(batchUpdate).toContain(".eq('phase', row.phase)");
      expect(batchUpdate).toContain(".eq('status', 'pending')");
    });

    it("can retain a confirmed offer when a post-response conflict blocks assignment", () => {
      const responseWrite = indexOrFail(staffingClick, ".update({ status: newStatus })");
      const conflictBranch = indexOrFail(staffingClick, "if (conflictCheck.conflict)");
      const assignmentWrite = indexOrFail(staffingClick, ".from('job_assignments')");

      expect(responseWrite).toBeLessThan(conflictBranch);
      expect(conflictBranch).toBeLessThan(assignmentWrite);

      const conflictBlock = staffingClick.slice(
        conflictBranch,
        indexOrFail(staffingClick, "} else {", conflictBranch),
      );
      expect(conflictBlock).toContain("auto_assign_skipped_conflict");
      expect(conflictBlock).not.toContain(".from('staffing_requests')");
    });

    it("writes the job assignment before creating its timesheets", () => {
      expectOrdered(
        staffingClick,
        ".upsert(assignmentData, { onConflict: 'job_id,technician_id' })",
        ".upsert(timesheetRows, { onConflict: 'job_id,technician_id,date' })",
      );
    });

    it("does not roll back a successful assignment when staffing timesheet creation fails", () => {
      const timesheetFailure = indexOrFail(staffingClick, "if (tsErr) {");
      const timesheetFailureBlock = staffingClick.slice(
        timesheetFailure,
        indexOrFail(staffingClick, "} else {", timesheetFailure),
      );

      expect(timesheetFailureBlock).toContain("Timesheet creation failed");
      expect(timesheetFailureBlock).not.toContain(".from('job_assignments')");
      expect(timesheetFailureBlock).not.toContain(".delete()");
    });

    it("keeps dry-hire acceptance assignment-only and marks tour-date timesheets schedule-only", () => {
      expect(staffingClick).toContain("if (jobType === 'dryhire')");
      expect(staffingClick).toContain("Skipping timesheet creation for dryhire job");
      expect(staffingClick).toContain("const isScheduleOnly = jobType === 'tourdate'");
      expect(staffingClick).toContain("is_schedule_only: isScheduleOnly");
    });

    it("treats Flex synchronization after staffing acceptance as best effort", () => {
      const timesheetWrite = indexOrFail(
        staffingClick,
        ".upsert(timesheetRows, { onConflict: 'job_id,technician_id,date' })",
      );
      const flexCall = indexOrFail(
        staffingClick,
        "/functions/v1/manage-flex-crew-assignments",
      );

      expect(timesheetWrite).toBeLessThan(flexCall);

      const flexSection = staffingClick.slice(flexCall - 250, flexCall + 850);
      expect(flexSection).toContain("try {");
      expect(flexSection).toContain("catch");
      expect(flexSection).toContain("non-blocking");
    });

    it("fails open when the acceptance-time existing-timesheet lookup errors", () => {
      expect(staffingClick).toContain("Failed to fetch timesheets for conflict check");
      expect(staffingClick).toContain(
        "const timesheetDates = !tsErr && Array.isArray(existingTimesheets) ? existingTimesheets : []",
      );
    });
  });

  describe("manual cancellation semantics", () => {
    it("maps manager cancellation to expired for every non-expired request in the phase", () => {
      expect(staffingHook).toContain("// Cancel ALL non-expired records (not just pending)");
      expect(staffingHook).toContain(".update({ status: 'expired' })");
      expect(staffingHook).toContain(".eq('job_id', payload.job_id)");
      expect(staffingHook).toContain(".eq('profile_id', payload.profile_id)");
      expect(staffingHook).toContain(".eq('phase', payload.phase)");
      expect(staffingHook).toContain(".neq('status', 'expired')");
    });
  });

  describe("direct assignment partial-commit behavior", () => {
    it("persists the base job assignment before per-date timesheet mutation", () => {
      const assignmentInsert = indexOrFail(assignJobDialog, ".from('job_assignments').insert(row)");
      const timesheetSection = indexOrFail(
        assignJobDialog,
        "// Handle timesheet updates based on whether we're modifying the selected job",
      );
      expect(assignmentInsert).toBeLessThan(timesheetSection);
    });

    it("does not transactionally roll back the base assignment when later timesheet operations fail", () => {
      const timesheetStart = indexOrFail(
        assignJobDialog,
        "// Handle timesheet updates based on whether we're modifying the selected job",
      );
      const verification = indexOrFail(
        assignJobDialog,
        "// Verification: ensure at least one assignment row now exists for this job/tech",
      );
      const timesheetSection = assignJobDialog.slice(timesheetStart, verification);

      expect(timesheetSection).toContain("throw new Error");
      expect(timesheetSection).not.toContain(".from('job_assignments')");
    });

    it("keeps confirmed assignments confirmed when a normal edit requests invited", () => {
      expect(assignJobDialog).toContain(
        "existingRow.status === 'confirmed' && basePayload.status !== 'confirmed' ? 'confirmed' : basePayload.status",
      );
    });

    it("represents multi-date coverage with active timesheets rather than one assignment_date value", () => {
      expect(assignJobDialog).toContain(
        "const desiredSingleDay = coverageMode !== 'full'",
      );
      expect(assignJobDialog).toContain(
        "const desiredAssignmentDate = desiredSingleDay ? coverageDates[0] ?? null : null",
      );
      expect(assignJobDialog).toContain("existingTimesheetDateKeys");
      expect(productionSchema).toContain(
        'COMMENT ON COLUMN "public"."job_assignments"."single_day" IS \'DEPRECATED:',
      );
      expect(productionSchema).toContain(
        'COMMENT ON COLUMN "public"."job_assignments"."assignment_date" IS \'DEPRECATED:',
      );
    });
  });

  describe("assignment lifecycle RPC usage", () => {
    it("routes assignment confirm/decline through manage_assignment_lifecycle", () => {
      expect(assignmentStatusDialog).toContain(
        "dataLayerClient.rpc('manage_assignment_lifecycle'",
      );
      expect(assignmentStatusDialog).toContain(
        "p_delete_mode: isTourAssignment ? 'hard' : 'soft'",
      );
    });

    it("uses hard lifecycle cancellation for full matrix removal", () => {
      expect(matrixAssignmentRemoval).toContain(
        "dataLayerClient.rpc('manage_assignment_lifecycle'",
      );
      expect(matrixAssignmentRemoval).toContain("p_action: 'cancel'");
      expect(matrixAssignmentRemoval).toContain("p_delete_mode: 'hard'");
    });

    it("allows one-date removal to delete only that timesheet", () => {
      expect(matrixAssignmentRemoval).toContain(".from('timesheets')");
      expect(matrixAssignmentRemoval).toContain(".eq('date', multiDateRemoval.currentDate)");
    });
  });

  describe("campaign semantics", () => {
    it("counts every non-declined job assignment toward role fill, including invited", () => {
      expect(staffingOrchestrator).toContain(
        "if (status === 'declined') return;",
      );
      expect(staffingOrchestrator).not.toContain(
        "if (status !== 'confirmed') return;",
      );
    });

    it("derives role stage from assignment, offer and availability capacity", () => {
      expect(staffingOrchestrator).toContain(
        "if (required <= 0 || assigned >= required)",
      );
      expect(staffingOrchestrator).toContain("stage = 'filled'");
      expect(staffingOrchestrator).toContain(
        "pendingOffersForCapacity > 0 || acceptedOffersNotAssigned > 0 || hasConfirmedAvailabilityForRole",
      );
      expect(staffingOrchestrator).toContain("stage = 'offer'");
      expect(staffingOrchestrator).toContain("stage = 'availability'");
    });

    it("only auto mode runs an immediate initial tick on campaign creation", () => {
      expect(staffingOrchestrator).toContain(
        "if (normalizedMode === 'auto' && campaignRoles.length > 0)",
      );
      expect(staffingOrchestrator).toContain(
        "initialTickResult = await tickCampaign(supabase, campaign.id)",
      );
    });

    it("a paused campaign can be nudged without being ticked", () => {
      const nudgeStart = indexOrFail(staffingOrchestrator, "async function nudgeCampaign");
      const nudgeEnd = indexOrFail(staffingOrchestrator, "// TICK action:", nudgeStart);
      const nudge = staffingOrchestrator.slice(nudgeStart, nudgeEnd);

      expect(nudge).toContain(
        "campaign.status !== 'active' && campaign.status !== 'paused'",
      );
      expectOrdered(
        nudge,
        "if (campaign.status !== 'active')",
        "const tickResult = await tickCampaign(supabase, campaign_id)",
      );
    });

    it("serializes campaign ticks with compare-and-swap locking and stale-lock recovery", () => {
      expect(staffingOrchestrator).toContain("if (lockAgeMin < 15)");
      expect(staffingOrchestrator).toContain("Recovering from stale lock");
      expect(staffingOrchestrator).toContain(".eq('run_lock', campaign.run_lock)");
      expect(staffingOrchestrator).toContain(".is('run_lock', null)");
      expect(staffingOrchestrator).toContain("Could not acquire lock");
    });

    it("keeps the sweeper service-role only and ticks campaigns sequentially", () => {
      expect(staffingSweeper).toContain("requireServiceRoleRequest");
      expect(staffingSweeper).toContain("for (const campaign of campaigns)");
      expect(staffingSweeper).toContain(
        "await fetch(`${ORCHESTRATOR_URL}?action=tick`",
      );
    });

    it("persists completion before sending the best-effort completion push", () => {
      expectOrdered(
        campaignFinalization,
        '.from("staffing_campaigns")',
        "await broadcastPush",
      );
      expect(campaignFinalization).toContain(
        'status: outcome.allFilled ? "completed" : "active"',
      );
      expect(campaignFinalization).toContain(
        "a push failure must not",
      );
    });
  });

  describe("conflict-check failure semantics", () => {
    it("hard-blocks a discovered exact timesheet collision", () => {
      expect(sendStaffingEmail).toContain(
        "CRITICAL: This check is NOT overridable - prevents real double-bookings",
      );
      expect(sendStaffingEmail).toContain(
        "Technician already has confirmed work on these dates",
      );
      expect(sendStaffingEmail).toContain("status: 409");
    });

    it("currently continues if the exact-timesheet collision query itself throws", () => {
      expect(sendStaffingEmail).toContain(
        "staffing_email.timesheet_check_encountered_an_error_continuing",
      );
    });
  });

  describe("driver workflow boundary", () => {
    it("keeps employee drivers outside staffing_requests and availability/offer campaigns", () => {
      expect(driverAssignmentMigration).toContain(
        "Drivers do NOT enter staffing_requests or the technician availability/offer campaign",
      );
      expect(driverAssignmentMigration).toContain(
        "Employees are assigned directly: there is no staffing availability/offer phase",
      );
      expect(driverAssignmentMigration).toContain(
        "Direct assignment remains the state machine: assigned -> confirmed/declined",
      );
    });

    it("treats known driver unavailability as an overrideable direct-assignment conflict", () => {
      expect(driverAssignmentMigration).toContain(
        "Known leave/unavailability is still a scheduling constraint",
      );
      expect(driverAssignmentMigration).toContain("p_force boolean");
      expect(driverAssignmentMigration).toContain(
        "return jsonb_build_object('status', 'conflict', 'conflicts', v_conflicts)",
      );
    });
  });
});
