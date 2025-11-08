import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { enrichTimesheetsWithProfiles } from '@/components/jobs/JobDetailsDialog';
import { generateTimesheetPDF } from '@/utils/timesheet-pdf';

const autoTableCalls: any[] = [];

vi.mock('jspdf-autotable', () => ({
  __esModule: true,
  default: (doc: any, options: any) => {
    autoTableCalls.push(options);
    (doc as any).lastAutoTable = { finalY: (options.startY ?? 0) + 10 };
  },
}));

class JsPDFMock {
  internal = { pageSize: { width: 210, height: 297 } };

  setFillColor() {}
  rect() {}
  addImage() {}
  setFont() {}
  setFontSize() {}
  setTextColor() {}
  text() {}
  output() { return ''; }
}

vi.mock('jspdf', () => ({
  __esModule: true,
  default: vi.fn(() => new JsPDFMock()),
}));

vi.mock('@/utils/pdf/logoUtils', () => ({
  fetchJobLogo: vi.fn().mockResolvedValue(undefined),
}));

describe('JobDetailsDialog timesheet enrichment', () => {
  beforeAll(() => {
    class ImageMock {
      crossOrigin: string | null = null;
      onload: (() => void) | null = null;
      onerror: ((error: any) => void) | null = null;

      set src(_value: string) {
        if (this.onload) {
          this.onload();
        }
      }
    }

    (globalThis as any).Image = ImageMock;
  });

  beforeEach(() => {
    autoTableCalls.length = 0;
  });

  it('hydrates missing technician names before generating the timesheet PDF', async () => {
    const supabaseMock = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          in: vi.fn(async () => ({
            data: [
              {
                id: 'tech-1',
                first_name: 'Alice',
                last_name: 'Doe',
                department: 'Audio',
                autonomo: false,
              },
            ],
            error: null,
          })),
        })),
      })),
    } as any;

    const rawTimesheets = [
      {
        id: 'ts-1',
        technician_id: 'tech-1',
        date: '2025-05-01',
        start_time: '09:00:00',
        end_time: '17:00:00',
        break_minutes: 30,
        overtime_hours: 0,
        status: 'approved',
      },
    ];

    const { timesheets: enrichedTimesheets, profileMap } = await enrichTimesheetsWithProfiles(
      supabaseMock,
      rawTimesheets
    );

    expect(profileMap.size).toBe(1);
    expect(enrichedTimesheets[0].technician).toMatchObject({ first_name: 'Alice', last_name: 'Doe' });
    expect(profileMap.get('tech-1')).toMatchObject({ autonomo: false });
    const payoutProfiles = Array.from(profileMap.values());
    expect(payoutProfiles[0]).toMatchObject({ autonomo: false });

    await generateTimesheetPDF({
      job: {
        id: 'job-1',
        title: 'Test Job',
        start_time: '2025-05-01T08:00:00Z',
        end_time: '2025-05-01T18:00:00Z',
        job_type: 'show',
      } as any,
      timesheets: enrichedTimesheets as any,
      date: 'all-dates',
    });

    expect(autoTableCalls.length).toBeGreaterThan(0);
    const firstTable = autoTableCalls[0];
    expect(firstTable.body[0][1]).toBe('Alice Doe');
  });
});
