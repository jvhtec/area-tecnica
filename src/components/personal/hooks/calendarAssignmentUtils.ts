import { format } from 'date-fns';
import type { PersonalCalendarAssignment } from './usePersonalCalendarData';

const formatDateKey = (date: Date) => format(date, 'yyyy-MM-dd');

export const filterAssignmentsByDate = (
  assignments: PersonalCalendarAssignment[],
  targetDate: Date
): PersonalCalendarAssignment[] => {
  const dayKey = formatDateKey(targetDate);
  return assignments.filter((assignment) => assignment.date === dayKey);
};
