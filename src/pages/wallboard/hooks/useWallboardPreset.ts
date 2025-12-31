import type { Dispatch, SetStateAction } from 'react';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { WallboardApi } from '@/lib/wallboard-api';
import {
  PANEL_KEYS,
  DEFAULT_PANEL_DURATIONS,
  DEFAULT_PANEL_ORDER,
  DEFAULT_ROTATION_FALLBACK_SECONDS,
  DEFAULT_HIGHLIGHT_TTL_SECONDS,
  DEFAULT_TICKER_SECONDS,
  coerceSeconds,
  normalisePanelOrder,
} from '../config';
import type { PanelKey } from '../types';

type Params = {
  effectiveSlug: string;
  isApiMode: boolean;
  isProduccionPreset: boolean;
  wallboardApiToken?: string;
  setPanelOrder: Dispatch<SetStateAction<PanelKey[]>>;
  setPanelDurations: Dispatch<SetStateAction<Record<PanelKey, number>>>;
  setRotationFallbackSeconds: Dispatch<SetStateAction<number>>;
  setHighlightTtlMs: Dispatch<SetStateAction<number>>;
  setTickerIntervalMs: Dispatch<SetStateAction<number>>;
  setPresetMessage: Dispatch<SetStateAction<string | null>>;
  setHighlightJobs: Dispatch<SetStateAction<Map<string, number>>>;
  setIdx: Dispatch<SetStateAction<number>>;
};

export function useWallboardPreset({
  effectiveSlug,
  isApiMode,
  isProduccionPreset,
  wallboardApiToken,
  setPanelOrder,
  setPanelDurations,
  setRotationFallbackSeconds,
  setHighlightTtlMs,
  setTickerIntervalMs,
  setPresetMessage,
  setHighlightJobs,
  setIdx,
}: Params) {
  useEffect(() => {
    let cancelled = false;
    setPresetMessage(null);

    const loadPreset = async () => {
      let data: any = null;
      let error: any = null;

      console.log('🎨 [Wallboard] Loading preset configuration...', {
        effectiveSlug,
        isApiMode,
        isProduccionPreset,
        hasApiToken: !!wallboardApiToken,
      });

      if (isApiMode) {
        if (effectiveSlug === 'produccion') {
          console.log('🎯 [Wallboard] Using hardcoded produccion config (calendar-only)');
          setPanelOrder(['calendar']);
          setPanelDurations({
            overview: 12,
            crew: 12,
            logistics: 12,
            pending: 12,
            calendar: 600,
          });
          setRotationFallbackSeconds(600);
          setHighlightTtlMs(300 * 1000);
          setTickerIntervalMs(20 * 1000);
          setPresetMessage(null);
          setHighlightJobs(new Map());
          setIdx(0);
          return;
        }
        if (effectiveSlug === 'almacen') {
          console.log('🎯 [Wallboard] Using hardcoded almacen config');
          setPanelOrder(['logistics', 'overview', 'calendar']);
          setPanelDurations({
            overview: 15,
            crew: 12,
            logistics: 15,
            pending: 12,
            calendar: 30,
          });
          setRotationFallbackSeconds(15);
          setHighlightTtlMs(300 * 1000);
          setTickerIntervalMs(20 * 1000);
          setPresetMessage(null);
          setHighlightJobs(new Map());
          setIdx(0);
          return;
        }
        if (effectiveSlug === 'oficinas') {
          console.log('🎯 [Wallboard] Using hardcoded oficinas config');
          setPanelOrder(['overview', 'crew', 'logistics', 'pending', 'calendar']);
          setPanelDurations({
            overview: 15,
            crew: 15,
            logistics: 15,
            pending: 10,
            calendar: 30,
          });
          setRotationFallbackSeconds(15);
          setHighlightTtlMs(300 * 1000);
          setTickerIntervalMs(20 * 1000);
          setPresetMessage(null);
          setHighlightJobs(new Map());
          setIdx(0);
          return;
        }
      }

      if (isApiMode) {
        try {
          console.log('🌐 [Wallboard] Fetching preset via API...', { effectiveSlug });
          const api = new WallboardApi(wallboardApiToken as string);
          const response = await api.presetConfig();
          data = response.config;
          console.log('✅ [Wallboard] Preset fetched via API:', {
            slug: response.slug,
            panelOrder: data?.panel_order,
            panelDurations: data?.panel_durations,
          });
        } catch (err) {
          console.error('❌ [Wallboard] Failed to load preset config via API:', err);
          error = err;
        }
      } else {
        console.log('💾 [Wallboard] Fetching preset from database...', { effectiveSlug });
        const result = await supabase
          .from('wallboard_presets')
          .select('panel_order, panel_durations, rotation_fallback_seconds, highlight_ttl_seconds, ticker_poll_interval_seconds')
          .eq('slug', effectiveSlug)
          .maybeSingle();
        data = result.data;
        error = result.error;
        console.log('💾 [Wallboard] Database query result:', {
          hasData: !!data,
          hasError: !!error,
          panelOrder: data?.panel_order,
        });
      }

      if (cancelled) return;

      if (error) {
        console.error('❌ [Wallboard] Preset load error:', error);
      }

      if (error || !data) {
        if (isProduccionPreset) {
          setPanelOrder(['calendar']);
          setPanelDurations({
            overview: DEFAULT_PANEL_DURATIONS.overview,
            crew: DEFAULT_PANEL_DURATIONS.crew,
            logistics: DEFAULT_PANEL_DURATIONS.logistics,
            pending: DEFAULT_PANEL_DURATIONS.pending,
            calendar: 30,
          });
          setRotationFallbackSeconds(30);
          setHighlightTtlMs(DEFAULT_HIGHLIGHT_TTL_SECONDS * 1000);
          setTickerIntervalMs(DEFAULT_TICKER_SECONDS * 1000);
          setPresetMessage('Wallboard de producción: solo calendario (configurable en Presets).');
          setHighlightJobs(new Map());
          setIdx(0);
        } else {
          setPanelOrder([...DEFAULT_PANEL_ORDER]);
          setPanelDurations({ ...DEFAULT_PANEL_DURATIONS });
          setRotationFallbackSeconds(DEFAULT_ROTATION_FALLBACK_SECONDS);
          setHighlightTtlMs(DEFAULT_HIGHLIGHT_TTL_SECONDS * 1000);
          setTickerIntervalMs(DEFAULT_TICKER_SECONDS * 1000);
          setPresetMessage(
            `Using default wallboard preset${effectiveSlug !== 'default' ? ` (missing \"${effectiveSlug}\")` : ''}.`
          );
          setHighlightJobs(new Map());
          setIdx(0);
        }
        return;
      }

      const fallbackSeconds = coerceSeconds(data.rotation_fallback_seconds, DEFAULT_ROTATION_FALLBACK_SECONDS);
      const highlightSeconds = coerceSeconds(data.highlight_ttl_seconds, DEFAULT_HIGHLIGHT_TTL_SECONDS, 30, 3600);
      const tickerSeconds = coerceSeconds(data.ticker_poll_interval_seconds, DEFAULT_TICKER_SECONDS, 10, 600);
      const order = normalisePanelOrder(data.panel_order as string[] | null);
      const rawDurations = (data.panel_durations ?? {}) as Record<string, unknown>;
      const durations: Record<PanelKey, number> = { ...DEFAULT_PANEL_DURATIONS };
      PANEL_KEYS.forEach((key) => {
        durations[key] = coerceSeconds(rawDurations[key], fallbackSeconds);
      });

      console.log('✅ [Wallboard] Applying preset configuration:', {
        effectiveSlug,
        panelOrder: order,
        panelDurations: durations,
        rotationFallback: fallbackSeconds,
      });

      setPanelOrder(order);
      setPanelDurations(durations);
      setRotationFallbackSeconds(fallbackSeconds);
      setHighlightTtlMs(highlightSeconds * 1000);
      setTickerIntervalMs(tickerSeconds * 1000);
      setPresetMessage(null);
      setHighlightJobs(new Map());
      setIdx(0);
    };

    loadPreset();
    return () => {
      cancelled = true;
    };
  }, [effectiveSlug, isApiMode, isProduccionPreset, wallboardApiToken]);
}

