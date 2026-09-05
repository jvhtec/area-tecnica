import type { QueryClient } from "@tanstack/react-query";
import { getPrivateDataScope, setPrivateDataIdentity } from "@/lib/private-data-scope";

/** Coordinates imperative auth events before React exposes a new identity.
 * Session and profile revisions reject stale async responses independently:
 * refreshing a token must not invalidate otherwise current offline work. */
export class PrivateAuthBoundary {
  userId: string | null = null;
  sessionRevision = 0;
  private profileRevision = 0;

  constructor(private readonly queryClient: QueryClient) {}

  private setScope(userId: string | null, authorizationKey?: string) {
    const previous = getPrivateDataScope();
    setPrivateDataIdentity(userId, authorizationKey);
    if (previous !== getPrivateDataScope()) {
      void this.queryClient.cancelQueries();
      this.queryClient.clear();
    }
  }

  acceptSession(userId: string | null): boolean {
    this.sessionRevision += 1;
    const changed = this.userId !== userId;
    if (changed || getPrivateDataScope()?.userId !== userId) {
      this.profileRevision += 1;
      this.setScope(userId);
    }
    this.userId = userId;
    return changed;
  }

  beginProfile(userId: string) {
    if (this.userId !== userId) return null;
    const revision = ++this.profileRevision;
    const isCurrent = () => this.userId === userId && this.profileRevision === revision;
    return {
      isCurrent,
      apply: (role: string | null, department: string | null, soundVision: boolean, assignable: boolean) => {
        if (!isCurrent()) return false;
        this.setScope(userId, JSON.stringify([role, department, soundVision, assignable]));
        return true;
      },
    };
  }
}
