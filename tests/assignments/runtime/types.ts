// Test infrastructure only. These contracts describe the pinned Edge Runtime API.
export type Handler = (request: Request, ...context: unknown[]) => Response | Promise<Response>;
export type Serve = { (handler: Handler): unknown; (options: unknown, handler: Handler): unknown };
export type HttpEvent = { request: Request; respondWith(response: Response | Promise<Response>): Promise<void> };
export type HttpConnection = { nextRequest(): Promise<HttpEvent | null>; [Symbol.asyncIterator](): AsyncIterableIterator<HttpEvent> };
export type Worker = { key: string; fetch(request: Request): Promise<Response> };
export type Runtime = {
  Deno: {
    env: { get(name: string): string | undefined; toObject(): Record<string, string> };
    readTextFile(path: string): Promise<string>;
    serve: Serve;
    serveHttp?: (connection: unknown) => HttpConnection;
  };
  EdgeRuntime: {
    waitUntil(task: Promise<unknown>): void;
    applySupabaseTag(original: Request, forwarded: Request): void;
    userWorkers: { create(options: {
      servicePath: string; forceCreate: boolean; memoryLimitMb: number; workerTimeoutMs: number;
      noModuleCache: boolean; context: { useReadSyncFileAPI: boolean }; envVars: [string, string][];
    }): Promise<Worker> };
  };
};
export const runtime = globalThis as unknown as Runtime;
