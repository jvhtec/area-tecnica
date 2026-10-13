import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHttpHandler } from '../../_shared/http.ts';
import { createPlaceSearchHandler } from '../handler.ts';
import { logEvent } from '../../_shared/structuredLogger.ts';

vi.mock('../../_shared/structuredLogger.ts', () => ({ logEvent: vi.fn() }));

const getUser = vi.fn();
const rpc = vi.fn();
const fetchMock = vi.fn();
const supabase = { auth: { getUser }, rpc } as unknown as SupabaseClient;
const handler = createHttpHandler(createPlaceSearchHandler(supabase, 'server-key'));
const request = (body: unknown = { query: 'WiZink Center Madrid' }, auth = true) => new Request('https://test/place-search', {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: 'Bearer user-token' } : {}) },
  body: JSON.stringify(body),
});
beforeEach(() => {
  vi.mocked(logEvent).mockClear();
  getUser.mockReset().mockResolvedValue({ data: { user: { id: 'user-id' } }, error: null });
  rpc.mockReset().mockResolvedValue({ data: true, error: null });
  fetchMock.mockReset().mockResolvedValue(new Response(JSON.stringify({ places: [{ id: 'google-id',
    displayName: { text: 'WiZink Center' }, formattedAddress: 'Madrid', location: { latitude: 40, longitude: -3 } }] })));
  vi.stubGlobal('fetch', fetchMock);
});
describe('authenticated Google venue search', () => {
  it('searches names with a broad bias without business/country restrictions and returns coordinates in the job contract', async () => {
    const response = await handler(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ places: [{ place_id: 'google-id', name: 'WiZink Center',
      address: 'Madrid', coordinates: { lat: 40, lng: -3 } }] });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://places.googleapis.com/v1/places:searchText');
    expect(JSON.parse(options.body)).toEqual({ textQuery: 'WiZink Center Madrid', pageSize: 6, languageCode: 'es',
      locationBias: { rectangle: { low: { latitude: -90, longitude: -90 }, high: { latitude: 90, longitude: 90 } } } });
    expect(options.headers['X-Goog-FieldMask']).toBe('places.id,places.displayName,places.formattedAddress,places.location');
    expect(rpc).toHaveBeenCalledWith('consume_external_api_dual_quota', expect.objectContaining({
      p_user_actor_id: 'user-id', p_user_service: 'google_places', p_global_service: 'google_places_global',
    }));
  });
  it('uses a viewport Google accepts (at most 180 degrees wide)', async () => {
    fetchMock.mockImplementation(async (_url, options) => {
      const { low, high } = JSON.parse(options.body).locationBias.rectangle;
      if (high.longitude - low.longitude > 180) {
        return new Response(JSON.stringify({ error: { status: 'INVALID_ARGUMENT',
          message: 'Invalid rectangle viewport. The rectangle viewport cannot be wider than 180.' } }), { status: 400 });
      }
      return new Response(JSON.stringify({ places: [] }));
    });
    expect((await handler(request())).status).toBe(200);
  });

  it('rejects missing and invalid authentication before spending Google quota', async () => {
    expect((await handler(request({}, false))).status).toBe(401);
    getUser.mockResolvedValue({ data: { user: null }, error: new Error('invalid') });
    expect((await handler(request())).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled(); expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([{ query: '' }, { query: 'x' }, { query: 'x'.repeat(201) }, { query: 12 }, []])('rejects malformed input %j before quota', async (body) => {
    expect((await handler(request(body))).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled(); expect(fetchMock).not.toHaveBeenCalled();
  });
  it('fails closed if the shared quota is exhausted or unavailable', async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    expect((await handler(request())).status).toBe(429);
    rpc.mockResolvedValue({ data: null, error: new Error('db') });
    expect((await handler(request())).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('records the provider rejection without recording credentials or the venue query', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: {
      status: 'INVALID_ARGUMENT',
      message: 'Invalid viewport for WiZink Center Madrid; key server-key',
    } }), { status: 400 }));
    const response = await handler(request());
    expect(response.status).toBe(502);
    expect(logEvent).toHaveBeenCalledWith('error', 'place_search.provider_rejected', {
      upstream_status: 400,
      upstream_code: 'INVALID_ARGUMENT',
      upstream_summary: 'Invalid viewport for [REDACTED_QUERY]; key [REDACTED]',
    });
    expect(JSON.stringify(vi.mocked(logEvent).mock.calls)).not.toContain('server-key');
    expect(JSON.stringify(vi.mocked(logEvent).mock.calls)).not.toContain('WiZink Center Madrid');
    expect(await response.text()).not.toContain('Invalid viewport');
  });

  it('returns an empty list for no matches and sanitizes upstream failures', async () => {
    fetchMock.mockResolvedValue(new Response('{}'));
    expect(await (await handler(request())).json()).toEqual({ places: [] });
    fetchMock.mockResolvedValue(new Response('private provider error server-key', { status: 403 }));
    const response = await handler(request());
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain('server-key');
  });
});
