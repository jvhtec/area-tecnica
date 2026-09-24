import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import SplashScreen from '@/components/SplashScreen';
import { WakeLockVideo } from '@/components/WakeLockVideo';
import { useLgScreensaverBlock } from '@/hooks/useLgScreensaverBlock';
import { WallboardApi, WallboardApiError } from '@/lib/wallboard-api';

import { WallboardActivePanel } from './components/WallboardActivePanel';
import { WallboardHeader } from './components/WallboardHeader';
import { Ticker } from './components/Ticker';
import {
  DEFAULT_HIGHLIGHT_TTL_SECONDS,
  DEFAULT_PANEL_DURATIONS,
  DEFAULT_PANEL_ORDER,
  DEFAULT_ROTATION_FALLBACK_SECONDS,
  DEFAULT_TICKER_SECONDS,
  PANEL_TITLES,
} from './config';
import { formatDateKeyRange } from './format';
import { getDocJobs, getPanelPageCount } from './model';
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
import { formatMadridDateKey } from '@/utils/timezoneUtils';
import './wallboard.css';

const MIN_REFRESH_INTERVAL_MS = 10_000;
const MAX_REFRESH_INTERVAL_MS = 60_000;
const CLOCK_TICK_MS = 30_000;

const EMPTY_PAGES: Record<PanelKey, number> = {
  overview: 0,
  docs: 0,
  crew: 0,
  logistics: 0,
  pending: 0,
  calendar: 0,
};

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
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [panelPages, setPanelPages] = useState<Record<PanelKey, number>>({ ...EMPTY_PAGES });

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
    pending: pendingActions,
    panelDurations,
    panelOrder,
    panelPages,
    rotationFallbackSeconds,
    setIdx,
    setPanelPages,
  });

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  const pollIntervalMs = Math.min(MAX_REFRESH_INTERVAL_MS, Math.max(MIN_REFRESH_INTERVAL_MS, tickerIntervalMs));

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    let refreshQueued = false;
    const api = new WallboardApi(wallboardApiToken, effectiveSlug);

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
        const generatedAt = new Date(snapshot.generatedAt).getTime();
        setLastUpdatedAt(Number.isFinite(generatedAt) ? Math.min(generatedAt, Date.now()) : Date.now());
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
  }, [effectiveSlug, onFatalError, pollIntervalMs, processAnnouncements, wallboardApiToken]);

  const activePanels = panelOrder.length ? panelOrder : DEFAULT_PANEL_ORDER;
  const safeIndex = activePanels.length ? idx % activePanels.length : 0;
  const currentPanel = activePanels[safeIndex] ?? 'overview';

  if (isLoading) {
    return <SplashScreen onComplete={() => setIsLoading(false)} />;
  }

  const pages = getPanelPageCount(currentPanel, { overview, crew, logistics, pending: pendingActions });
  const pageLabel = pages > 1 ? `página ${(panelPages[currentPanel] ?? 0) + 1} de ${pages}` : null;
  const subtitle = (() => {
    switch (currentPanel) {
      case 'overview': {
        const count = overview?.jobs.length ?? 0;
        return [`${count} ${count === 1 ? 'trabajo' : 'trabajos'}`, pageLabel].filter(Boolean).join(' · ');
      }
      case 'docs':
        return [`${getDocJobs(overview).length} trabajos · próximos 7 días`, pageLabel].filter(Boolean).join(' · ');
      case 'pending':
        return (pendingActions?.items.length ?? 0) > 0 ? ['Requiere acción', pageLabel].filter(Boolean).join(' · ') : 'Todo en orden';
      case 'calendar':
        return calendarData
          ? formatDateKeyRange(
            formatMadridDateKey(new Date(calendarData.range.start)),
            formatMadridDateKey(new Date(calendarData.range.end)),
          )
          : null;
      default:
        return pageLabel;
    }
  })();

  return (
    <div className="wb-root">
      <div>
        <WallboardHeader
          title={PANEL_TITLES[currentPanel]}
          subtitle={subtitle}
          panelCount={activePanels.length}
          panelIndex={safeIndex}
          lastUpdatedAt={lastUpdatedAt}
          staleAfterMs={pollIntervalMs * 2 + 5_000}
        />
        {presetMessage ? <div className="wb-banner">{presetMessage}</div> : null}
      </div>
      <main className="wb-main">
        <WallboardActivePanel
          calendarData={calendarData}
          crew={crew}
          current={currentPanel}
          highlightJobs={highlightJobs}
          logistics={logistics}
          now={now}
          overview={overview}
          panelPages={panelPages}
          pending={pendingActions}
        />
      </main>
      <Ticker messages={tickerMessages} />
      <WakeLockVideo />
    </div>
  );
}
