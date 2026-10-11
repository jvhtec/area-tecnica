import assert from "node:assert/strict";
import type { SupabaseCallLog } from "./app";

type Body = Record<string, unknown>;
export interface PairState {
  exists: boolean;
  assignment: Body | null;
  dates: string[];
  state_token: string;
}
interface Entry {
  packet: Body;
  prior: PairState;
  result: Body;
  deadline: string;
  cancelled: boolean;
  released: boolean;
  undoable: boolean;
}
const bodyOf = (body: unknown): Body => {
  assert.ok(typeof body === "object" && body !== null);
  return body as Body;
};
const commandId = (body: Body) => {
  assert.equal(typeof body.p_command_id, "string");
  return body.p_command_id as string;
};

export const assignmentEffects = (jobId: string, id: string) => [
  { kind: "flex", action: "add", job_id: jobId, department: "sound", status: "pending", effect_id: `${id}:0` },
  { kind: "notification", action: "job.assignment.direct", job_id: jobId, status: "pending", effect_id: `${id}:1` },
];

/** Server ledger for these browser fixtures; reads and replays never extend a hold. */
export function assignmentCommandLedger(options: {
  read: (technicianId: string) => PairState;
  restore: (technicianId: string, prior: PairState) => void;
  now?: () => number;
}) {
  const now = options.now ?? Date.now;
  const entries = new Map<string, Entry>();
  const entry = (id: string) => {
    const stored = entries.get(id);
    assert.ok(stored, `Unknown command ${id}`);
    return stored;
  };
  const commit = (packet: Body, mutate: () => Body, undoable = true): Body => {
    const id = commandId(packet);
    const stored = entries.get(id);
    if (stored) {
      assert.deepEqual(packet, stored.packet, "A replay must keep the original packet");
      return { ...structuredClone(stored.result), replayed: true };
    }
    const prior = structuredClone(options.read(String(packet.p_technician_id)));
    const result = mutate();
    if (!result.ok || result.outcome !== "committed") return result;
    entries.set(id, {
      packet: structuredClone(packet), prior, result: structuredClone(result),
      deadline: new Date(now() + 8_000).toISOString(), cancelled: false, released: false, undoable,
    });
    return result;
  };
  const rpc = {
    get_assignment_command_undo_window: ({ body }: { body: unknown }) => {
      const packet = bodyOf(body);
      const id = commandId(packet);
      assert.deepEqual(packet, { p_command_id: id });
      const stored = entry(id);
      return { eligible: stored.undoable && !stored.cancelled && !stored.released && Date.parse(stored.deadline) > now(), undo_expires_at: stored.deadline };
    },
    release_assignment_command_effects: ({ body }: { body: unknown }) => {
      const packet = bodyOf(body);
      const id = commandId(packet);
      assert.deepEqual(packet, { p_command_id: id });
      const stored = entry(id);
      if (stored.cancelled) return { released: false };
      stored.released = true;
      return { released: true };
    },
    undo_assignment_command: ({ body }: { body: unknown }) => {
      const packet = bodyOf(body);
      const id = commandId(packet);
      const replay = entries.get(id);
      if (replay) {
        assert.deepEqual(packet, replay.packet);
        return { ...structuredClone(replay.result), replayed: true };
      }
      const originalId = String(packet.p_original_command_id);
      const original = entry(originalId);
      assert.notEqual(id, originalId);
      assert.deepEqual(packet, {
        p_command_id: id, p_original_command_id: originalId,
        p_expected_state_token: original.result.state_token, p_prior_state: original.prior,
      });
      assert.ok(original.undoable && !original.cancelled && !original.released && Date.parse(original.deadline) > now(), "Undo requires the original open hold");
      const technicianId = String(original.result.technician_id);
      assert.equal(options.read(technicianId).state_token, packet.p_expected_state_token);
      options.restore(technicianId, structuredClone(original.prior));
      assert.deepEqual(options.read(technicianId), original.prior, "Undo must restore the complete prior decision");
      const result = {
        ok: true, outcome: "committed", command_id: id, job_id: original.result.job_id,
        technician_id: technicianId, state_token: original.prior.state_token, replayed: false,
        assignment: structuredClone(original.prior.assignment), dates: [...original.prior.dates],
        side_effects: assignmentEffects(String(original.result.job_id), id).map((effect) => ({ ...effect, status: "superseded" })), warnings: [],
      };
      original.cancelled = true;
      original.result.side_effects = (original.result.side_effects as Body[]).map((effect) => ({ ...effect, status: "superseded" }));
      entries.set(id, {
        packet: structuredClone(packet), prior: structuredClone(original.prior), result,
        deadline: original.deadline, cancelled: true, released: false, undoable: false,
      });
      return result;
    },
    claim_assignment_side_effects: ({ body }: { body: unknown }) => {
      const stored = entry(commandId(bodyOf(body)));
      assert.ok(stored.released && !stored.cancelled, "Claim must follow release and cannot claim either undone plan");
      return { claim_token: "claim-1", effects: (stored.result.side_effects as Body[]).map((effect, index) => ({ ...effect, index })) };
    },
    record_assignment_side_effects: { ok: true },
  };
  return { commit, entry, rpc };
}

export function assertAtomicUndo(calls: SupabaseCallLog, ledger: ReturnType<typeof assignmentCommandLedger>, originalId: string) {
  const requests = calls.rpcCalls.filter((call) => call.name === "undo_assignment_command" && bodyOf(call.body).p_original_command_id === originalId);
  assert.equal(requests.length, 1, "One atomic undo RPC per original command");
  const packet = bodyOf(requests[0].body);
  const original = ledger.entry(originalId);
  assert.deepEqual(packet, {
    p_command_id: commandId(packet), p_original_command_id: originalId,
    p_expected_state_token: original.result.state_token, p_prior_state: original.prior,
  });
  assert.ok(original.cancelled && ledger.entry(commandId(packet)).cancelled, "Both effect plans must be cancelled");
  assert.ok(!calls.rpcCalls.some((call) => ["supersede_assignment_side_effects", "unconfirm_assignment", "remove_direct_assignment", "remove_assignment_date", "change_assignment_role"].includes(call.name)), "Undo must not issue separate inverse or supersede RPCs");
}

export function assertNoAssignmentEffects(calls: SupabaseCallLog) {
  assert.ok(!calls.rpcCalls.some((call) => call.name === "claim_assignment_side_effects"));
  assert.ok(!calls.functionCalls.some((call) => ["push", "manage-flex-crew-assignments"].includes(call.name)));
}
