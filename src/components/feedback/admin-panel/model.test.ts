import { describe, expect, it } from 'vitest';
import { bugStatusColors, featureStatusColors, severityColors } from './model';

describe('feedback admin model', () => {
  it('defines a visual treatment for every persisted state', () => {
    expect(Object.keys(severityColors)).toEqual(['low', 'medium', 'high', 'critical']);
    expect(Object.keys(bugStatusColors)).toEqual(['open', 'in_progress', 'resolved']);
    expect(Object.keys(featureStatusColors)).toEqual([
      'pending',
      'under_review',
      'accepted',
      'rejected',
      'completed',
    ]);
  });
});
