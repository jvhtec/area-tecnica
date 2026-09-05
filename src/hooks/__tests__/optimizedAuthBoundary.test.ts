import { afterEach, describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { PrivateAuthBoundary } from "../optimizedAuthBoundary";
import { capturePrivateDataScope, getPrivateDataScope, setPrivateDataIdentity } from "@/lib/private-data-scope";

describe("private auth boundary", () => {
  afterEach(() => setPrivateDataIdentity(null));

  it("clears query data and aborts old work before exposing the next identity", () => {
    const queries = new QueryClient();
    const boundary = new PrivateAuthBoundary(queries);
    boundary.acceptSession("account-a");
    boundary.beginProfile("account-a")!.apply("management", "sound", false, false);
    queries.setQueryData(["vacation-requests"], ["account A private data"]);
    const oldScope = capturePrivateDataScope();
    boundary.acceptSession("account-b");
    expect(queries.getQueryData(["vacation-requests"])).toBeUndefined();
    expect(oldScope.signal.aborted).toBe(true);
    expect(getPrivateDataScope()?.userId).toBe("account-b");
  });

  it("rejects a late profile response across A to B to A", () => {
    const boundary = new PrivateAuthBoundary(new QueryClient());
    boundary.acceptSession("account-a");
    const oldRequest = boundary.beginProfile("account-a")!;
    boundary.acceptSession("account-b");
    boundary.acceptSession("account-a");
    expect(oldRequest.apply("admin", "sound", true, true)).toBe(false);
    expect(getPrivateDataScope()?.authorizationKey).toBe("unresolved");
  });

  it("invalidates privileged data on role change but keeps the scope on token refresh", () => {
    const queries = new QueryClient();
    const boundary = new PrivateAuthBoundary(queries);
    boundary.acceptSession("account-a");
    boundary.beginProfile("account-a")!.apply("management", "sound", false, false);
    const scope = capturePrivateDataScope();
    queries.setQueryData(["private"], "manager data");
    boundary.acceptSession("account-a");
    boundary.beginProfile("account-a")!.apply("management", "sound", false, false);
    expect(capturePrivateDataScope()).toBe(scope);
    expect(queries.getQueryData(["private"])).toBe("manager data");
    boundary.beginProfile("account-a")!.apply("technician", "sound", false, false);
    expect(scope.signal.aborted).toBe(true);
    expect(queries.getQueryData(["private"])).toBeUndefined();
  });
});
