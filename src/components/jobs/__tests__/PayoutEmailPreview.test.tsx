import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PayoutEmailPreview } from '@/components/jobs/PayoutEmailPreview';
import type { JobPayoutEmailContextResult } from '@/lib/job-payout-email';

vi.mock('@/services/dataLayerClient', () => ({
  dataLayerClient: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: null, error: null })),
          })),
        })),
      })),
    })),
  },
}));

const renderPreview = (context: JobPayoutEmailContextResult) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <PayoutEmailPreview open onClose={vi.fn()} context={context} jobTitle={context.job.title} />
    </QueryClientProvider>,
  );
};

describe('PayoutEmailPreview', () => {
  it('shows the required invoice CC instruction for autonomo technicians', async () => {
    const context: JobPayoutEmailContextResult = {
      job: {
        id: 'job-1',
        title: 'Festival Job',
        start_time: '2026-04-16T08:00:00.000Z',
        end_time: '2026-04-16T18:00:00.000Z',
        tour_id: null,
        invoicing_company: 'Sector Pro',
      },
      payouts: [],
      profiles: [],
      lpoMap: new Map([['tech-1', 'LPO-001']]),
      timesheetMap: new Map([
        [
          'tech-1',
          [
            {
              date: '2026-04-16',
              hours_rounded: 8,
              total_eur: 100,
            },
          ],
        ],
      ]),
      attachments: [
        {
          technician_id: 'tech-1',
          email: 'ana@example.com',
          full_name: 'Ana Lopez',
          payout: {
            job_id: 'job-1',
            technician_id: 'tech-1',
            timesheets_total_eur: 100,
            extras_total_eur: 0,
            expenses_total_eur: 0,
            total_eur: 100,
            extras_breakdown: { items: [], total_eur: 0 },
            expenses_breakdown: [],
            vehicle_disclaimer: false,
          },
          pdfBase64: btoa('pdf'),
          filename: 'pago.pdf',
          autonomo: true,
          is_house_tech: false,
          lpo_number: 'LPO-001',
        },
      ],
      missingEmails: [],
    };

    renderPreview(context);

    expect(await screen.findByText(/Enviar factura a:/i)).toBeInTheDocument();
    expect(screen.getByText('administracion@sector-pro.com')).toBeInTheDocument();
    expect(screen.getByText(/Poner en copia a:/i)).toBeInTheDocument();
    expect(screen.getByText('administracion@mfo-producciones.com')).toBeInTheDocument();
  });
});
