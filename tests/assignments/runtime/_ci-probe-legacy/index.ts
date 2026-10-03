import '../outbound.ts';
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { runtime } from '../types.ts';

serve(async request => {
  const params = new URL(request.url).searchParams;
  const id = params.get('id');
  const base = `http://${runtime.Deno.env.get('CI_STACK_ID')}-gateway:8000/_ci-capture`;
  const mode = params.get('mode') ?? 'deferred';
  if (mode === 'status500' || mode === 'status503') return Response.json({ handled: true }, { status: Number(mode.slice(-3)) });
  if (mode === 'ignored' || mode === 'cancel' || mode === 'parse-error') {
    const response = await fetch(`${base}/probe?mode=${mode === 'parse-error' ? 'plain' : 'status503'}`);
    if (mode === 'cancel') await response.body?.cancel();
    if (mode === 'parse-error') { try { await response.json(); } catch { /* Complete receipt, malformed JSON. */ } }
    return Response.json({ handled: true });
  }
  if (mode === 'abort' || mode === 'truncated' || mode === 'timeout') {
    try {
      const response = await fetch(`${base}/probe?mode=${mode === 'abort' ? 'delay' : mode}`,
        mode === 'abort' ? { signal: AbortSignal.timeout(25) } : undefined);
      await response.text();
    } catch { /* Deliberately handled transport failure must still block cleanup. */ }
    return Response.json({ handled: true });
  }
  if (!id || !/^[a-f0-9-]{36}$/.test(id)) return new Response(null, { status: 400 });
  runtime.EdgeRuntime.waitUntil((async () => {
    for (;;) {
      const response = await fetch(`${base}/gate?id=${id}`);
      if ((await response.json()).released) break;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    const response = await fetch(`${base}/marker?id=${id}`, { method: 'POST' });
    await response.body?.cancel();
  })());
  return Response.json({ accepted: true });
});
