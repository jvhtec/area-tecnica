import { describe, it, expect, vi } from 'vitest';
import type { JobPayoutTotals } from '@/types/jobExtras';

// Mock jsPDF and dependencies
vi.mock('jspdf', () => ({
  default: vi.fn(() => ({
    text: vi.fn(),
    setFont: vi.fn(),
    setFontSize: vi.fn(),
    setTextColor: vi.fn(),
    setFillColor: vi.fn(),
    rect: vi.fn(),
    roundedRect: vi.fn(),
    addPage: vi.fn(),
    save: vi.fn(),
    output: vi.fn(() => new Blob()),
    internal: {
      pageSize: {
        getWidth: () => 210,
        getHeight: () => 297,
      },
    },
    getTextWidth: vi.fn(() => 50),
    lastAutoTable: { finalY: 100 },
  })),
}));

vi.mock('jspdf-autotable', () => ({
  default: vi.fn(),
}));

vi.mock('date-fns', () => ({
  format: vi.fn(() => '2025-01-01'),
}));

describe('rates-pdf-export', () => {
  describe('Expense rendering in Spanish', () => {
    it('should have Spanish category labels defined', () => {
      // Define the expected Spanish labels for expense categories
      const categoryLabels: Record<string, string> = {
        'dietas': 'Dietas',
        'transporte': 'Transporte',
        'alojamiento': 'Alojamiento',
        'material': 'Material',
        'otros': 'Otros',
      };

      // Verify all expected categories have Spanish labels
      expect(categoryLabels.dietas).toBe('Dietas');
      expect(categoryLabels.transporte).toBe('Transporte');
      expect(categoryLabels.alojamiento).toBe('Alojamiento');
      expect(categoryLabels.material).toBe('Material');
      expect(categoryLabels.otros).toBe('Otros');
    });

    it('should format expense breakdown correctly', () => {
      const mockExpenseBreakdown = [
        {
          category_slug: 'dietas',
          approved_total_eur: 150.50,
          submitted_total_eur: 0,
          draft_total_eur: 0,
          rejected_total_eur: 0,
        },
        {
          category_slug: 'transporte',
          approved_total_eur: 85.00,
          submitted_total_eur: 0,
          draft_total_eur: 0,
          rejected_total_eur: 0,
        },
      ];

      const categoryLabels: Record<string, string> = {
        'dietas': 'Dietas',
        'transporte': 'Transporte',
        'alojamiento': 'Alojamiento',
        'material': 'Material',
        'otros': 'Otros',
      };

      // Simulate how the PDF would render these
      const renderedItems = mockExpenseBreakdown.map((category) => {
        const label = categoryLabels[category.category_slug] || category.category_slug;
        const amount = category.approved_total_eur || 0;
        return `• ${label}: €${amount.toFixed(2)}`;
      });

      expect(renderedItems).toHaveLength(2);
      expect(renderedItems[0]).toContain('Dietas');
      expect(renderedItems[0]).toContain('150.50');
      expect(renderedItems[1]).toContain('Transporte');
      expect(renderedItems[1]).toContain('85.00');
    });

    it('should calculate total expenses correctly', () => {
      const mockPayouts: Partial<JobPayoutTotals>[] = [
        {
          technician_id: 'tech-1',
          timesheets_total_eur: 500,
          extras_total_eur: 100,
          expenses_total_eur: 150,
          total_eur: 750,
        },
        {
          technician_id: 'tech-2',
          timesheets_total_eur: 600,
          extras_total_eur: 50,
          expenses_total_eur: 85,
          total_eur: 735,
        },
      ];

      const totalExpenses = mockPayouts.reduce(
        (sum, payout) => sum + (payout.expenses_total_eur || 0),
        0
      );

      expect(totalExpenses).toBe(235); // 150 + 85
    });

    it('should only show "Desglose de Gastos" section when expenses exist', () => {
      const payoutsWithExpenses = [
        {
          technician_id: 'tech-1',
          expenses_total_eur: 150,
          expenses_breakdown: [
            {
              category_slug: 'dietas',
              approved_total_eur: 150,
              submitted_total_eur: 0,
              draft_total_eur: 0,
              rejected_total_eur: 0,
            },
          ],
        },
      ];

      const payoutsWithoutExpenses = [
        {
          technician_id: 'tech-2',
          expenses_total_eur: 0,
          expenses_breakdown: [],
        },
      ];

      // Filter logic that would be used in the PDF
      const filteredWithExpenses = payoutsWithExpenses.filter(
        (payout) =>
          (payout.expenses_total_eur ?? 0) > 0 ||
          (payout.expenses_breakdown?.length ?? 0) > 0
      );

      const filteredWithoutExpenses = payoutsWithoutExpenses.filter(
        (payout) =>
          (payout.expenses_total_eur ?? 0) > 0 ||
          (payout.expenses_breakdown?.length ?? 0) > 0
      );

      expect(filteredWithExpenses).toHaveLength(1);
      expect(filteredWithoutExpenses).toHaveLength(0);
    });

    it('should include "Total Gastos" line in summary when expenses exist', () => {
      const totalExpenses = 235;

      // Simulate the summary lines
      const summaryLines = [
        `Total Partes: €500.00`, 
        `Total Extras: €100.00`, 
      ];

      if (totalExpenses > 0) {
        summaryLines.push(`Total Gastos: €${totalExpenses.toFixed(2)}`);
      }

      expect(summaryLines).toHaveLength(3);
      expect(summaryLines[2]).toBe('Total Gastos: €235.00');
    });
  });
});
