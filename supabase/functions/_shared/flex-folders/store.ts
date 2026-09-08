import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { ProvisioningStore } from "./engine.ts";

/** Creates the durable state transitions shared by every Flex provisioning plan. */
export const makeProvisioningStore = (
  supabase: SupabaseClient,
  operationId: string,
  persistTracking: ProvisioningStore["persistTracking"],
): ProvisioningStore => ({
  load: async () => {
    const { data, error } = await supabase.from("flex_provisioning_nodes")
      .select("semantic_key,state,element_id,tracking_row_id").eq("operation_id", operationId);
    if (error) throw error;
    return (data || []).map((row) => ({
      key: row.semantic_key,
      state: row.state,
      elementId: row.element_id || undefined,
      trackingRowId: row.tracking_row_id || undefined,
    }));
  },
  markCreating: async (node) => {
    const { error } = await supabase.from("flex_provisioning_nodes").upsert({
      operation_id: operationId,
      semantic_key: node.key,
      parent_key: node.parentKey,
      state: "creating",
      payload: node.payload,
    }, { onConflict: "operation_id,semantic_key" });
    if (error) throw error;
  },
  markRemoteElement: async (node, elementId) => {
    const { error } = await supabase.from("flex_provisioning_nodes").update({
      state: "needs_reconciliation",
      element_id: elementId,
      updated_at: new Date().toISOString(),
    }).eq("operation_id", operationId).eq("semantic_key", node.key);
    if (error) throw error;
  },
  persistTracking,
  markPersisted: async (node, elementId, trackingRowId) => {
    const { error } = await supabase.from("flex_provisioning_nodes").update({
      state: "persisted",
      element_id: elementId,
      tracking_row_id: trackingRowId || null,
      safe_error: null,
      updated_at: new Date().toISOString(),
    }).eq("operation_id", operationId).eq("semantic_key", node.key);
    if (error) throw error;
  },
  markFailed: async (node, safeError) => {
    const { error } = await supabase.from("flex_provisioning_nodes").update({
      state: "failed",
      safe_error: safeError,
      updated_at: new Date().toISOString(),
    }).eq("operation_id", operationId).eq("semantic_key", node.key);
    if (error) throw error;
  },
  markNeedsReconciliation: async (node, safeError) => {
    const { error } = await supabase.from("flex_provisioning_nodes").update({
      state: "needs_reconciliation",
      safe_error: safeError,
      updated_at: new Date().toISOString(),
    }).eq("operation_id", operationId).eq("semantic_key", node.key);
    if (error) throw error;
  },
});
