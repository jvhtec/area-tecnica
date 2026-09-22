// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useWallboardPreset } from './useWallboardPreset';

const { dbMaybeSingleMock, dbEqMock, presetConfigMock } = vi.hoisted(() => ({
  dbMaybeSingleMock: vi.fn(),
  dbEqMock: vi.fn(),
  presetConfigMock: vi.fn(),
}));

vi.mock('@/lib/wallboard-api', () => ({
  WallboardApi: class MockWallboardApi {
    presetConfig = presetConfigMock;
  },
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: dbEqMock.mockImplementation(() => ({
          maybeSingle: dbMaybeSingleMock,
        })),
      })),
    })),
  },
}));

const FETCHED_CONFIG = {
  panel_order: ['pending'],
  panel_durations: { pending: 47 },
  rotation_fallback_seconds: 19,
  highlight_ttl_seconds: 180,
  ticker_poll_interval_seconds: 31,
};

const createSetters = () => ({
  setPanelOrder: vi.fn(),
  setPanelDurations: vi.fn(),
  setRotationFallbackSeconds: vi.fn(),
  setHighlightTtlMs: vi.fn(),
  setTickerIntervalMs: vi.fn(),
  setPresetMessage: vi.fn(),
  setHighlightJobs: vi.fn(),
  setIdx: vi.fn(),
});

const renderPreset = ({
  effectiveSlug,
  isApiMode,
  isProduccionPreset = effectiveSlug === 'produccion',
}: {
  effectiveSlug: string;
  isApiMode: boolean;
  isProduccionPreset?: boolean;
}) => {
  const setters = createSetters();

  renderHook(() =>
    useWallboardPreset({
      effectiveSlug,
      isApiMode,
      isProduccionPreset,
      wallboardApiToken: isApiMode ? 'token-de-prueba' : undefined,
      ...setters,
    }),
  );

  return setters;
};

describe('useWallboardPreset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbEqMock.mockImplementation(() => ({ maybeSingle: dbMaybeSingleMock }));
  });

  it.each(['produccion', 'almacen', 'oficinas'])(
    'aplica la configuración obtenida por API para el slug %s',
    async (effectiveSlug) => {
      presetConfigMock.mockResolvedValueOnce({
        slug: effectiveSlug,
        config: FETCHED_CONFIG,
      });

      const setters = renderPreset({ effectiveSlug, isApiMode: true });

      await waitFor(() => {
        expect(presetConfigMock).toHaveBeenCalledTimes(1);
        expect(setters.setPanelOrder).toHaveBeenLastCalledWith(['pending']);
      });
      expect(setters.setPanelDurations).toHaveBeenLastCalledWith({
        overview: 19,
        crew: 19,
        logistics: 19,
        pending: 47,
        calendar: 19,
      });
      expect(setters.setRotationFallbackSeconds).toHaveBeenLastCalledWith(19);
      expect(setters.setHighlightTtlMs).toHaveBeenLastCalledWith(180_000);
      expect(setters.setTickerIntervalMs).toHaveBeenLastCalledWith(31_000);
      expect(setters.setPresetMessage).toHaveBeenLastCalledWith(null);
    },
  );

  it('aplica la configuración de base de datos al preset de producción', async () => {
    dbMaybeSingleMock.mockResolvedValueOnce({ data: FETCHED_CONFIG, error: null });

    const setters = renderPreset({ effectiveSlug: 'produccion', isApiMode: false });

    await waitFor(() => {
      expect(dbEqMock).toHaveBeenCalledWith('slug', 'produccion');
      expect(setters.setPanelOrder).toHaveBeenLastCalledWith(['pending']);
    });
  });

  it('mantiene el calendario como respaldo de producción si no existe preset', async () => {
    presetConfigMock.mockResolvedValueOnce({ slug: 'produccion', config: null });

    const setters = renderPreset({ effectiveSlug: 'produccion', isApiMode: true });

    await waitFor(() => {
      expect(setters.setPanelOrder).toHaveBeenLastCalledWith(['calendar']);
    });
    expect(setters.setPresetMessage).toHaveBeenLastCalledWith(
      'Wallboard de producción: solo calendario (configurable en Presets).',
    );
  });

  it('muestra en español el mensaje de respaldo de un preset inexistente', async () => {
    presetConfigMock.mockResolvedValueOnce({ slug: 'sala', config: null });

    const setters = renderPreset({ effectiveSlug: 'sala', isApiMode: true });

    await waitFor(() => {
      expect(setters.setPresetMessage).toHaveBeenLastCalledWith(
        'Usando la configuración predeterminada del wallboard (no existe "sala").',
      );
    });
  });
});
