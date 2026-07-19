import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AmplifierResults } from '@/components/sound/amplifier-tool/types';
import { mockSupabase } from '@/test/mockSupabase';
import { AmpRackDesigner } from '../AmpRackDesigner';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase,
}));

const calculatorResults: AmplifierResults = {
  totalAmplifiersNeeded: 1,
  completeRaks: 0,
  looseAmplifiers: 1,
  plmRacks: 0,
  loosePLMAmps: 0,
  laAmpsTotal: 1,
  plmAmpsTotal: 0,
  perSection: {
    mains: {
      amps: 1,
      details: [],
      totalAmps: 1,
      mirrored: false,
      laAmps: 1,
      plmAmps: 0,
    },
  },
};

describe('AmpRackDesigner — modo independiente', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('opens an empty import canvas without calculator-only regeneration controls', async () => {
    render(
      <AmpRackDesigner
        standalone
        hideTrigger
        open
        onOpenChange={vi.fn()}
        storageScope="standalone-test"
      />,
    );

    expect(await screen.findByText('Suelta aquí una sesión NM o Soundvision')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Regenerar' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exportar PDF' })).toBeDisabled();
  });

  it('allows starting a design manually and persists it in the standalone scope', async () => {
    render(
      <AmpRackDesigner
        standalone
        hideTrigger
        open
        onOpenChange={vi.fn()}
        storageScope="standalone-manual-test"
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Añadir rack' }));

    expect(screen.queryByText('Suelta aquí una sesión NM o Soundvision')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exportar PDF' })).toBeEnabled();
    await waitFor(() => {
      expect(localStorage.getItem('amp-rack-designer:standalone-manual-test')).toContain('RACK 1');
    });
  });

  it('imports a dropped Soundvision file through the shared session parser', async () => {
    mockSupabase.functions.invoke.mockResolvedValueOnce({
      data: {
        map: {
          sessionName: 'GIRA 2026',
          units: [
            {
              octet: 11,
              ip: '192.168.1.11',
              presetName: 'K2 110',
              familyName: 'K2',
              model: 'LA12X',
              x: 0,
              y: 0,
            },
          ],
          groups: [{ name: 'K2 L', role: 'source', members: [11] }],
        },
      },
      error: null,
    });
    render(
      <AmpRackDesigner
        standalone
        hideTrigger
        open
        onOpenChange={vi.fn()}
        storageScope="standalone-drop-test"
      />,
    );

    const dropPrompt = await screen.findByText('Suelta aquí una sesión NM o Soundvision');
    const dropTarget = dropPrompt.closest('button')?.parentElement;
    expect(dropTarget).not.toBeNull();
    const file = new File(['soundvision-session'], 'gira.xmlp', {
      type: 'application/octet-stream',
    });
    fireEvent.dragEnter(dropTarget!, { dataTransfer: { types: ['Files'], files: [file] } });
    fireEvent.drop(dropTarget!, { dataTransfer: { types: ['Files'], files: [file] } });

    await waitFor(() => {
      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('parse-la-session', {
        body: { file: 'c291bmR2aXNpb24tc2Vzc2lvbg==' },
      });
    });
    expect(await screen.findByText('K2 L')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exportar PDF' })).toBeEnabled();
  });
});

describe('AmpRackDesigner — modo calculadora', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('still generates from calculator results and keeps the regeneration action', async () => {
    render(
      <AmpRackDesigner
        results={calculatorResults}
        hideTrigger
        open
        onOpenChange={vi.fn()}
        storageScope="calculator-test"
      />,
    );

    expect(await screen.findByRole('button', { name: 'Regenerar' })).toBeInTheDocument();
    expect(screen.queryByText('Suelta aquí una sesión NM o Soundvision')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exportar PDF' })).toBeEnabled();
  });
});
