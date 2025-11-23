import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, ChevronLeft, ChevronRight, Clock, MapPin, Sun, Moon } from "lucide-react";
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

const themeTokens = {
  dark: {
    bg: "bg-[#05070a]",
    card: "bg-[#0f1219] border-[#1f232e]",
    textMain: "text-white",
    textMuted: "text-[#94a3b8]",
    divider: "border-[#1f232e]",
  },
  light: {
    bg: "bg-[#f8fafc]",
    card: "bg-white border-slate-200 shadow-sm",
    textMain: "text-slate-900",
    textMuted: "text-slate-500",
    divider: "border-slate-100",
  },
};

export const DepartmentMobileHub: React.FC<DepartmentMobileHubProps> = ({
  department,
  title,
  icon: Icon,
  tools,
}) => {
  const isMobile = useIsMobile();
  const { data: jobs } = useJobs();
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(true);

  const t = isDark ? themeTokens.dark : themeTokens.light;

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
    <div className={cn("min-h-screen", t.bg, "font-sans px-safe pt-safe-4 pb-safe-6")>
      <div className="max-w-md mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-blue-500 text-xs font-semibold uppercase tracking-[0.08em]">
              <Icon className="h-4 w-4" />
              <span>{department}</span>
            </div>
            <h2 className={cn("text-2xl font-bold", t.textMain)}>{title}</h2>
          </div>
          <Button
            variant="outline"
            size="icon"
            className={cn("rounded-full", t.card)}
            onClick={() => setIsDark((prev) => !prev)}
          >
            {isDark ? <Sun className={cn("h-5 w-5", t.textMuted)} /> : <Moon className={cn("h-5 w-5", t.textMuted)} />}
          </Button>
        </div>

        <Card className={cn("p-4 rounded-2xl", t.card)}>
          <h3 className={cn("text-xs font-bold uppercase tracking-wider mb-3", t.textMuted)}>Herramientas rápidas</h3>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
            {tools.map((tool) => (
              <Button
                key={tool.to}
                variant="outline"
                className={cn("min-w-[90px] h-[82px] flex flex-col items-center justify-center rounded-xl text-center", t.card)}
                onClick={() => navigate(tool.to)}
              >
                <tool.icon className="h-5 w-5 mb-1 text-primary" />
                <span className={cn("text-[11px] font-semibold leading-tight", t.textMain)}>{tool.label}</span>
              </Button>
            ))}
          </div>
        </Card>

        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="rounded-lg" aria-label="Día anterior">
              <ChevronLeft className={cn("h-4 w-4", t.textMuted)} />
            </Button>
            <div className="text-left">
              <div className={cn("text-lg font-bold leading-tight", t.textMain)}>Hoy</div>
              <div className={cn("text-xs", t.textMuted)}>
                {today.toLocaleDateString(undefined, { day: "numeric", month: "short" })}
              </div>
            </div>
            <Button variant="ghost" size="icon" className="rounded-lg" aria-label="Día siguiente">
              <ChevronRight className={cn("h-4 w-4", t.textMuted)} />
            </Button>
          </div>
          <Button variant="outline" size="icon" className={cn("rounded-lg", t.card)}>
            <Calendar className={cn("h-4 w-4", t.textMain)} />
          </Button>
        </div>

        <Card className={cn("p-4 rounded-2xl", t.card)}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className={cn("text-xs font-bold uppercase tracking-wider", t.textMuted)}>Disponibilidad</div>
              <div className={cn("text-sm", t.textMuted)}>Resumen de técnicos de planta</div>
            </div>
            <Button variant="ghost" size="icon" className="rounded-full">
              <ChevronRight className={cn("h-4 w-4", t.textMuted)} />
            </Button>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className={cn("text-sm font-semibold", t.textMain)}>{todayCount} en activo</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-slate-500" />
              <span className={cn("text-sm font-semibold", t.textMain)}>{Math.max(filteredJobs.length - todayCount, 0)} próximos</span>
            </div>
          </div>
        </Card>

        <div className="space-y-3">
          {nextJobs.length === 0 ? (
            <Card className={cn("p-4 rounded-2xl", t.card)}>
              <div className={cn("text-sm", t.textMuted)}>No hay trabajos asignados al departamento.</div>
            </Card>
          ) : (
            nextJobs.map((job) => (
              <Card
                key={job.id}
                className={cn(
                  "p-4 rounded-2xl border-l-4",
                  t.card,
                  job.status === "production" ? "border-l-emerald-500" : "border-l-blue-500"
                )}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className={cn("font-bold text-lg", t.textMain)}>{job.title}</h3>
                    <div className={cn("text-xs flex items-center gap-1 mt-1", t.textMuted)}>
                      <MapPin className="h-3 w-3" />
                      {job.locations?.[0]?.name || "Sin ubicación"}
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-primary/10 text-primary">
                    {job.job_type}
                  </span>
                </div>
                <div className={cn("flex items-center gap-4 text-xs mt-2 pb-3 border-b", t.textMuted, t.divider)}>
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    {new Date(job.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button variant="outline" className="flex-1" onClick={() => navigate(`/jobs/view/${job.id}`)}>
                    Ver detalles
                  </Button>
                  <Button className="flex-1" onClick={() => navigate(`/jobs/view/${job.id}`)}>
                    Gestionar
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
