type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === 'object' && value !== null ? (value as UnknownRecord) : null;
}

function asLowerText(value: unknown): string {
  return typeof value === 'string' ? value.toLowerCase() : '';
}

/**
 * Detect unique conflicts for task-assignee context indexes.
 */
export function isTaskAssigneeUniqueConflict(error: unknown): boolean {
  const record = asRecord(error);
  if (!record) return false;

  const code = asLowerText(record.code);
  if (code !== '23505') return false;

  const combined = [
    asLowerText(record.constraint),
    asLowerText(record.message),
    asLowerText(record.details),
    asLowerText(record.hint),
  ].join(' ');

  return combined.includes('task_assignee_context');
}

