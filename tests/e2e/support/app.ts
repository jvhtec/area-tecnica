import type { Page, Request } from "@playwright/test";

type TestRole =
  | "admin"
  | "management"
  | "logistics"
  | "technician"
  | "house_tech"
  | "oscar";

type MockValue = unknown;
type MockResponder = MockValue | ((context: MockRequestContext) => MockValue | Promise<MockValue>);

interface MockRequestContext {
  body: unknown;
  method: string;
  request: Request;
  url: URL;
}

interface AuthSeed {
  guest?: boolean;
  userId?: string;
  email?: string;
  role?: TestRole;
  department?: string | null;
  assignableAsTech?: boolean;
  soundVisionAccess?: boolean;
}

interface SupabaseMockOptions {
  auth?: AuthSeed;
  tables?: Record<string, MockResponder>;
  rpc?: Record<string, MockResponder>;
  functions?: Record<string, MockResponder>;
}

export interface SupabaseCallLog {
  tableMutations: Array<{ table: string; method: string; body: unknown }>;
  rpcCalls: Array<{ name: string; method: string; body: unknown }>;
  functionCalls: Array<{ name: string; method: string; body: unknown }>;
}

const defaultAuth: Required<Omit<AuthSeed, "guest">> = {
  userId: "e2e-user",
  email: "e2e@example.com",
  role: "management",
  department: "sound",
  assignableAsTech: false,
  soundVisionAccess: false,
};

function buildUser(auth: Required<Omit<AuthSeed, "guest">>) {
  return {
    id: auth.userId,
    aud: "authenticated",
    role: "authenticated",
    email: auth.email,
    email_confirmed_at: new Date().toISOString(),
    phone: "",
    confirmed_at: new Date().toISOString(),
    last_sign_in_at: new Date().toISOString(),
    app_metadata: {
      provider: "email",
      providers: ["email"],
    },
    user_metadata: {
      role: auth.role,
      department: auth.department,
      assignable_as_tech: auth.assignableAsTech,
      soundvision_access_enabled: auth.soundVisionAccess,
    },
    identities: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function buildSession(auth: Required<Omit<AuthSeed, "guest">>) {
  const expiresIn = 60 * 60;
  const user = buildUser(auth);

  return {
    access_token: "e2e-access-token",
    refresh_token: "e2e-refresh-token",
    token_type: "bearer",
    expires_in: expiresIn,
    expires_at: Math.floor(Date.now() / 1000) + expiresIn,
    user,
  };
}

async function readRequestBody(request: Request) {
  const payload = request.postData();
  if (!payload) {
    return null;
  }

  try {
    return request.postDataJSON();
  } catch {
    return payload;
  }
}

function wantsObjectResponse(request: Request) {
  const acceptHeader = request.headers().accept ?? "";
  return acceptHeader.includes("application/vnd.pgrst.object+json");
}

function normalizePostgrestPayload(data: unknown, request: Request) {
  if (!wantsObjectResponse(request)) {
    return data;
  }

  if (Array.isArray(data)) {
    return data[0] ?? null;
  }

  return data;
}

async function resolveResponder(
  responder: MockResponder | undefined,
  fallbackValue: MockValue,
  context: MockRequestContext,
) {
  if (typeof responder === "function") {
    return await responder(context);
  }

  return responder ?? fallbackValue;
}

export async function seedAppState(page: Page, authOverrides: AuthSeed = {}) {
  await page.context().addInitScript((auth: AuthSeed & typeof defaultAuth) => {
    window.localStorage.clear();
    window.sessionStorage.clear();

    const registrationStub = {
      waiting: null,
      installing: null,
      active: null,
      update: async () => undefined,
      unregister: async () => true,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    };

    const serviceWorkerStub = {
      ready: Promise.resolve(registrationStub),
      controller: null,
      getRegistration: async () => registrationStub,
      getRegistrations: async () => [registrationStub],
      register: async () => registrationStub,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    };

    try {
      Object.defineProperty(navigator, "serviceWorker", {
        configurable: true,
        value: serviceWorkerStub,
      });
    } catch {
      // Ignore when the property cannot be replaced.
    }

    try {
      Object.defineProperty(window, "Notification", {
        configurable: true,
        value: {
          permission: "denied",
          requestPermission: async () => "denied",
        },
      });
    } catch {
      // Ignore when the property cannot be replaced.
    }

    window.open = () => null;

    if (auth.guest) {
      return;
    }

    const expiresIn = 60 * 60;
    const user = {
      id: auth.userId,
      aud: "authenticated",
      role: "authenticated",
      email: auth.email,
      email_confirmed_at: new Date().toISOString(),
      phone: "",
      confirmed_at: new Date().toISOString(),
      last_sign_in_at: new Date().toISOString(),
      app_metadata: {
        provider: "email",
        providers: ["email"],
      },
      user_metadata: {
        role: auth.role,
        department: auth.department,
        assignable_as_tech: auth.assignableAsTech,
        soundvision_access_enabled: auth.soundVisionAccess,
      },
      identities: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const session = {
      access_token: "e2e-access-token",
      refresh_token: "e2e-refresh-token",
      token_type: "bearer",
      expires_in: expiresIn,
      expires_at: Math.floor(Date.now() / 1000) + expiresIn,
      user,
    };

    const profileCache = {
      role: auth.role,
      department: auth.department,
      soundVisionAccess: auth.soundVisionAccess,
      assignableAsTech: auth.assignableAsTech,
      userId: auth.userId,
      timestamp: Date.now(),
    };

    window.localStorage.setItem("supabase.auth.token", JSON.stringify(session));
    window.localStorage.setItem("supabase_user_profile", JSON.stringify(profileCache));
  }, { ...defaultAuth, ...authOverrides });
}

export async function installSupabaseMocks(
  page: Page,
  { auth, tables = {}, rpc = {}, functions = {} }: SupabaseMockOptions = {},
) {
  const resolvedAuth = { ...defaultAuth, ...auth };
  const calls: SupabaseCallLog = {
    tableMutations: [],
    rpcCalls: [],
    functionCalls: [],
  };

  await page.context().route(/\/supabase\/(?:rest\/v1|auth\/v1|functions\/v1|storage\/v1)\//, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const body = await readRequestBody(request);
    const context: MockRequestContext = {
      body,
      method,
      request,
      url,
    };

    if (url.pathname.includes("/auth/v1/user")) {
      if (auth?.guest) {
        return route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({
            message: "Auth session missing",
          }),
        });
      }

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildUser(resolvedAuth)),
      });
    }

    if (url.pathname.includes("/auth/v1/logout")) {
      return route.fulfill({
        status: 204,
        body: "",
      });
    }

    if (url.pathname.includes("/auth/v1/token")) {
      if (auth?.guest) {
        return route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({
            message: "Refresh token missing",
          }),
        });
      }

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildSession(resolvedAuth)),
      });
    }

    if (url.pathname.includes("/rest/v1/rpc/")) {
      const name = url.pathname.split("/rest/v1/rpc/")[1] ?? "";
      calls.rpcCalls.push({ name, method, body });

      const data = await resolveResponder(rpc[name], {}, context);

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    }

    if (url.pathname.includes("/functions/v1/")) {
      const name = url.pathname.split("/functions/v1/")[1] ?? "";
      calls.functionCalls.push({ name, method, body });

      const data = await resolveResponder(functions[name], {}, context);

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    }

    if (url.pathname.includes("/storage/v1/object/sign/")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          signedURL: "/signed/receipt.pdf",
        }),
      });
    }

    if (url.pathname.includes("/rest/v1/")) {
      const table = url.pathname.split("/rest/v1/")[1] ?? "";
      if (method !== "GET" && method !== "HEAD") {
        calls.tableMutations.push({ table, method, body });
      }

      const fallbackValue = method === "GET" || method === "HEAD" ? [] : null;
      const data = await resolveResponder(tables[table], fallbackValue, context);

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(normalizePostgrestPayload(data, request)),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    });
  });

  return calls;
}

export async function bootstrapApp(page: Page, options: SupabaseMockOptions = {}) {
  await seedAppState(page, options.auth);
  return installSupabaseMocks(page, options);
}
