/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { buildAssignmentDateMap, MatrixTimesheetAssignment, MatrixJob } from '@/hooks/useOptimizedMatrixData';

describe('buildAssignmentDateMap', () => {
  const createJob = (id: string, title: string): MatrixJob => ({
    id,
    title,
    start_time: '2024-05-01T10:00:00Z',
    end_time: '2024-05-01T20:00:00Z',
    status: 'scheduled',
    job_type: 'single',
  });

  const createAssignment = (
    technicianId: string,
    jobId: string,
    date: string,
    overrides?: Partial<MatrixTimesheetAssignment>
  ): MatrixTimesheetAssignment => ({
    job_id: jobId,
    technician_id: technicianId,
    date,
    job: createJob(jobId, `Job ${jobId}`),
    status: 'confirmed',
    assigned_at: '2024-04-01T10:00:00Z',
    ...overrides,
  });

  describe('basic functionality', () => {
    it('creates map with correct keys (technician-date)', () => {
      const assignments = [
        createAssignment('tech-1', 'job-1', '2024-05-01'),
        createAssignment('tech-2', 'job-1', '2024-05-01'),
        createAssignment('tech-1', 'job-2', '2024-05-02'),
      ];

      const map = buildAssignmentDateMap(assignments, []);

      expect(map.size).toBe(3);
      expect(map.has('tech-1-2024-05-01')).toBe(true);
      expect(map.has('tech-2-2024-05-01')).toBe(true);
      expect(map.has('tech-1-2024-05-02')).toBe(true);
    });

    it('returns correct assignment for each key', () => {
      const assignments = [
        createAssignment('tech-1', 'job-1', '2024-05-01', { sound_role: 'foh' }),
        createAssignment('tech-1', 'job-2', '2024-05-02', { sound_role: 'mon' }),
      ];

      const map = buildAssignmentDateMap(assignments, []);

      expect(map.get('tech-1-2024-05-01')?.sound_role).toBe('foh');
      expect(map.get('tech-1-2024-05-02')?.sound_role).toBe('mon');
    });
  });

  describe('multi-day assignments', () => {
    it('creates separate entries for each day of multi-day job', () => {
      const assignments = [
        createAssignment('tech-1', 'job-1', '2024-05-01'),
        createAssignment('tech-1', 'job-1', '2024-05-02'),
        createAssignment('tech-1', 'job-1', '2024-05-03'),
      ];

      const map = buildAssignmentDateMap(assignments, []);

      expect(map.size).toBe(3);
      expect(map.has('tech-1-2024-05-01')).toBe(true);
      expect(map.has('tech-1-2024-05-02')).toBe(true);
      expect(map.has('tech-1-2024-05-03')).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('returns empty map for empty assignments', () => {
      const map = buildAssignmentDateMap([], []);
      expect(map.size).toBe(0);
    });

    it('skips assignments without job', () => {
      const assignments = [
        createAssignment('tech-1', 'job-1', '2024-05-01'),
        { ...createAssignment('tech-2', 'job-2', '2024-05-01'), job: null },
      ];

      const map = buildAssignmentDateMap(assignments as unknown as MatrixTimesheetAssignment[], []);

      expect(map.size).toBe(1);
      expect(map.has('tech-1-2024-05-01')).toBe(true);
      expect(map.has('tech-2-2024-05-01')).toBe(false);
    });

    it('skips assignments without date', () => {
      const assignments = [
        createAssignment('tech-1', 'job-1', '2024-05-01'),
        { ...createAssignment('tech-2', 'job-2', '2024-05-01'), date: null },
      ];

      const map = buildAssignmentDateMap(assignments as unknown as MatrixTimesheetAssignment[], []);

      expect(map.size).toBe(1);
    });

    it('handles multiple technicians on same job same day', () => {
      const assignments = [
        createAssignment('tech-1', 'job-1', '2024-05-01', { sound_role: 'foh' }),
        createAssignment('tech-2', 'job-1', '2024-05-01', { sound_role: 'mon' }),
        createAssignment('tech-3', 'job-1', '2024-05-01', { sound_role: 'stage' }),
      ];

      const map = buildAssignmentDateMap(assignments, []);

      expect(map.size).toBe(3);
      expect(map.get('tech-1-2024-05-01')?.sound_role).toBe('foh');
      expect(map.get('tech-2-2024-05-01')?.sound_role).toBe('mon');
      expect(map.get('tech-3-2024-05-01')?.sound_role).toBe('stage');
    });
  });

  describe('role information', () => {
    it('preserves sound_role in map entries', () => {
      const assignments = [
        createAssignment('tech-1', 'job-1', '2024-05-01', { sound_role: 'foh' }),
      ];

      const map = buildAssignmentDateMap(assignments, []);

      expect(map.get('tech-1-2024-05-01')?.sound_role).toBe('foh');
    });

    it('preserves lights_role in map entries', () => {
      const assignments = [
        createAssignment('tech-1', 'job-1', '2024-05-01', { lights_role: 'lx-lead' }),
      ];

      const map = buildAssignmentDateMap(assignments, []);

      expect(map.get('tech-1-2024-05-01')?.lights_role).toBe('lx-lead');
    });

    it('preserves video_role in map entries', () => {
      const assignments = [
        createAssignment('tech-1', 'job-1', '2024-05-01', { video_role: 'video-tech' }),
      ];

      const map = buildAssignmentDateMap(assignments, []);

      expect(map.get('tech-1-2024-05-01')?.video_role).toBe('video-tech');
    });
  });

  describe('assignment metadata', () => {
    it('preserves is_schedule_only flag', () => {
      const assignments = [
        createAssignment('tech-1', 'job-1', '2024-05-01', { is_schedule_only: true }),
      ];

      const map = buildAssignmentDateMap(assignments, []);

      expect(map.get('tech-1-2024-05-01')?.is_schedule_only).toBe(true);
    });

    it('preserves source field', () => {
      const assignments = [
        createAssignment('tech-1', 'job-1', '2024-05-01', { source: 'matrix' }),
      ];

      const map = buildAssignmentDateMap(assignments, []);

      expect(map.get('tech-1-2024-05-01')?.source).toBe('matrix');
    });

    it('preserves status field', () => {
      const assignments = [
        createAssignment('tech-1', 'job-1', '2024-05-01', { status: 'pending' }),
      ];

      const map = buildAssignmentDateMap(assignments, []);

      expect(map.get('tech-1-2024-05-01')?.status).toBe('pending');
    });
  });
});
