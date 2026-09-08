export const FORBIDDEN_HOJA_DEFINITION_IDS = new Set([
  "702029c3-ba89-4304-98fe-fbc6fc695eb0",
  "4db54bad-b5fa-4c1f-85d4-525d991d7b62",
  "484249f0-6307-47a3-a782-6352ee5ef493",
]);

export type ProvisioningNodeState =
  | "planned"
  | "creating"
  | "persisted"
  | "needs_reconciliation"
  | "failed";

export interface ProvisioningNode {
  key: string;
  parentKey?: string;
  externalParentElementId?: string;
  payload: Record<string, unknown>;
  tracking: Record<string, unknown>;
}

export interface StoredProvisioningNode {
  key: string;
  state: ProvisioningNodeState;
  elementId?: string;
  trackingRowId?: string;
}

export interface ProvisioningStore {
  load(): Promise<StoredProvisioningNode[]>;
  markCreating(node: ProvisioningNode): Promise<void>;
  markRemoteElement(node: ProvisioningNode, elementId: string): Promise<void>;
  persistTracking(node: ProvisioningNode, elementId: string, parentTrackingId?: string): Promise<string | undefined>;
  markPersisted(node: ProvisioningNode, elementId: string, trackingRowId?: string): Promise<void>;
  markFailed(node: ProvisioningNode, safeError: Record<string, unknown>): Promise<void>;
  markNeedsReconciliation(node: ProvisioningNode, safeError: Record<string, unknown>): Promise<void>;
}

export class FlexProvisioningDeterministicError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FlexProvisioningDeterministicError";
  }
}

export class FlexProvisioningReconciliationError extends Error {
  constructor(public readonly nodeKey: string, message: string) {
    super(message);
    this.name = "FlexProvisioningReconciliationError";
  }
}

export const provisioningFailureStatus = (
  error: unknown,
  remoteWritePossible = true,
): "failed" | "needs_reconciliation" =>
  !remoteWritePossible || error instanceof FlexProvisioningDeterministicError
    ? "failed"
    : "needs_reconciliation";

const retryRecord = async (record: () => Promise<void>): Promise<void> => {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await record();
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
};

export async function executeProvisioningPlan(
  plan: ProvisioningNode[],
  store: ProvisioningStore,
  createRemote: (payload: Record<string, unknown>) => Promise<{ elementId?: string }>,
): Promise<{ created: number; adopted: number; skipped: number }> {
  const duplicateKeys = plan.filter((node, index) => plan.findIndex((candidate) => candidate.key === node.key) !== index);
  if (duplicateKeys.length) throw new Error(`Duplicate provisioning node key: ${duplicateKeys[0].key}`);

  const stored = new Map((await store.load()).map((node) => [node.key, node]));
  const resolvedElements = new Map<string, string>();
  const trackingRows = new Map<string, string>();
  for (const node of stored.values()) {
    if (node.trackingRowId) trackingRows.set(node.key, node.trackingRowId);
  }
  let created = 0;
  let adopted = 0;
  let skipped = 0;

  for (const node of plan) {
    const definitionId = node.payload.definitionId;
    if (typeof definitionId === "string" && FORBIDDEN_HOJA_DEFINITION_IDS.has(definitionId)) {
      throw new Error(`Deprecated Hoja definition is forbidden for node ${node.key}`);
    }

    const existing = stored.get(node.key);
    if (existing?.state === "persisted" && existing.elementId) {
      resolvedElements.set(node.key, existing.elementId);
      skipped += 1;
      continue;
    }

    if (
      (existing?.state === "creating" || existing?.state === "needs_reconciliation") &&
      !existing.elementId
    ) {
      throw new FlexProvisioningReconciliationError(
        node.key,
        `Remote outcome is ambiguous for ${node.key}; automatic replay was stopped`,
      );
    }

    const parentElementId = node.parentKey
      ? resolvedElements.get(node.parentKey) ?? stored.get(node.parentKey)?.elementId
      : node.externalParentElementId;
    if (node.parentKey && !parentElementId) throw new Error(`Missing parent ${node.parentKey} for ${node.key}`);
    const payload = parentElementId ? { ...node.payload, parentElementId } : node.payload;

    let elementId = existing?.elementId;
    if (!elementId) {
      await store.markCreating(node);
      let response: { elementId?: string };
      try {
        response = await createRemote(payload);
      } catch (error) {
        const safeError = {
          code: error instanceof FlexProvisioningDeterministicError
            ? "remote_request_rejected"
            : "ambiguous_remote_outcome",
          message: error instanceof Error ? error.message : "Flex request failed",
        };
        if (error instanceof FlexProvisioningDeterministicError) {
          await store.markFailed(node, safeError);
        } else {
          await store.markNeedsReconciliation(node, safeError);
        }
        throw error;
      }
      if (!response.elementId) {
        await store.markNeedsReconciliation(node, { code: "missing_element_id" });
        throw new FlexProvisioningReconciliationError(node.key, `Flex returned no elementId for ${node.key}`);
      }
      elementId = response.elementId;
      await retryRecord(() => store.markRemoteElement(node, elementId!));
      created += 1;
    } else {
      adopted += 1;
    }

    const parentTrackingId = node.parentKey ? trackingRows.get(node.parentKey) : undefined;
    const trackingRowId = await store.persistTracking(node, elementId, parentTrackingId);
    await store.markPersisted(node, elementId, trackingRowId);
    resolvedElements.set(node.key, elementId);
    if (trackingRowId) trackingRows.set(node.key, trackingRowId);
  }

  return { created, adopted, skipped };
}
