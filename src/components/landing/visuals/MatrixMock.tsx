import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { AppWindow } from "./AppWindow";

type Status = "accepted" | "pending" | "declined" | "empty" | "conflict";

const DEPTS = {
  sound: { dot: "bg-sky-400", label: "Sonido" },
  lights: { dot: "bg-amber-400", label: "Luces" },
  video: { dot: "bg-violet-400", label: "Vídeo" },
  logistics: { dot: "bg-emerald-400", label: "Logística" },
} as const;

type Dept = keyof typeof DEPTS;

type Medal = 1 | 2 | 3 | null;

const techs: { name: string; dept: Dept; role: string; medal: Medal; row: Status[] }[] = [
  { name: "Javier Ruiz", dept: "sound", role: "FOH", medal: 1, row: ["accepted", "accepted", "accepted", "pending"] },
  { name: "Marta León", dept: "sound", role: "Monitores", medal: 2, row: ["accepted", "pending", "accepted", "empty"] },
  { name: "Carlos Vidal", dept: "lights", role: "Responsable", medal: 3, row: ["accepted", "accepted", "conflict", "accepted"] },
  { name: "Ana Soto", dept: "lights", role: "Spot", medal: null, row: ["pending", "accepted", "accepted", "accepted"] },
  { name: "Diego Marín", dept: "video", role: "Realización", medal: null, row: ["accepted", "declined", "pending", "accepted"] },
  { name: "Lucía Gómez", dept: "logistics", role: "Carga", medal: null, row: ["empty", "accepted", "accepted", "pending"] },
];

const medalStyle: Record<1 | 2 | 3, string> = {
  1: "bg-gradient-to-br from-amber-300 to-yellow-500 text-amber-950",
  2: "bg-gradient-to-br from-slate-200 to-slate-400 text-slate-800",
  3: "bg-gradient-to-br from-orange-300 to-amber-700 text-amber-950",
};

const initials = (n: string) =>
  n
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");

const cols = ["Vie 12", "Sáb 13", "Dom 14", "Lun 15"];

const cellStyle: Record<Status, string> = {
  accepted: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  pending: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  declined: "bg-rose-500/15 text-rose-300 border-rose-500/25",
  conflict: "bg-rose-500/20 text-rose-200 border-rose-400/60 ring-1 ring-rose-400/60",
  empty: "bg-white/[0.02] text-slate-600 border-white/5",
};

const cellLabel: Record<Status, string> = {
  accepted: "OK",
  pending: "···",
  declined: "✕",
  conflict: "!",
  empty: "—",
};

export function MatrixMock() {
  const reduce = useReducedMotion();

  return (
    <AppWindow url="sector-pro.work/matrix" title="Matriz de asignación">
      {/* legend */}
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500/40" /> Aceptado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-amber-500/40" /> Pendiente
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-rose-500/40" /> Rechazado
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-rose-300">
          <AlertTriangle className="h-3 w-3" /> Doble reserva detectada
        </span>
      </div>

      {/* grid */}
      <div className="grid grid-cols-[1.4fr_repeat(4,1fr)] gap-1.5 text-xs">
        <div />
        {cols.map((c) => (
          <div key={c} className="pb-1 text-center text-[11px] font-medium text-slate-400">
            {c}
          </div>
        ))}

        {techs.map((t, ri) => (
          <div key={t.name} className="contents">
            <div className="flex items-center gap-2 py-1 pr-2">
              <span className="relative shrink-0">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.06] text-[10px] font-semibold text-slate-300 ring-1 ring-white/10">
                  {initials(t.name)}
                </span>
                {t.medal && (
                  <span
                    className={`absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-bold shadow ${medalStyle[t.medal]}`}
                  >
                    {t.medal}
                  </span>
                )}
                <span
                  className={`absolute -left-0.5 top-0 h-2 w-2 rounded-full ring-2 ring-slate-900 ${DEPTS[t.dept].dot}`}
                />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[12px] font-medium text-slate-200">{t.name}</span>
                <span className="block truncate text-[10px] text-slate-500">{t.role}</span>
              </span>
            </div>
            {t.row.map((s, ci) => (
              <motion.div
                key={ci}
                initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: reduce ? 0 : 0.04 * (ri + ci) }}
                className={`relative flex h-9 items-center justify-center rounded-md border text-[11px] font-semibold ${cellStyle[s]}`}
              >
                {cellLabel[s]}
                {s === "conflict" && (
                  <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-rose-500 text-[8px] text-white shadow">
                    !
                  </span>
                )}
              </motion.div>
            ))}
          </div>
        ))}
      </div>

      {/* footer stat */}
      <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3 text-[11px] text-slate-400">
        <span>6 técnicos · 4 fechas · 3 departamentos</span>
        <span className="text-emerald-300">18 confirmados</span>
      </div>
    </AppWindow>
  );
}
