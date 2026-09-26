import { AlertTriangle, Info } from "lucide-react";

import type { PowerStandardsFinding } from "@/features/technical-tools/power/electricalStandards";

/**
 * Advisory notes from the Spanish design rules (REBT / UNE-HD 60364). They
 * never restate the calculated totals — they say what the regulation adds on
 * top of them.
 */
export const PowerStandardsNotes = ({
  className = "",
  findings,
}: {
  className?: string;
  findings: PowerStandardsFinding[];
}) => {
  if (findings.length === 0) return null;

  return (
    <ul className={`space-y-2 text-sm ${className}`.trim()}>
      {findings.map((finding) => {
        const isWarning = finding.severity === "warning";
        const Icon = isWarning ? AlertTriangle : Info;
        return (
          <li
            key={finding.code}
            className={`flex gap-2 rounded-md border p-3 ${
              isWarning
                ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
                : "border-muted-foreground/20 bg-muted/40 text-muted-foreground"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              <span className="font-medium">{finding.reference}</span>
              {" — "}
              {finding.message}
            </span>
          </li>
        );
      })}
    </ul>
  );
};
