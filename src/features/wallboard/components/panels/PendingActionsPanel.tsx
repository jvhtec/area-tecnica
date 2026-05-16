import React from 'react';
import type { PendingActionsFeed } from '../../types';
import { getJobCardBackground } from '../../utils';
import { AutoScrollWrapper, PanelContainer } from '../shared';

export const PendingActionsPanel: React.FC<{ data: PendingActionsFeed | null; theme?: 'light' | 'dark' }> = ({
  data,
  theme = 'light',
}) => {
  const resetKey = (data?.items ?? []).map((it) => `${it.severity}:${it.text}`).join('|');
  return (
    <AutoScrollWrapper speed={50} resetKey={resetKey}>
      <PanelContainer theme={theme}>
        <div className={`sticky top-0 z-10 pb-4 ${theme === 'light' ? 'bg-white' : 'bg-black'}`}>
          <h1 className="text-5xl font-semibold">Acciones Pendientes</h1>
        </div>
        <div className="flex flex-col gap-3 text-38">
          {(data?.items ?? []).map((it, i) => (
            <div
              key={i}
              className={`rounded-md px-4 py-3 border ${
                it.severity === 'red'
                  ? theme === 'light'
                    ? 'border-red-500/60'
                    : 'border-red-500/60'
                  : theme === 'light'
                    ? 'border-amber-500/60'
                    : 'border-amber-500/60'
              }`}
              style={{ backgroundColor: it.severity === 'red' ? getJobCardBackground('#ef4444', theme) : getJobCardBackground('#f59e0b', theme) }}
            >
              {it.text}
            </div>
          ))}
          {(data?.items.length ?? 0) === 0 && <div className={theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}>Todo bien ✅</div>}
        </div>
      </PanelContainer>
    </AutoScrollWrapper>
  );
};

