// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ImportedLaSession } from '../importedLaSession';
import type { StrictGroupedPushResult } from '@/services/flexPullsheets';

const { getTargetsMock, pushMock, toastMock, equipmentRangeMock, equipmentRows } = vi.hoisted(() => ({
  getTargetsMock: vi.fn(),
  pushMock: vi.fn(),
  toastMock: vi.fn(),
  equipmentRangeMock: vi.fn(),
  equipmentRows: [
    { id: 'k2-row', name: 'K2', department: 'sound', category: 'speakers', resource_id: 'k2-resource' },
    { id: 'k1-row', name: "L'Acoustics K1", department: 'sound', category: 'speakers', resource_id: null },
  ],
}));

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: toastMock }) }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        in: () => ({
          order: () => ({ range: equipmentRangeMock }),
        }),
      }),
    }),
  },
}));
vi.mock('@/services/flexPullsheets', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/flexPullsheets')>();
  return {
    ...actual,
    getJobFlexEquipmentTargets: getTargetsMock,
    pushEquipmentToFlexDocumentStrict: pushMock,
  };
});

import { XmlpFlexExportDialog } from '../XmlpFlexExportDialog';

const session = (jobId?: string): ImportedLaSession => {
  const map: ImportedLaSession['map'] = {
    sessionName: 'Demo',
    units: [],
    groups: [],
    flysheet: {
      projectName: 'Demo',
      arrays: [
        {
          groupName: 'PA', arrayName: 'MAIN L', deployment: 'stacked',
          azimuthDegrees: null, topSiteDegrees: null, bottomSiteDegrees: null,
          topHeightMeters: null, bottomHeightMeters: null, riggingFrame: '',
          flyingBarSetting: '', pickupConfiguration: '', totalMassKg: null,
          frontLoadKg: null, rearLoadKg: null, warnings: [],
          enclosures: ['K2', 'K1'].map((model): NonNullable<ImportedLaSession['flysheet']>['arrays'][number]['enclosures'][number] => ({
            model, splayAngleDegrees: null, siteAngleDegrees: null,
            trimHeightMeters: null, dispersionSetting: null,
          })),
        },
      ],
    },
  };
  return {
    sourceFileName: 'demo.xmlp',
    sourceType: 'xmlp',
    importedAt: '2026-07-20T20:00:00.000Z',
    map,
    flysheet: map.flysheet,
    units: map.units,
    storageScope: 'test',
    jobId,
  };
};

const successfulResult: StrictGroupedPushResult = {
  groupsCreated: ['pa_mains'],
  groupsReused: [],
  groupsFailed: [],
  equipmentLinesAdded: 1,
  totalQuantitiesRepresented: 1,
  childrenSkippedBecauseParentFailed: [],
  failedChildItems: [],
  warnings: ['aditivo'],
};

describe('XmlpFlexExportDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    equipmentRangeMock.mockResolvedValue({ data: equipmentRows, error: null });
    getTargetsMock.mockResolvedValue([
      {
        id: 'quote-id', element_id: 'quote-id', department: 'sound',
        created_at: '2026-07-20T20:00:00.000Z', display_name: 'Presupuesto Sx',
        source: 'database', document_type: 'presupuesto',
      },
    ]);
    pushMock.mockResolvedValue(successfulResult);
  });

  it('previews mapped/unmapped lines, auto-selects one Presupuesto, and sends only confirmed selections', async () => {
    render(<XmlpFlexExportDialog open onOpenChange={vi.fn()} session={session('job-id')} />);

    expect(await screen.findByText(/1 líneas mapeadas/)).toBeInTheDocument();
    expect(screen.getByText('1 sin mapear')).toBeInTheDocument();
    expect(screen.getByText('0 ambiguas')).toBeInTheDocument();
    expect(screen.getByText('Sin recurso Flex')).toBeInTheDocument();
    expect(screen.getAllByText(/MAIN L/)).toHaveLength(2);
    const send = screen.getByRole('button', { name: 'Enviar seleccionados a Flex' });
    expect(send).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar K2' }));
    expect(send).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar K2' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Entiendo que el envío es aditivo/ }));
    expect(send).toBeEnabled();
    fireEvent.click(send);

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith(
      { elementId: 'quote-id', documentType: 'presupuesto' },
      [{ resourceId: 'k2-resource', quantity: 1, name: 'K2', flexCategoryKey: 'pa_mains' }],
    ));
    expect(await screen.findByText('Envío completo')).toBeInTheDocument();
    expect(screen.getByText(/1 grupos creados; 1 líneas añadidas/)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Seleccionar K2' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Entiendo que el envío es aditivo/ })).not.toBeChecked();
    expect(send).toBeDisabled();
  });

  it('paginates equipment rows so mappings beyond the first 1000 records are available', async () => {
    const firstPage = Array.from({ length: 1000 }, (_, index) => ({
      id: `unrelated-${index}`,
      name: `Unrelated ${index}`,
      department: 'sound',
      category: 'speakers',
      resource_id: `unrelated-resource-${index}`,
    }));
    equipmentRangeMock
      .mockResolvedValueOnce({ data: firstPage, error: null })
      .mockResolvedValueOnce({ data: equipmentRows, error: null });

    render(<XmlpFlexExportDialog open onOpenChange={vi.fn()} session={session('job-id')} />);

    expect(await screen.findByText(/1 líneas mapeadas/)).toBeInTheDocument();
    expect(equipmentRangeMock).toHaveBeenNthCalledWith(1, 0, 999);
    expect(equipmentRangeMock).toHaveBeenNthCalledWith(2, 1000, 1999);
  });

  it('preserves the selection and additive confirmation when a push rejects', async () => {
    pushMock.mockRejectedValueOnce(new Error('upstream failed'));
    render(<XmlpFlexExportDialog open onOpenChange={vi.fn()} session={session('job-id')} />);
    await screen.findByText(/1 líneas mapeadas/);

    const selected = screen.getByRole('checkbox', { name: 'Seleccionar K2' });
    const confirmation = screen.getByRole('checkbox', { name: /Entiendo que el envío es aditivo/ });
    const send = screen.getByRole('button', { name: 'Enviar seleccionados a Flex' });
    fireEvent.click(confirmation);
    fireEvent.click(send);

    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Error al enviar a Flex',
      variant: 'destructive',
    })));
    expect(selected).toBeChecked();
    expect(confirmation).toBeChecked();
    expect(send).toBeEnabled();
  });

  it('allows deselecting a complete group', async () => {
    render(<XmlpFlexExportDialog open onOpenChange={vi.fn()} session={session('job-id')} />);
    await screen.findByText(/1 líneas mapeadas/);

    const group = screen.getByRole('checkbox', { name: 'Seleccionar grupo Sistema de PA' });
    expect(group).toBeChecked();
    fireEvent.click(group);

    expect(screen.getByRole('checkbox', { name: 'Seleccionar K2' })).not.toBeChecked();
    fireEvent.click(screen.getByRole('checkbox', { name: /Entiendo que el envío es aditivo/ }));
    expect(screen.getByRole('button', { name: 'Enviar seleccionados a Flex' })).toBeDisabled();
  });

  it('renders a category-parent failure distinctly', async () => {
    pushMock.mockResolvedValueOnce({
      ...successfulResult,
      groupsCreated: [],
      groupsFailed: [{ flexCategoryKey: 'pa_mains', name: 'pa_mains', error: 'upstream failed' }],
      equipmentLinesAdded: 0,
      totalQuantitiesRepresented: 0,
      childrenSkippedBecauseParentFailed: [
        { flexCategoryKey: 'pa_mains', name: 'K2', error: 'upstream failed' },
      ],
    });
    render(<XmlpFlexExportDialog open onOpenChange={vi.fn()} session={session('job-id')} />);
    await screen.findByText(/1 líneas mapeadas/);

    fireEvent.click(screen.getByRole('checkbox', { name: /Entiendo que el envío es aditivo/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Enviar seleccionados a Flex' }));

    expect(await screen.findByText('Fallo de cabecera')).toBeInTheDocument();
    expect(screen.getByText(/1 grupos fallidos; 0 líneas hijas fallidas; 1 hijas omitidas/)).toBeInTheDocument();
  });

  it('keeps URL fallback available and detects a fin-doc Presupuesto URL', async () => {
    getTargetsMock.mockResolvedValue([]);
    render(<XmlpFlexExportDialog open onOpenChange={vi.fn()} session={session()} />);
    await screen.findByText(/1 líneas mapeadas/);

    fireEvent.change(screen.getByLabelText('URL de Pull Sheet o Presupuesto'), {
      target: { value: 'https://example.flexrentalsolutions.com/f5/ui/?desktop#fin-doc/11111111-1111-4111-8111-111111111111/view' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: /Entiendo que el envío es aditivo/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Enviar seleccionados a Flex' }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith(
      { elementId: '11111111-1111-4111-8111-111111111111', documentType: 'presupuesto' },
      expect.any(Array),
    ));
  });

  it('can open the existing Flex creation flow and refresh newly created job documents', async () => {
    const onCreateFlexTarget = vi.fn();
    getTargetsMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        id: 'pullsheet-id', element_id: 'pullsheet-id', department: 'sound',
        created_at: '2026-07-20T20:00:00.000Z', display_name: 'Pull Sheet Sx',
        source: 'database', document_type: 'pullsheet',
      }]);
    render(
      <XmlpFlexExportDialog
        open
        onOpenChange={vi.fn()}
        session={session('job-id')}
        onCreateFlexTarget={onCreateFlexTarget}
      />,
    );
    await screen.findByText(/1 líneas mapeadas/);

    fireEvent.click(screen.getByRole('button', { name: 'Crear documento Flex' }));
    expect(onCreateFlexTarget).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Actualizar documentos' }));
    await waitFor(() => expect(getTargetsMock).toHaveBeenCalledTimes(2));
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Documentos Flex actualizados',
      description: '1 destino disponible.',
    }));
  });
});
