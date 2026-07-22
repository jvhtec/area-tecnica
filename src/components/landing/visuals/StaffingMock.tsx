import { motion } from "framer-motion";
import { Check, Clock, MapPin, Trophy } from "lucide-react";
import { AppWindow } from "./AppWindow";

const candidates = [
  {
    name: "Marta León",
    medal: "from-amber-300 to-yellow-500 text-amber-950",
    rank: 1,
    km: 12,
    reliability: 98,
    status: "accepted" as const,
  },
  {
    name: "Pablo Sanz",
    medal: "from-slate-200 to-slate-400 text-slate-900",
    rank: 2,
    km: 34,
    reliability: 91,
    status: "pending" as const,
  },
  {
    name: "Iván Roca",
    medal: "from-orange-300 to-amber-700 text-amber-950",
    rank: 3,
    km: 58,
    reliability: 87,
    status: "pending" as const,
  },
];

export function StaffingMock() {
  return (
    <AppWindow url="sector-pro.work/staffing" title="Motor de staffing">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white">Campaña · Monitores</p>
          <p className="text-[11px] text-slate-500">Festival Sonorama · Sáb 13</p>
        </div>
        <span className="rounded-full bg-sky-500/15 px-2.5 py-1 text-[11px] font-medium text-sky-300">
          Rankeando 14 candidatos
        </span>
      </div>

      <div className="space-y-2.5">
        {candidates.map((c, i) => (
          <motion.div
            key={c.name}
            initial={{ opacity: 0, x: 16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: i * 0.12 }}
            className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3"
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-xs font-bold ${c.medal}`}
            >
              {c.rank}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-slate-100">{c.name}</p>
              <div className="mt-0.5 flex items-center gap-3 text-[11px] text-slate-500">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {c.km} km
                </span>
                <span className="flex items-center gap-1">
                  <Trophy className="h-3 w-3" /> {c.reliability}% fiabilidad
                </span>
              </div>
            </div>
            {c.status === "accepted" ? (
              <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
                <Check className="h-3 w-3" /> Aceptó
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-medium text-amber-300">
                <Clock className="h-3 w-3" /> Invitado
              </span>
            )}
          </motion.div>
        ))}
      </div>
    </AppWindow>
  );
}
