import { useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { MatrixJob } from '@/hooks/useOptimizedMatrixData';
import {
  createMatrixCommandRunner,
  type MatrixCommandRunner,
} from '@/features/matrix-v2/commandRunner';
import type { MatrixTechnicianRef } from '@/features/matrix-v2/types';

interface Options {
  jobs: MatrixJob[];
  technicians: MatrixTechnicianRef[];
}

/**
 * The Matrix's one entry point for changing an assignment. Holds the runner for
 * the life of the page: leaving the route releases any effects still waiting
 * out their undo window, so navigating away never drops a notification.
 */
export function useMatrixCommandRunner({ jobs, technicians }: Options): MatrixCommandRunner {
  const queryClient = useQueryClient();
  const jobsRef = useRef(new Map<string, MatrixJob>());
  const techniciansRef = useRef(new Map<string, MatrixTechnicianRef>());

  jobsRef.current = useMemo(() => new Map(jobs.map((job) => [job.id, job])), [jobs]);
  techniciansRef.current = useMemo(() => new Map(technicians.map((tech) => [tech.id, tech])), [technicians]);

  const runner = useMemo(
    () => createMatrixCommandRunner({
      queryClient,
      getJob: (jobId) => jobsRef.current.get(jobId),
      getTechnician: (technicianId) => techniciansRef.current.get(technicianId),
      onEffectsSettled: (_commandId, summary) => {
        if (summary.failed > 0) {
          toast.error('El cambio se guardó, pero falló la sincronización con Flex o la notificación. Queda registrado para reintentar.');
        }
      },
    }),
    [queryClient],
  );

  useEffect(() => () => runner.releaseAll(), [runner]);
  return runner;
}
