import { useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { UnifiedSubscriptionManager } from "@/lib/unified-subscription-manager";
import { queryKeys } from "@/lib/react-query";

/**
 * Keeps the skill catalog (`skill_catalog`: settings, the matrix skills
 * filter, the profile skill picker) and the role mappings live, so a skill
 * created or edited by anyone shows up without a reload.
 */
export function useSkillCatalogRealtime(enabled = true) {
  const queryClient = useQueryClient();
  const manager = useMemo(() => UnifiedSubscriptionManager.getInstance(queryClient), [queryClient]);
  const ownerRef = useRef(`skill-catalog-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    if (!enabled) return;
    const owner = ownerRef.current;
    const filter = { event: "*", schema: "public" } as const;
    manager.subscribeToTable("skills", queryKeys.scope("skill_catalog"), filter, "low", { ownerRoute: owner });
    manager.subscribeToTable("role_skill_mapping", queryKeys.scope("role_skill_mappings"), filter, "low", {
      ownerRoute: owner,
    });
    return () => manager.cleanupRouteDependentSubscriptions(owner);
  }, [enabled, manager]);
}
