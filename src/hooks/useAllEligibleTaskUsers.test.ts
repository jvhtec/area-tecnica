import { describe, expect, it } from 'vitest';
import { groupEligibleTaskUsers } from '@/hooks/useAllEligibleTaskUsers';

describe('groupEligibleTaskUsers', () => {
  it('keeps the query order while grouping the current department first', () => {
    const result = groupEligibleTaskUsers([
      { id: 'other', first_name: 'Berta', last_name: 'Luz', department: 'lights' },
      { id: 'mine', first_name: 'Ana', last_name: 'Son', department: 'sound' },
      { id: 'fallback', first_name: null, last_name: null, department: null },
    ], 'sound');

    expect(result.flat.map(({ id }) => id)).toEqual(['other', 'mine', 'fallback']);
    expect(result.items.map(({ label }) => label)).toEqual(['Berta Luz', 'Ana Son', 'fallback']);
    expect(result.groups).toEqual([
      { heading: 'Tu departamento', items: [{ value: 'mine', label: 'Ana Son' }] },
      {
        heading: 'Otros departamentos',
        items: [
          { value: 'other', label: 'Berta Luz' },
          { value: 'fallback', label: 'fallback' },
        ],
      },
    ]);
  });

  it('puts every user in the other group when no department is selected', () => {
    const result = groupEligibleTaskUsers([
      { id: 'user', first_name: 'Ada', last_name: null, department: 'sound' },
    ], null);

    expect(result.groups).toEqual([
      { heading: 'Otros departamentos', items: [{ value: 'user', label: 'Ada' }] },
    ]);
  });
});
