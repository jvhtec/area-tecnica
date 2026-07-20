// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { MouseEventHandler } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NwmMap } from '@/components/sound/amplifier-tool/rack-designer/nwm-import';

const { parseMock, reviewPropsMock, toastMock } = vi.hoisted(() => ({
  parseMock: vi.fn(),
  reviewPropsMock: vi.fn(),
  toastMock: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: toastMock }) }));
vi.mock('@/components/sound/amplifier-tool/rack-designer/parse-session-file', () => ({
  parseLaSessionFile: parseMock,
}));
vi.mock('@/components/sound/amplifier-tool/rack-designer/XmlpFlexExportDialog', () => ({
  XmlpFlexExportDialog: (props: {
    open: boolean;
    session: { sourceFileName: string; jobId?: string };
    onCreateFlexTarget?: MouseEventHandler<HTMLButtonElement>;
  }) => {
    reviewPropsMock(props);
    return props.open ? (
      <div data-testid="xmlp-review">
        {props.session.sourceFileName} · {props.session.jobId}
        <button type="button" onClick={props.onCreateFlexTarget}>Crear documento Flex</button>
      </div>
    ) : null;
  },
}));

import { SoundvisionXmlpFlexJobAction } from '../SoundvisionXmlpFlexJobAction';

const parsedMap: NwmMap = {
  sessionName: 'Demo',
  units: [],
  groups: [],
  flysheet: {
    projectName: 'Demo',
    arrays: [{
      groupName: 'PA',
      arrayName: 'MAIN L',
      deployment: 'stacked',
      azimuthDegrees: null,
      topSiteDegrees: null,
      bottomSiteDegrees: null,
      topHeightMeters: null,
      bottomHeightMeters: null,
      riggingFrame: '',
      flyingBarSetting: '',
      pickupConfiguration: '',
      totalMassKg: null,
      frontLoadKg: null,
      rearLoadKg: null,
      enclosures: [{
        model: 'K2',
        splayAngleDegrees: null,
        siteAngleDegrees: null,
        trimHeightMeters: null,
        dispersionSetting: null,
      }],
      warnings: [],
    }],
  },
};

describe('SoundvisionXmlpFlexJobAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    parseMock.mockResolvedValue(parsedMap);
  });

  it('parses one XMLP and opens the job-scoped review without the NM designer', async () => {
    const onCreateFlexTarget = vi.fn();
    render(
      <SoundvisionXmlpFlexJobAction
        jobId="job-123"
        jobName="Festival Demo"
        onCreateFlexTarget={onCreateFlexTarget}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'XMLP → Flex' }));
    expect(screen.getByRole('heading', { name: 'Importar XMLP de Soundvision' })).toBeInTheDocument();
    expect(screen.queryByText(/Diseñador NM\/SV/)).not.toBeInTheDocument();

    const file = new File(['soundvision'], 'festival.xmlp', { type: 'application/octet-stream' });
    fireEvent.change(screen.getByLabelText('Seleccionar XMLP de Soundvision'), {
      target: { files: [file] },
    });

    await waitFor(() => expect(parseMock).toHaveBeenCalledWith(file));
    expect(await screen.findByTestId('xmlp-review')).toHaveTextContent('festival.xmlp · job-123');
    expect(reviewPropsMock).toHaveBeenLastCalledWith(expect.objectContaining({
      session: expect.objectContaining({ jobId: 'job-123', sourceType: 'xmlp' }),
      onCreateFlexTarget,
    }));

    fireEvent.click(screen.getByRole('button', { name: 'Crear documento Flex' }));
    expect(onCreateFlexTarget).toHaveBeenCalledTimes(1);
  });

  it('rejects NWM files before invoking the parser', () => {
    render(<SoundvisionXmlpFlexJobAction jobId="job-123" />);
    fireEvent.click(screen.getByRole('button', { name: 'XMLP → Flex' }));
    fireEvent.change(screen.getByLabelText('Seleccionar XMLP de Soundvision'), {
      target: { files: [new File(['nwm'], 'session.nwm')] },
    });

    expect(parseMock).not.toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Archivo no compatible',
      variant: 'destructive',
    }));
  });
});
