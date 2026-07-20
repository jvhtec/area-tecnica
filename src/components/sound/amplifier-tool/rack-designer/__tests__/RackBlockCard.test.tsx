// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RackBlockCard } from '../RackBlockCard';
import type { RackDesignerBlock } from '../types';

const block: RackDesignerBlock = {
  id: 'rack-1',
  label: 'MAIN L',
  color: '#f87171',
  x: 40,
  y: 40,
  amps: [
    {
      id: 'amp-1',
      presetName: 'K2 110',
      ip: '192.168.1.11',
      model: 'LA12X',
    },
  ],
};

const renderCard = (joinMode: boolean) => {
  const callbacks = {
    onSelect: vi.fn(),
    onMove: vi.fn(),
    onTap: vi.fn(),
    onAmpToggle: vi.fn(),
  };

  render(
    <RackBlockCard
      block={block}
      selected={false}
      zoom={1}
      pinchActiveRef={{ current: false }}
      joinMode={joinMode}
      selectedAmpIds={new Set()}
      {...callbacks}
    />,
  );

  return callbacks;
};

describe('RackBlockCard keyboard interaction', () => {
  it('makes amp cells keyboard-toggleable without opening the editor in join mode', () => {
    const { onAmpToggle, onMove, onTap } = renderCard(true);
    const rack = screen.getByRole('group', {
      name: 'Rack MAIN L: selecciona amplificadores para unir',
    });
    const amp = screen.getByRole('button', { name: 'K2 110, 192.168.1.11' });

    expect(amp).toHaveAttribute('aria-pressed', 'false');
    fireEvent.keyDown(amp, { key: 'Enter' });
    fireEvent.keyDown(amp, { key: ' ' });
    fireEvent.keyDown(rack, { key: 'Enter' });
    fireEvent.keyDown(rack, { key: 'ArrowRight' });

    expect(onAmpToggle).toHaveBeenNthCalledWith(1, 'amp-1');
    expect(onAmpToggle).toHaveBeenNthCalledWith(2, 'amp-1');
    expect(onTap).not.toHaveBeenCalled();
    expect(onMove).not.toHaveBeenCalled();
  });

  it('preserves the rack keyboard controls outside join mode', () => {
    const { onMove, onSelect, onTap } = renderCard(false);
    const rack = screen.getByRole('button', {
      name: 'Rack MAIN L: seleccionar con Intro, mover con las flechas',
    });

    fireEvent.keyDown(rack, { key: 'Enter' });
    fireEvent.keyDown(rack, { key: 'ArrowRight' });

    expect(onSelect).toHaveBeenCalledWith('rack-1');
    expect(onTap).toHaveBeenCalledWith('rack-1', null);
    expect(onMove).toHaveBeenCalledWith('rack-1', 50, 40);
  });
});
