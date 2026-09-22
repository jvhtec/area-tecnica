import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import SplashScreen from '@/components/SplashScreen';
import { WakeLockVideo } from '@/components/WakeLockVideo';
import { useLgScreensaverBlock } from '@/hooks/useLgScreensaverBlock';
import { WallboardApi, WallboardApiError } from '@/lib/wallboard-api';

import { WallboardActivePanel } from './components/WallboardActivePanel';
import { FooterLogo } from './components/FooterLogo';
import { Ticker } from './components/Ticker';
import {
  DEFAULT_HIGHLIGHT_TTL_SECONDS,
  DEFAULT_PANEL_DURATIONS,
  DEFAULT_PANEL_ORDER,
  DEFAULT_ROTATION_FALLBACK_SECONDS,
  DEFAULT_TICKER_SECONDS,
} from './config';
import { useWallboardPreset } from './hooks/useWallboardPreset';
import type {
  CalendarFeed,
  CrewAssignmentsFeed,
  JobsOverviewFeed,
  LogisticsItem,
  PanelKey,
  PendingActionsFeed,
  TickerMessage,
} from './types';
import { useWallboardAnnouncements } from './useWallboardAnnouncements';
import { useWallboardRotation } from './useWallboardRotation';

const MIN_REFRESH_INTERVAL_MS = 10_000;
const MAX_REFRESH_INTERVAL_MS = 60_000;

export function WallboardDisplay({
  presetSlug: propPresetSlug,
  skipSplash = false,
  wallboardApiToken,
  onFatalError,
}: {
  presetSlug?: string;
  skipSplash?: boolean;
  wallboardApiToken?: string;
  onFatalError?: (message?: string) => void;
} = {}) {
  const { presetSlug: urlPresetSlug } = useParams<{ presetSlug?: string }>();
  const presetSlug = propPresetSlug !== undefined ? propPresetSlug : urlPresetSlug;
  const effectiveSlug = (presetSlug?.trim() || 'default').toLowerCase();
  const isProduccionPreset = effectiveSlug === 'produccion';
  const isApiMode = Boolean(wallboardApiToken);

  useLgScreensaverBlock();

  const [isLoading, setIsLoading] = useState(!skipSplash);
  const [isAlien, setIsAlien] = useState(false);
  const [theme] = useState<'light' | 'dark'>('light');
  const [panelOrder, setPanelOrder] = useState<PanelKey[]>([...DEFAULT_PANEL_ORDER]);
  const [panelDurations, setPanelDurations] = useState<Record<PanelKey, number>>({ ...DEFAULT_PANEL_DURATIONS });
  const [rotationFallbackSeconds, setRotationFallbackSeconds] = useState(DEFAULT_ROTATION_FALLBACK_SECONDS);
  const [highlightTtlMs, setHighlightTtlMs] = useState(DEFAULT_HIGHLIGHT_TTL_SECONDS * 1000);
  const [tickerIntervalMs, setTickerIntervalMs] = useState(DEFAULT_TICKER_SECONDS * 1000);
  const [presetMessage, setPresetMessage] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [overview, setOverview] = useState<JobsOverviewFeed | null>(null);
  const [calendarData, setCalendarData] = useState<CalendarFeed | null>(null);
  const [crew, setCrew] = useState<CrewAssignmentsFeed | null>(null);
  const [pendingActions, setPendingActions] = useState<PendingActionsFeed | null>(null);
  const [logistics, setLogistics] = useState<LogisticsItem[] | null>(null);
  const [tickerMessages, setTickerMessages] = useState<TickerMessage[]>([]);
  const [highlightJobs, setHighlightJobs] = useState<Map<string, number>>(new Map());
  const [footerHeight, setFooterHeight] = useState(72);
  const [tickerHeight, setTickerHeight] = useState(32);
  const [panelPages, setPanelPages] = useState<Record<PanelKey, number>>({
    overview: 0,
    crew: 0,
    logistics: 0,
    pending: 0,
    calendar: 0,
  });

  useWallboardPreset({
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
  });

  const processAnnouncements = useWallboardAnnouncements(highlightTtlMs, setHighlightJobs, setTickerMessages);

  useWallboardRotation({
    crew,
    idx,
    logistics,
    overview,
    panelDurations,
    panelOrder,
    panelPages,
    rotationFallbackSeconds,
    setIdx,
    setPanelPages,
  });

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    let refreshQueued = false;
    const api = new WallboardApi(wallboardApiToken, effectiveSlug);
    const pollIntervalMs = Math.min(MAX_REFRESH_INTERVAL_MS, Math.max(MIN_REFRESH_INTERVAL_MS, tickerIntervalMs));

    const fetchSnapshot = async () => {
      try {
        const snapshot = await api.snapshot();
        if (cancelled) return;
        setOverview(snapshot.overview);
        setCalendarData(snapshot.calendar);
        setCrew(snapshot.crew);
        setPendingActions(snapshot.pending);
        setLogistics(snapshot.logistics.items);
        processAnnouncements(snapshot.announcements.announcements);
        setIsLoading(false);
      } catch (error) {
        if (cancelled) return;
        console.error('Wallboard snapshot fetch failed', error);
        if (error instanceof WallboardApiError && (error.status === 401 || error.status === 403)) {
          onFatalError?.('El token de acceso no es válido o ha caducado.');
        }
      }
    };

    const runFetch = async () => {
      if (cancelled) return;
      if (inFlight) {
        refreshQueued = true;
        return;
      }

      inFlight = true;
      try {
        await fetchSnapshot();
      } finally {
        inFlight = false;
        if (refreshQueued && !cancelled) {
          refreshQueued = false;
          void runFetch();
        }
      }
    };

    void runFetch();
    const pollId = window.setInterval(() => void runFetch(), pollIntervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(pollId);
    };
  }, [effectiveSlug, onFatalError, processAnnouncements, tickerIntervalMs, wallboardApiToken]);

  const activePanels = panelOrder.length ? panelOrder : DEFAULT_PANEL_ORDER;
  const safeIndex = activePanels.length ? idx % activePanels.length : 0;
  const currentPanel = activePanels[safeIndex] ?? 'overview';

  if (isLoading) {
    return <SplashScreen onComplete={() => setIsLoading(false)} />;
  }

  return (
    <div
      className={`min-h-screen ${
        isAlien
          ? 'bg-black text-[var(--alien-amber)] alien-scanlines alien-vignette'
          : theme === 'light'
            ? 'bg-zinc-100 text-zinc-900'
            : 'bg-black text-white'
      }`}
    >
      {presetMessage && (
        <div className="bg-amber-500/20 text-amber-200 text-sm text-center py-2">{presetMessage}</div>
      )}
      <div className="overflow-hidden" style={{ height: `calc(100vh - ${footerHeight + tickerHeight}px)` }}>
        <WallboardActivePanel
          calendarData={calendarData}
          crew={crew}
          current={currentPanel}
          highlightJobs={highlightJobs}
          isAlien={isAlien}
          isProduccionPreset={isProduccionPreset}
          logistics={logistics}
          overview={overview}
          panelPages={panelPages}
          pending={pendingActions}
          theme={theme}
        />
      </div>
      <Ticker
        messages={tickerMessages}
        bottomOffset={footerHeight}
        theme={theme}
        onMeasureHeight={setTickerHeight}
      />
      <FooterLogo onToggle={() => setIsAlien((value) => !value)} onMeasure={setFooterHeight} theme={theme} />
      <WakeLockVideo />
    </div>
  );
}
