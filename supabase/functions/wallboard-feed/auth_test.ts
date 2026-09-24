import { create } from "https://deno.land/x/djwt@v3.0.2/mod.ts";
import type { createClient } from "npm:@supabase/supabase-js@2";
import { authenticate, authenticateSupabaseUser, HttpError } from "./auth.ts";

const SECRET = "wallboard-test-secret-with-enough-entropy";

function assertEquals(actual: unknown, expected: unknown, message: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`);
  }
}

async function expectHttpError(action: () => Promise<unknown>, status: number) {
  try {
    await action();
  } catch (error) {
    if (error instanceof HttpError && error.status === status) return;
    throw error;
  }
  throw new Error(`Expected HttpError ${status}`);
}

async function sign(payload: Record<string, unknown>) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return await create({ alg: "HS256", typ: "JWT" }, payload, key);
}

Deno.test("authenticate accepts only a valid scoped wallboard JWT", async () => {
  const validToken = await sign({ scope: "wallboard", preset: "produccion", exp: 4_102_444_800 });
  const validRequest = new Request("https://example.test/snapshot", {
    headers: { "x-wallboard-jwt": validToken },
  });
  const auth = await authenticate(validRequest, new URL(validRequest.url), {
    dependencies: { wallboardJwtSecret: SECRET },
  });
  assertEquals(auth, { method: "jwt", presetSlug: "produccion" }, "returns the scoped preset");

  const wrongScope = await sign({ scope: "other", exp: 4_102_444_800 });
  await expectHttpError(() => authenticate(
    new Request("https://example.test/snapshot", { headers: { "x-wallboard-jwt": wrongScope } }),
    new URL("https://example.test/snapshot"),
    { dependencies: { wallboardJwtSecret: SECRET } },
  ), 403);

  const expired = await sign({ scope: "wallboard", exp: 1 });
  await expectHttpError(() => authenticate(
    new Request("https://example.test/snapshot", { headers: { "x-wallboard-jwt": expired } }),
    new URL("https://example.test/snapshot"),
    { dependencies: { wallboardJwtSecret: SECRET } },
  ), 401);
});

Deno.test("authenticate gives an explicit wallboard header precedence over other credentials", async () => {
  const request = new Request("https://example.test/snapshot?wallboardToken=legacy", {
    headers: {
      "x-wallboard-jwt": "invalid",
      Authorization: "Bearer user-token",
    },
  });
  await expectHttpError(() => authenticate(request, new URL(request.url), {
    allowSupabaseUser: true,
    dependencies: {
      wallboardJwtSecret: SECRET,
      wallboardSharedToken: "legacy",
    },
  }), 401);
});

Deno.test("signed-in authorization uses the verified user's persisted profile role", async () => {
  const calls: string[] = [];
  const clientFactory = ((_: string, key: string) => {
    if (key === "anon-key") {
      return {
        auth: {
          getUser: async (token: string) => {
            calls.push(`getUser:${token}`);
            return { data: { user: { id: "user-1", user_metadata: { role: "admin" } } }, error: null };
          },
        },
      };
    }
    return {
      from: (table: string) => ({
        select: (columns: string) => ({
          eq: (column: string, value: string) => ({
            maybeSingle: async () => {
              calls.push(`${table}:${columns}:${column}:${value}`);
              return { data: { role: "management" }, error: null };
            },
          }),
        }),
      }),
    };
  }) as unknown as typeof createClient;

  const auth = await authenticateSupabaseUser("user-token", "almacen", {
    supabaseUrl: "https://example.supabase.co",
    supabaseAnonKey: "anon-key",
    supabaseServiceRoleKey: "service-key",
    createClient: clientFactory,
  });

  assertEquals(auth, { method: "user", presetSlug: "almacen" }, "allows the persisted management role");
  assertEquals(calls, [
    "getUser:user-token",
    "profiles:role:id:user-1",
  ], "verifies the user before reading only the persisted role");
});

Deno.test("signed-in authorization rejects missing and disallowed persisted roles", async () => {
  for (const profile of [null, { role: "technician" }]) {
    const clientFactory = ((_: string, key: string) => key === "anon-key"
      ? { auth: { getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }) } }
      : {
        from: () => ({
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: profile, error: null }) }),
          }),
        }),
      }) as unknown as typeof createClient;

    await expectHttpError(() => authenticateSupabaseUser("user-token", undefined, {
      supabaseUrl: "https://example.supabase.co",
      supabaseAnonKey: "anon-key",
      supabaseServiceRoleKey: "service-key",
      createClient: clientFactory,
    }), 403);
  }
});

Deno.test("legacy shared-token access remains explicit and preset-scoped", async () => {
  const request = new Request("https://example.test/snapshot?wallboardToken=legacy&preset=oficinas");
  const auth = await authenticate(request, new URL(request.url), {
    dependencies: { wallboardSharedToken: "legacy" },
  });
  assertEquals(auth, { method: "shared", presetSlug: "oficinas" }, "keeps the compatibility path scoped");
});
