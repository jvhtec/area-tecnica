// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NwmMap, SoundvisionFlysheet } from '@/components/sound/amplifier-tool/rack-designer/nwm-import';
import { mockSupabase, resetMockSupabase } from '@/test/mockSupabase';

const { generateFlysheetPdfMock, toastMock } = vi.hoisted(() => ({
  generateFlysheetPdfMock: vi.fn(),
  toastMock: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase,
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock('@/utils/soundvisionFlysheetPdf', () => ({
  generateSoundvisionFlysheetPdf: (...args: unknown[]) => generateFlysheetPdfMock(...args),
}));

import { SoundvisionFlysheetButton } from '../SoundvisionFlysheetButton';

describe('SoundvisionFlysheetButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockSupabase();
    generateFlysheetPdfMock.mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' }));
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:flysheet'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  it('writes the triggering user into the flysheet metadata', async () => {
    const flysheet: SoundvisionFlysheet = {
      projectName: 'Gira 2026',
      arrays: [{
        groupName: 'PA',
        arrayName: 'MAIN L',
        deployment: 'flown' as const,
        azimuthDegrees: 0,
        topSiteDegrees: 0,
        bottomSiteDegrees: -12,
        topHeightMeters: 10,
        bottomHeightMeters: 4,
        riggingFrame: 'K2-BUMP',
        flyingBarSetting: '1x K2-BAR · Orificio A',
        pickupConfiguration: 'F: 5 / R: 21',
        totalMassKg: 1000,
        frontLoadKg: null,
        rearLoadKg: null,
        enclosures: [],
        warnings: [],
      }],
    };
    const map: NwmMap = {
      sessionName: 'Gira 2026',
      units: [],
      groups: [],
      flysheet,
    };
    render(
      <SoundvisionFlysheetButton
        session={{
          sourceFileName: 'gira.xmlp',
          sourceType: 'xmlp',
          importedAt: '2026-07-20T20:00:00.000Z',
          map,
          flysheet,
          units: [],
          storageScope: 'test',
        }}
        createdBy="Pat Jones"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Generar flysheet' }));

    await waitFor(() => {
      expect(generateFlysheetPdfMock).toHaveBeenCalledWith(
        flysheet,
        expect.objectContaining({
          sourceFileName: 'gira.xmlp',
          createdBy: 'Pat Jones',
        }),
      );
    });
    expect(mockSupabase.auth.getUser).not.toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: 'Generar flysheet' })).toBeEnabled();
  });
});
