import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, ChevronRight, MapPin, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useJobs } from "@/hooks/useJobs";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface ToolLink {
  label: string;
  to: string;
  icon: React.ElementType;
}

interface DepartmentMobileHubProps {
  department: string;
  title: string;
  icon: React.ElementType;
  tools: ToolLink[];
}

export const DepartmentMobileHub: React.FC<DepartmentMobileHubProps> = ({
  department,
  title,
  icon: Icon,
  tools,
}) => {
  const isMobile = useIsMobile();
  const { data: jobs } = useJobs();
  const navigate = useNavigate();

  const today = useMemo(() => new Date(), []);

  const filteredJobs = useMemo(() => {
    if (!jobs) return [];
    return jobs
      .filter((job) => job.job_departments?.some((d: any) => d.department === department))
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  }, [jobs, department]);

  const todayCount = filteredJobs.filter((job) => {
    const start = new Date(job.start_time);
    const end = new Date(job.end_time);
    const todayMid = new Date(today);
    todayMid.setHours(12, 0, 0, 0);
    return start <= todayMid && todayMid <= end;
  }).length;

  const nextJobs = filteredJobs.slice(0, 3);

  if (!isMobile) return null;

  return (
    <div className="w-full max-w-md mx-auto px-4 sm:px-0 space-y-4">
      <Card className="p-4 rounded-2xl border shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2 text-blue-500 text-xs font-semibold uppercase tracking-[0.08em]">
              <Icon className="h-4 w-4" />
              <span>{department}</span>
            </div>
            <h2 className="text-xl font-bold leading-tight">{title}</h2>
            <p className="text-xs text-muted-foreground">Panel móvil: herramientas, personal y trabajos.</p>
          </div>
          <Button variant="outline" size="icon" className="rounded-full" onClick={() => navigate(`/${department}`)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
          {tools.map((tool) => (
            <Button
              key={tool.to}
              variant="outline"
              className="min-w-[90px] h-[82px] flex flex-col items-center justify-center rounded-xl"
              onClick={() => navigate(tool.to)}
            >
              <tool.icon className="h-5 w-5 mb-1 text-primary" />
              <span className="text-[11px] font-semibold leading-tight text-center">{tool.label}</span>
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 mt-4">
          <div className="rounded-xl border bg-muted/50 px-3 py-2">
            <div className="text-[11px] uppercase font-semibold text-muted-foreground">Hoy</div>
            <div className="text-xl font-bold">{todayCount}</div>
            <div className="text-[11px] text-muted-foreground">Trabajos activos</div>
          </div>
          <div className="rounded-xl border bg-muted/50 px-3 py-2">
            <div className="text-[11px] uppercase font-semibold text-muted-foreground">Próximos</div>
            <div className="text-xl font-bold">{Math.max(filteredJobs.length - todayCount, 0)}</div>
            <div className="text-[11px] text-muted-foreground">Programados</div>
          </div>
        </div>
      </Card>

      <Card className="p-4 rounded-2xl border shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Calendar className="h-4 w-4 text-primary" />
          <span>Agenda rápida</span>
        </div>
        {nextJobs.length === 0 ? (
          <div className="text-sm text-muted-foreground">No hay trabajos asignados al departamento.</div>
        ) : (
          <div className="space-y-2">
            {nextJobs.map((job) => (
              <button
                key={job.id}
                onClick={() => navigate(`/jobs/view/${job.id}`)}
                className="w-full text-left p-3 rounded-xl border bg-card hover:border-primary/50 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold leading-tight truncate">{job.title}</div>
                  <span
                    className={cn(
                      "text-[11px] px-2 py-0.5 rounded-full uppercase font-semibold",
                      job.job_type === 'tour' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                    )}
                  >
                    {job.job_type}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  {new Date(job.start_time).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                </div>
                {job.locations?.[0]?.name && (
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    <span className="truncate">{job.locations[0].name}</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
