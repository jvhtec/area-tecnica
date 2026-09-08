import { expect, it } from "vitest";
import {
  executeProvisioningPlan,
  FlexProvisioningDeterministicError,
  FlexProvisioningReconciliationError,
  provisioningFailureStatus,
  type ProvisioningStore,
  type StoredProvisioningNode,
} from "./engine.ts";

it("keeps failures before a possible remote write immediately retryable", () => {
  expect(provisioningFailureStatus(new Error("sequence allocation failed"), false)).toBe("failed");
  expect(provisioningFailureStatus(new Error("remote outcome unknown"), true)).toBe("needs_reconciliation");
});

it("classifies pre-write plan defects as deterministic", async () => {
  const { store } = makeStore();
  const duplicate = { key: "duplicate", payload: { definitionId: "allowed" }, tracking: {} };
  await expect(executeProvisioningPlan(
    [duplicate, duplicate],
    store,
    async () => ({ elementId: "unexpected" }),
  )).rejects.toBeInstanceOf(FlexProvisioningDeterministicError);
});

const makeStore = (initial: StoredProvisioningNode[] = []) => {
  const nodes = new Map(initial.map((node) => [node.key, { ...node }]));
  const store: ProvisioningStore = {
    load: async () => [...nodes.values()],
    markCreating: async (node) => { nodes.set(node.key, { key: node.key, state: "creating" }); },
    markRemoteElement: async (node, elementId) => { nodes.set(node.key, { key: node.key, state: "needs_reconciliation", elementId }); },
    persistTracking: async (node) => `row:${node.key}`,
    markPersisted: async (node, elementId) => { nodes.set(node.key, { key: node.key, state: "persisted", elementId }); },
    markFailed: async (node) => { nodes.set(node.key, { key: node.key, state: "failed" }); },
    markNeedsReconciliation: async (node) => { nodes.set(node.key, { key: node.key, state: "needs_reconciliation" }); },
  };
  return { nodes, store };
};

it("executor resumes known remote IDs without posting again", async () => {
  const { store } = makeStore([{ key: "root", state: "needs_reconciliation", elementId: "remote-root" }]);
  let posts = 0;
  const result = await executeProvisioningPlan(
    [{ key: "root", payload: { definitionId: "allowed" }, tracking: {} }],
    store,
    async () => { posts += 1; return { elementId: "duplicate" }; },
  );
  expect(posts).toBe(0);
  expect(result.adopted).toBe(1);
});

it("keeps a resumed parent's local tracking row for newly created children", async () => {
  const { store } = makeStore([{ key: "root", state: "persisted", elementId: "remote-root", trackingRowId: "local-root" }]);
  let insertedChild: { parent_id?: string } | undefined;
  store.persistTracking = async (node, _elementId, parentTrackingId) => {
    if (node.key === "child") insertedChild = { parent_id: parentTrackingId };
    return `row:${node.key}`;
  };
  await executeProvisioningPlan([
    { key: "root", payload: { definitionId: "allowed" }, tracking: {} },
    { key: "child", parentKey: "root", payload: { definitionId: "allowed" }, tracking: {} },
  ], store, async () => ({ elementId: "remote-child" }));
  expect(insertedChild).toEqual({ parent_id: "local-root" });
});

it("executor refuses blind replay after an interrupted remote call", async () => {
  for (const state of ["creating", "needs_reconciliation"] as const) {
    const { store } = makeStore([{ key: "root", state }]);
    await expect(executeProvisioningPlan(
        [{ key: "root", payload: { definitionId: "allowed" }, tracking: {} }],
        store,
        async () => ({ elementId: "duplicate" }),
      )).rejects.toBeInstanceOf(FlexProvisioningReconciliationError);
  }
});

it("keeps deterministic remote rejections replayable", async () => {
  const { nodes, store } = makeStore();
  await expect(executeProvisioningPlan(
    [{ key: "root", payload: { definitionId: "allowed" }, tracking: {} }],
    store,
    async () => { throw new FlexProvisioningDeterministicError("Flex returned HTTP 400"); },
  )).rejects.toBeInstanceOf(FlexProvisioningDeterministicError);
  expect(nodes.get("root")?.state).toBe("failed");

  await expect(executeProvisioningPlan(
    [{ key: "root", payload: { definitionId: "allowed" }, tracking: {} }],
    store,
    async () => ({ elementId: "remote-root" }),
  )).resolves.toEqual({ created: 1, adopted: 0, skipped: 0 });
});

it("executor rejects every deprecated Hoja definition", async () => {
  const forbidden = [
    "702029c3-ba89-4304-98fe-fbc6fc695eb0",
    "4db54bad-b5fa-4c1f-85d4-525d991d7b62",
    "484249f0-6307-47a3-a782-6352ee5ef493",
  ];
  for (const definitionId of forbidden) {
    const { store } = makeStore();
    await expect(executeProvisioningPlan(
      [{ key: "x", payload: { definitionId }, tracking: {} }],
      store,
      async () => ({ elementId: "x" }),
    )).rejects.toBeInstanceOf(FlexProvisioningDeterministicError);
  }
});
