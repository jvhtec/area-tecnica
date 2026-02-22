/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { filterVisibleJobs } from '@/utils/jobFiltering';

describe('filterVisibleJobs', () => {
  describe('cancelled jobs', () => {
    it('filters out jobs with status "Cancelado"', () => {
      const jobs = [
        { id: '1', title: 'Active Job', status: 'scheduled' },
        { id: '2', title: 'Cancelled Job', status: 'Cancelado' },
        { id: '3', title: 'Another Active', status: 'confirmed' },
      ];

      const result = filterVisibleJobs(jobs);

      expect(result).toHaveLength(2);
      expect(result.map(j => j.id)).toEqual(['1', '3']);
    });

    it('keeps jobs with other statuses', () => {
      const jobs = [
        { id: '1', status: 'scheduled' },
        { id: '2', status: 'confirmed' },
        { id: '3', status: 'pending' },
        { id: '4', status: 'in_progress' },
      ];

      const result = filterVisibleJobs(jobs);

      expect(result).toHaveLength(4);
    });
  });

  describe('tour filtering', () => {
    it('filters out jobs from cancelled tours', () => {
      const jobs = [
        { 
          id: '1', 
          title: 'Normal Job',
          tour_date: { tour: { status: 'active' } }
        },
        { 
          id: '2', 
          title: 'Cancelled Tour Job',
          tour_date: { tour: { status: 'cancelled' } }
        },
      ];

      const result = filterVisibleJobs(jobs);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    it('filters out jobs from deleted tours', () => {
      const jobs = [
        { 
          id: '1', 
          title: 'Active Tour Job',
          tour_date: { tour: { deleted: false } }
        },
        { 
          id: '2', 
          title: 'Deleted Tour Job',
          tour_date: { tour: { deleted: true } }
        },
      ];

      const result = filterVisibleJobs(jobs);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    it('keeps standalone jobs (no tour)', () => {
      const jobs = [
        { id: '1', title: 'Standalone Job', tour_date: null },
        { id: '2', title: 'Another Standalone', tour_date: undefined },
      ];

      const result = filterVisibleJobs(jobs);

      expect(result).toHaveLength(2);
    });
  });

  describe('combined scenarios', () => {
    it('handles mixed job types correctly', () => {
      const jobs = [
        { id: '1', status: 'scheduled', tour_date: null }, // visible
        { id: '2', status: 'Cancelado', tour_date: null }, // hidden: cancelled
        { id: '3', status: 'scheduled', tour_date: { tour: { status: 'cancelled' } } }, // hidden: cancelled tour
        { id: '4', status: 'scheduled', tour_date: { tour: { deleted: true } } }, // hidden: deleted tour
        { id: '5', status: 'confirmed', tour_date: { tour: { status: 'active' } } }, // visible
      ];

      const result = filterVisibleJobs(jobs);

      expect(result).toHaveLength(2);
      expect(result.map(j => j.id)).toEqual(['1', '5']);
    });

    it('handles empty array', () => {
      expect(filterVisibleJobs([])).toEqual([]);
    });

    it('handles jobs with missing tour_date property', () => {
      const jobs = [
        { id: '1', status: 'scheduled' }, // no tour_date at all
      ];

      const result = filterVisibleJobs(jobs);

      expect(result).toHaveLength(1);
    });

    it('handles jobs with tour_date but no tour', () => {
      const jobs = [
        { id: '1', status: 'scheduled', tour_date: { date: '2024-05-01' } },
      ];

      const result = filterVisibleJobs(jobs);

      expect(result).toHaveLength(1);
    });
  });
});
