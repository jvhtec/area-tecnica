import { describe, expect, it } from 'vitest';

type DateType = 'show' | 'rigging' | 'rehearsal' | 'prep_day';

type ScheduledDate = {
  date: string;
  type: DateType;
  week: string;
};

type AssignmentScope = 'whole-job' | 'single-day';

type Assignment = {
  date?: string;
  scope: AssignmentScope;
};

type PayrollCase = {
  name: string;
  baseRate: number;
  scheduledDates: ScheduledDate[];
  assignments: Assignment[];
  activeTimesheetDates?: string[];
  prepTimesheetHours?: number;
  expected: {
    quoteDays: number;
    standardDays: number;
    multipliedStandardDays: number;
    maxWeekCount: number;
    standardTotal: number;
    multiplierBonus: number;
    prepTotal: number;
    combinedPayout: number;
  };
};

function isAssignedToDate(date: string, assignments: Assignment[]) {
  return assignments.some((assignment) => assignment.scope === 'single-day' && assignment.date === date);
}

function hasWholeJobAssignment(assignments: Assignment[]) {
  return assignments.some((assignment) => assignment.scope === 'whole-job');
}

function isoWeekKey(date: string) {
  const value = new Date(`${date}T00:00:00Z`);
  const day = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((value.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${value.getUTCFullYear()}-W${week}`;
}

function getPayableQuoteDates(testCase: PayrollCase) {
  const activeTimesheetDates = new Set(testCase.activeTimesheetDates ?? []);
  const singleDayAssignments = testCase.assignments.filter((assignment) => assignment.scope === 'single-day');
  const scheduledByDate = new Map(testCase.scheduledDates.map((scheduledDate) => [scheduledDate.date, scheduledDate]));
  const prepDates = new Set(
    testCase.scheduledDates
      .filter((scheduledDate) => scheduledDate.type === 'prep_day')
      .map((scheduledDate) => scheduledDate.date)
  );
  const result = new Map<string, ScheduledDate>();

  const addPayableDate = (date: string | undefined) => {
    if (!date || prepDates.has(date)) return;

    result.set(
      date,
      scheduledByDate.get(date) ?? {
        date,
        type: 'show',
        week: isoWeekKey(date),
      }
    );
  };

  if (singleDayAssignments.length > 0) {
    testCase.scheduledDates.forEach((scheduledDate) => {
      if (scheduledDate.type === 'prep_day') return;
      if (isAssignedToDate(scheduledDate.date, testCase.assignments) || activeTimesheetDates.has(scheduledDate.date)) {
        addPayableDate(scheduledDate.date);
      }
    });
    singleDayAssignments.forEach((assignment) => addPayableDate(assignment.date));
    activeTimesheetDates.forEach((date) => addPayableDate(date));

    return Array.from(result.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  if (hasWholeJobAssignment(testCase.assignments)) {
    testCase.scheduledDates.forEach((scheduledDate) => {
      if (scheduledDate.type === 'prep_day') return;
      if (scheduledDate.type !== 'rigging' || activeTimesheetDates.has(scheduledDate.date)) {
        addPayableDate(scheduledDate.date);
      }
    });
  }

  activeTimesheetDates.forEach((date) => {
    addPayableDate(date);
  });

  return Array.from(result.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function calculateCase(testCase: PayrollCase) {
  const payableQuoteDates = getPayableQuoteDates(testCase);
  const standardDates = payableQuoteDates.filter((scheduledDate) => scheduledDate.type !== 'rehearsal');
  const datesByWeek = new Map<string, number>();

  standardDates.forEach((scheduledDate) => {
    datesByWeek.set(scheduledDate.week, (datesByWeek.get(scheduledDate.week) ?? 0) + 1);
  });

  const standardTotal = standardDates.reduce((sum, scheduledDate) => {
    const weekCount = datesByWeek.get(scheduledDate.week) ?? 1;
    const perDateMultiplier = weekCount === 1 ? 1.5 : weekCount === 2 ? 1.125 : 1;
    return sum + testCase.baseRate * perDateMultiplier;
  }, 0);

  const multipliedStandardDays = standardDates.filter((scheduledDate) => {
    const weekCount = datesByWeek.get(scheduledDate.week) ?? 1;
    return weekCount < 3;
  }).length;
  const maxWeekCount = Math.max(1, ...datesByWeek.values());
  const prepTotal = Math.round(testCase.prepTimesheetHours ?? 0) * 15;

  return {
    quoteDays: payableQuoteDates.length,
    standardDays: standardDates.length,
    multipliedStandardDays,
    maxWeekCount,
    standardTotal: Math.round(standardTotal * 100) / 100,
    multiplierBonus: Math.round((standardTotal - standardDates.length * testCase.baseRate) * 100) / 100,
    prepTotal,
    combinedPayout: Math.round((standardTotal + prepTotal) * 100) / 100,
  };
}

const cases: PayrollCase[] = [
  {
    name: 'one show date in a week gets 1.5x',
    baseRate: 200,
    scheduledDates: [{ date: '2026-05-04', type: 'show', week: '2026-W19' }],
    assignments: [{ scope: 'whole-job' }],
    expected: {
      quoteDays: 1,
      standardDays: 1,
      multipliedStandardDays: 1,
      maxWeekCount: 1,
      standardTotal: 300,
      multiplierBonus: 100,
      prepTotal: 0,
      combinedPayout: 300,
    },
  },
  {
    name: 'two show dates in the same week get 1.125x each',
    baseRate: 200,
    scheduledDates: [
      { date: '2026-05-04', type: 'show', week: '2026-W19' },
      { date: '2026-05-05', type: 'show', week: '2026-W19' },
    ],
    assignments: [{ scope: 'whole-job' }],
    expected: {
      quoteDays: 2,
      standardDays: 2,
      multipliedStandardDays: 2,
      maxWeekCount: 2,
      standardTotal: 450,
      multiplierBonus: 50,
      prepTotal: 0,
      combinedPayout: 450,
    },
  },
  {
    name: 'three show dates in the same week use 1x',
    baseRate: 200,
    scheduledDates: [
      { date: '2026-05-04', type: 'show', week: '2026-W19' },
      { date: '2026-05-05', type: 'show', week: '2026-W19' },
      { date: '2026-05-06', type: 'show', week: '2026-W19' },
    ],
    assignments: [{ scope: 'whole-job' }],
    expected: {
      quoteDays: 3,
      standardDays: 3,
      multipliedStandardDays: 0,
      maxWeekCount: 3,
      standardTotal: 600,
      multiplierBonus: 0,
      prepTotal: 0,
      combinedPayout: 600,
    },
  },
  {
    name: 'partial timesheets do not shrink expanded typed dates',
    baseRate: 200,
    scheduledDates: [
      { date: '2026-05-04', type: 'show', week: '2026-W19' },
      { date: '2026-05-05', type: 'show', week: '2026-W19' },
    ],
    assignments: [{ scope: 'whole-job' }],
    activeTimesheetDates: ['2026-05-04'],
    expected: {
      quoteDays: 2,
      standardDays: 2,
      multipliedStandardDays: 2,
      maxWeekCount: 2,
      standardTotal: 450,
      multiplierBonus: 50,
      prepTotal: 0,
      combinedPayout: 450,
    },
  },
  {
    name: 'cross-week dates get separate weekly multipliers',
    baseRate: 200,
    scheduledDates: [
      { date: '2026-05-10', type: 'show', week: '2026-W19' },
      { date: '2026-05-11', type: 'show', week: '2026-W20' },
    ],
    assignments: [{ scope: 'whole-job' }],
    expected: {
      quoteDays: 2,
      standardDays: 2,
      multipliedStandardDays: 2,
      maxWeekCount: 1,
      standardTotal: 600,
      multiplierBonus: 200,
      prepTotal: 0,
      combinedPayout: 600,
    },
  },
  {
    name: 'unassigned rigging date does not count for a whole-job tech',
    baseRate: 200,
    scheduledDates: [
      { date: '2026-05-04', type: 'show', week: '2026-W19' },
      { date: '2026-05-05', type: 'rigging', week: '2026-W19' },
    ],
    assignments: [{ scope: 'whole-job' }],
    expected: {
      quoteDays: 1,
      standardDays: 1,
      multipliedStandardDays: 1,
      maxWeekCount: 1,
      standardTotal: 300,
      multiplierBonus: 100,
      prepTotal: 0,
      combinedPayout: 300,
    },
  },
  {
    name: 'assigned rigging date counts for that technician',
    baseRate: 200,
    scheduledDates: [
      { date: '2026-05-04', type: 'show', week: '2026-W19' },
      { date: '2026-05-05', type: 'rigging', week: '2026-W19' },
    ],
    assignments: [{ scope: 'single-day', date: '2026-05-04' }, { scope: 'single-day', date: '2026-05-05' }],
    expected: {
      quoteDays: 2,
      standardDays: 2,
      multipliedStandardDays: 2,
      maxWeekCount: 2,
      standardTotal: 450,
      multiplierBonus: 50,
      prepTotal: 0,
      combinedPayout: 450,
    },
  },
  {
    name: 'prep day is excluded from quote and added as fixed-rate timesheet',
    baseRate: 200,
    scheduledDates: [
      { date: '2026-05-03', type: 'prep_day', week: '2026-W18' },
      { date: '2026-05-04', type: 'show', week: '2026-W19' },
    ],
    assignments: [{ scope: 'whole-job' }],
    prepTimesheetHours: 8,
    expected: {
      quoteDays: 1,
      standardDays: 1,
      multipliedStandardDays: 1,
      maxWeekCount: 1,
      standardTotal: 300,
      multiplierBonus: 100,
      prepTotal: 120,
      combinedPayout: 420,
    },
  },
  {
    name: 'single-day assignment-only date counts even before typed dates exist',
    baseRate: 200,
    scheduledDates: [],
    assignments: [{ scope: 'single-day', date: '2026-05-04' }],
    expected: {
      quoteDays: 1,
      standardDays: 1,
      multipliedStandardDays: 1,
      maxWeekCount: 1,
      standardTotal: 300,
      multiplierBonus: 100,
      prepTotal: 0,
      combinedPayout: 300,
    },
  },
  {
    name: 'active timesheet-only date counts even before typed dates exist',
    baseRate: 200,
    scheduledDates: [],
    assignments: [],
    activeTimesheetDates: ['2026-05-04'],
    expected: {
      quoteDays: 1,
      standardDays: 1,
      multipliedStandardDays: 1,
      maxWeekCount: 1,
      standardTotal: 300,
      multiplierBonus: 100,
      prepTotal: 0,
      combinedPayout: 300,
    },
  },
  {
    name: 'active timesheet date extends a one-date tour quote to the two-day weekly multiplier',
    baseRate: 200,
    scheduledDates: [{ date: '2026-05-04', type: 'show', week: '2026-W19' }],
    assignments: [{ scope: 'whole-job' }],
    activeTimesheetDates: ['2026-05-05'],
    expected: {
      quoteDays: 2,
      standardDays: 2,
      multipliedStandardDays: 2,
      maxWeekCount: 2,
      standardTotal: 450,
      multiplierBonus: 50,
      prepTotal: 0,
      combinedPayout: 450,
    },
  },
];

describe('tour payroll quote value cases', () => {
  it.each(cases)('$name', (testCase) => {
    expect(calculateCase(testCase)).toEqual(testCase.expected);
  });
});
