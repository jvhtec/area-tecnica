import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { CreateJobDialog } from '@/components/jobs/CreateJobDialog';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';

export default function NewJobSetup() {
  const navigate = useNavigate();
  const { userDepartment } = useOptimizedAuth();
  const [open, setOpen] = useState(true);
  const created = useRef(false);

  const close = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen && !created.current) navigate('/project-management');
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
      <Button variant="ghost" size="sm" className="-ml-3 gap-2" onClick={() => navigate('/project-management')}><ArrowLeft className="h-4 w-4" />Proyectos</Button>
      <Card><CardHeader><CardTitle>Nuevo trabajo con preparación guiada</CardTitle><CardDescription>Primero crea el trabajo con el formulario habitual. Después abrirás su lista de preparación persistente.</CardDescription></CardHeader></Card>
      <CreateJobDialog open={open} onOpenChange={close} currentDepartment={userDepartment ?? 'sound'} onCreated={(job) => { created.current = true; navigate(`/jobs/${job.id}/setup`); }} />
    </div>
  );
}
