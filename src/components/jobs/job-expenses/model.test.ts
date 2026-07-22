import { describe, expect, it } from 'vitest';
import {
  buildTechnicianName,
  STATUS_ORDER,
  type ExpenseRow,
} from '@/components/jobs/job-expenses/model';

const baseExpense = {
  id: 'expense-1',
  technician_id: 'tech-1',
  category_slug: 'meal',
  expense_date: '2026-07-22',
  amount_original: 10,
  currency_code: 'EUR',
  fx_rate: 1,
  amount_eur: 10,
  status: 'draft',
} as ExpenseRow;

describe('job expense model', () => {
  it('builds technician names with stable fallback behavior', () => {
    expect(buildTechnicianName({
      ...baseExpense,
      technician: { first_name: 'Ana', last_name: 'López' },
    })).toBe('Ana López');
    expect(buildTechnicianName(baseExpense, 'Técnico invitado')).toBe('Técnico invitado');
    expect(buildTechnicianName(baseExpense)).toBe('tech-1');
  });

  it('keeps review-relevant statuses first', () => {
    expect(STATUS_ORDER).toEqual(['submitted', 'draft', 'approved', 'rejected']);
  });
});
