import type { BroadcastBody } from "../../types.ts";
import { summarizeTaskChanges } from "../../format.ts";

export function buildTaskMessage(
  type: string,
  actor: string,
  recipName: string,
  body: BroadcastBody,
  contextLabel?: string | null,
): { title: string; text: string; changeSummary?: string } | null {
  if (type !== 'task.assigned' && type !== 'task.updated' && type !== 'task.completed') {
    return null;
  }

  const taskLabel = body.task_type ? `la tarea "${body.task_type}"` : 'una tarea';
  const context = contextLabel ? ` en "${contextLabel}"` : '';

  if (type === 'task.assigned') {
    return {
      title: 'Tarea asignada',
      text: recipName
        ? `${actor} asignó ${taskLabel} a ${recipName}${context}.`
        : `${actor} asignó ${taskLabel}${context}.`,
    };
  }

  if (type === 'task.updated') {
    const changeSummary = summarizeTaskChanges(body.changes);
    return {
      title: 'Tarea actualizada',
      text: changeSummary
        ? `${actor} actualizó ${taskLabel}${context}. Cambios: ${changeSummary}.`
        : `${actor} actualizó ${taskLabel}${context}.`,
      changeSummary: changeSummary || undefined,
    };
  }

  return {
    title: 'Tarea completada',
    text: recipName
      ? `${actor} marcó como completada ${taskLabel} de ${recipName}${context}.`
      : `${actor} marcó como completada ${taskLabel}${context}.`,
  };
}
