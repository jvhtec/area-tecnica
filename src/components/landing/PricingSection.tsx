import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Infinity as InfinityIcon, Minus, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { GRADIENT_BTN, GRADIENT_TEXT } from "./_shared";
import { SectionHeading } from "./SectionHeading";

const ADMIN_BASE = 250; // € / mes — base de cuenta (incluye 1 admin + 8 GB)
const MANAGER_PRICE = 25; // € / coordinador · mes
const INTEGRATION_PRICE = 9; // € / integración · mes (tarifa plana)
const WHATSAPP_PER_USER = 4; // € / usuario · mes (WhatsApp se factura por usuario)

const integrationOptions = [
  { id: "flex", name: "Flex Rental Solutions", price: INTEGRATION_PRICE, perUser: false },
  { id: "gmaps", name: "Google Maps / Places", price: INTEGRATION_PRICE, perUser: false },
  { id: "mapbox", name: "Mapbox", price: INTEGRATION_PRICE, perUser: false },
  { id: "whatsapp", name: "WhatsApp", price: WHATSAPP_PER_USER, perUser: true },
  { id: "ics", name: "Calendar (ICS)", price: INTEGRATION_PRICE, perUser: false },
];

export function PricingSection() {
  const navigate = useNavigate();
  // Default reflects a typical production company (~8 coordinators + common
  // integrations) — lands around the ~500 €/mes target ARPA.
  const [managers, setManagers] = useState(8);
  const [active, setActive] = useState<Record<string, boolean>>({
    flex: true,
    gmaps: true,
    whatsapp: true,
  });

  const billableUsers = managers + 1; // admin + coordinadores (WhatsApp se factura por usuario)
  const managersCost = managers * MANAGER_PRICE;
  const integrationsCost = integrationOptions.reduce(
    (sum, opt) => (active[opt.id] ? sum + (opt.perUser ? opt.price * billableUsers : opt.price) : sum),
    0,
  );
  const monthly = ADMIN_BASE + managersCost + integrationsCost;

  const toggle = (id: string) => setActive((s) => ({ ...s, [id]: !s[id] }));
  const clampManagers = (n: number) => Math.max(1, Math.min(50, n));

  return (
    <section id="precios" className="relative px-6 py-24 scroll-mt-20">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Precios"
          title="Paga por quien coordina,"
          highlight="no por quien curra"
          lead="La competencia te cobra por cada técnico. Aquí los técnicos son ilimitados y gratis — pagas una base de cuenta, los coordinadores y las integraciones que enciendes."
        />

        <div className="mt-14 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          {/* Model */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.08] to-transparent p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300">
                  <InfinityIcon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-lg font-semibold text-white">Técnicos ilimitados</p>
                  <p className="text-sm text-emerald-300">0 € · para siempre</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-slate-400">
                Invita a toda tu plantilla y freelances. Disponibilidad, fichajes, asignaciones y la
                súper-app del técnico, sin coste por cabeza.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                <p className="text-sm font-medium text-slate-300">Base de cuenta</p>
                <p className="mt-2 text-3xl font-bold text-white">
                  {ADMIN_BASE} €<span className="text-base font-normal text-slate-500"> /mes</span>
                </p>
                <p className="mt-1 text-[12px] text-slate-500">1 admin · 8 GB incluidos</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                <p className="text-sm font-medium text-slate-300">Coordinador</p>
                <p className="mt-2 text-3xl font-bold text-white">
                  {MANAGER_PRICE} €<span className="text-base font-normal text-slate-500"> /mes</span>
                </p>
                <p className="mt-1 text-[12px] text-slate-500">por usuario que gestiona</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                <p className="text-sm font-medium text-slate-300">Integración</p>
                <p className="mt-2 text-3xl font-bold text-white">
                  +{INTEGRATION_PRICE} €<span className="text-base font-normal text-slate-500"> /mes</span>
                </p>
                <p className="mt-1 text-[12px] text-slate-500">WhatsApp: +{WHATSAPP_PER_USER} € /usuario</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-violet-500/25 bg-violet-500/[0.06] p-5">
              <span className="rounded-md border border-violet-400/30 bg-violet-500/10 px-2 py-1 font-mono text-[10px] uppercase text-violet-200">
                Próximamente
              </span>
              <p className="text-sm text-slate-300">
                Integración con <span className="font-semibold text-white">Rentman</span> —{" "}
                <span className="text-violet-200">incluida sin coste extra</span>.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <p className="text-sm font-semibold text-white">Frente a la competencia</p>
              <div className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-[13px]">
                <span className="text-slate-500">Ellos</span>
                <span className="text-slate-400">
                  Por usuario (mín. 40) <span className="text-slate-600">+</span> add-ons por módulo
                  (payroll, travel, subcontratas…) <span className="text-slate-600">·</span> 0,5–5 GB.
                </span>
                <span className="font-medium text-sky-300">Sector Pro</span>
                <span className="text-slate-200">
                  Técnicos <span className="font-medium text-white">ilimitados y gratis</span> ·{" "}
                  <span className="font-medium text-white">todos los módulos incluidos</span> ·{" "}
                  <span className="font-medium text-white">8 GB</span>, sin add-ons.
                </span>
              </div>
            </div>
          </div>

          {/* Estimator */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
            <p className="text-sm font-semibold text-white">Calcula tu plan</p>

            {/* managers stepper */}
            <div className="mt-6">
              <div className="flex items-center justify-between">
                <label className="text-sm text-slate-300">Coordinadores</label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setManagers((m) => clampManagers(m - 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/10"
                    aria-label="Quitar coordinador"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-8 text-center font-mono text-lg text-white">{managers}</span>
                  <button
                    onClick={() => setManagers((m) => clampManagers(m + 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/10"
                    aria-label="Añadir coordinador"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <input
                type="range"
                min={1}
                max={20}
                value={managers}
                onChange={(e) => setManagers(clampManagers(Number(e.target.value)))}
                className="mt-4 w-full accent-sky-400"
              />
            </div>

            {/* integrations */}
            <div className="mt-6">
              <p className="text-sm text-slate-300">Integraciones</p>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {integrationOptions.map((opt) => {
                  const on = !!active[opt.id];
                  return (
                    <button
                      key={opt.id}
                      onClick={() => toggle(opt.id)}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-[13px] transition-colors ${
                        on
                          ? "border-sky-400/40 bg-sky-500/10 text-white"
                          : "border-white/10 bg-white/[0.02] text-slate-400 hover:border-white/20"
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          on ? "border-sky-400 bg-sky-400 text-slate-900" : "border-white/20"
                        }`}
                      >
                        {on && <Check className="h-3 w-3" />}
                      </span>
                      <span className="flex-1 truncate">{opt.name}</span>
                      <span className="shrink-0 font-mono text-[10px] text-slate-500">
                        +{opt.price} €{opt.perUser ? "/u" : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* total */}
            <div className="mt-8 border-t border-white/10 pt-6">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[12px] text-slate-500">Total estimado</p>
                  <p className="text-[12px] text-emerald-300">técnicos ilimitados incluidos</p>
                </div>
                <motion.p
                  key={monthly}
                  initial={{ opacity: 0.4, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-right text-4xl font-bold text-white"
                >
                  {monthly} €<span className="text-base font-normal text-slate-500"> /mes</span>
                </motion.p>
              </div>
              <p className="mt-2 text-right text-[12px] text-slate-500">
                {ADMIN_BASE} € base + {managers} × {MANAGER_PRICE} € coordinadores
                {integrationsCost > 0 ? ` + ${integrationsCost} € integraciones` : ""} · facturación anual: 2 meses gratis
              </p>
              <Button
                onClick={() => navigate("/auth")}
                className={`mt-6 h-12 w-full text-base font-semibold text-white ${GRADIENT_BTN}`}
              >
                Empieza gratis
              </Button>
              <p className="mt-3 text-center text-[12px] text-slate-500">
                Sin tarjeta · <span className={GRADIENT_TEXT}>técnicos gratis desde el día uno</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
