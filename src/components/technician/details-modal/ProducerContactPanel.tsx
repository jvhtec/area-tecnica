import { Loader2, Mail, MessageCircle, Phone, UserCog } from "lucide-react";

import type { JobProducerContact } from "@/features/jobs/producer-claims/producerClaims";
import type { Theme } from "@/components/technician/types";
import { buildTelHref, buildWhatsAppHref } from "@/utils/phoneLinks";

type Props = {
  contacts: JobProducerContact[];
  isDark: boolean;
  isLoading: boolean;
  jobTitle?: string | null;
  theme: Theme;
};

const getInitials = (displayName: string): string =>
  displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "P";

/**
 * Who to call about anything that is not technical. Rendered in the tech super
 * app so a technician on site can reach the production-department user carrying
 * the job without hunting for the number somewhere else.
 */
export const ProducerContactPanel = ({ contacts, isDark, isLoading, jobTitle, theme }: Props) => {
  if (!isLoading && contacts.length === 0) return null;

  const heading = contacts.length > 1 ? "Responsables de producción" : "Responsable de producción";

  return (
    <div>
      <label className={`text-xs ${theme.textMuted} font-bold uppercase mb-2 block`}>{heading}</label>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
          <span className={theme.textMuted}>Cargando responsable...</span>
        </div>
      ) : (
        <div className="space-y-2">
          {contacts.map((contact) => {
            const whatsappHref = buildWhatsAppHref(
              contact.phone,
              jobTitle ? `Hola ${contact.display_name}, te escribo por «${jobTitle}».` : undefined,
            );
            const telHref = buildTelHref(contact.phone);

            return (
              <div
                key={contact.producer_id}
                className={`p-3 rounded-lg border ${isDark ? "bg-[#151820] border-[#2a2e3b]" : "bg-slate-50 border-slate-200"}`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${
                      isDark ? "bg-[#1f2430] text-slate-200" : "bg-slate-200 text-slate-700"
                    }`}
                    aria-hidden="true"
                  >
                    {getInitials(contact.display_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm font-semibold ${theme.textMain} truncate`}>
                      {contact.display_name}
                    </div>
                    <div className={`flex items-center gap-1 text-xs ${theme.textMuted}`}>
                      <UserCog size={11} className="shrink-0" />
                      <span className="truncate">Producción</span>
                    </div>
                  </div>
                </div>

                {contact.phone || contact.email ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {whatsappHref && (
                      <a
                        href={whatsappHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Escribir por WhatsApp a ${contact.display_name}`}
                        className="flex-1 min-w-[7rem] min-h-[2.5rem] px-3 rounded-lg border border-emerald-600/40 bg-emerald-600/15 text-emerald-500 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-emerald-600/25 transition-colors"
                      >
                        <MessageCircle size={14} className="shrink-0" />
                        WhatsApp
                      </a>
                    )}
                    {telHref && (
                      <a
                        href={telHref}
                        aria-label={`Llamar a ${contact.display_name}`}
                        className={`flex-1 min-w-[6rem] min-h-[2.5rem] px-3 rounded-lg border ${theme.divider} text-xs font-semibold flex items-center justify-center gap-1.5 ${theme.textMain} hover:bg-white/5 transition-colors`}
                      >
                        <Phone size={14} className="shrink-0" />
                        Llamar
                      </a>
                    )}
                    {contact.email && (
                      <a
                        href={`mailto:${contact.email}`}
                        aria-label={`Enviar un correo a ${contact.display_name}`}
                        className={`flex-1 min-w-[6rem] min-h-[2.5rem] px-3 rounded-lg border ${theme.divider} text-xs font-semibold flex items-center justify-center gap-1.5 ${theme.textMain} hover:bg-white/5 transition-colors`}
                      >
                        <Mail size={14} className="shrink-0" />
                        Email
                      </a>
                    )}
                  </div>
                ) : (
                  <div className={`mt-2 text-xs ${theme.textMuted} italic`}>
                    Sin datos de contacto en su perfil
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
