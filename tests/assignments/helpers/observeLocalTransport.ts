import { localRequestSafety } from './localRequestSafety';

/** Prove the full HTTP body arrived before the SDK interprets a SQL/Auth error. */
export function observeLocalTransport(transport: typeof fetch, safety: ReturnType<typeof localRequestSafety>): typeof fetch {
  return (input, init) => safety.run(async () => {
    const response = await transport(input, init);
    await response.clone().arrayBuffer();
    return response;
  });
}
