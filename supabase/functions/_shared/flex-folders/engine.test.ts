import { expect, it } from "vitest";
import {
  executeProvisioningPlan,
  FlexProvisioningReconciliationError,
  type ProvisioningStore,
  type StoredProvisioningNode,
} from "./engine.ts";

const makeStore = (initial: StoredProvisioningNode[] = []) => {
  const nodes = new Map(initial.map((node) => [node.key, { ...node }]));
  const store: ProvisioningStore = {
    load: async () => [...nodes.values()],
    markCreating: async (node) => { nodes.set(node.key, { key: node.key, state: "creating" }); },
    markRemoteElement: async (node, elementId) => { nodes.set(node.key, { key: node.key, state: "needs_reconciliation", elementId }); },
    persistTracking: async (node) => `row:${node.key}`,
    markPersisted: async (node, elementId) => { nodes.set(node.key, { key: node.key, state: "persisted", elementId }); },
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
    )).rejects.toThrow("Deprecated Hoja definition");
  }
});
