import type { FlexLinkIntent } from "@/utils/flex-folders";

export function mapViewHintToIntent(viewHint?: string | null): FlexLinkIntent | "auto" | undefined {
  if (!viewHint || typeof viewHint !== "string") {
    return undefined;
  }

  const normalized = viewHint.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  if (normalized === "auto") {
    return "auto";
  }

  const canonical = normalized.replace(/[\s_]+/g, "-");

  switch (canonical) {
    case "contact-list":
    case "contactlist":
    case "crew-call":
    case "crewcall":
    case "crew-list":
    case "crewlist":
      return "contact-list";
    case "equipment-list":
    case "equipmentlist":
    case "pull-sheet":
    case "pullsheet":
    case "pull-list":
    case "pulllist":
      return "equipment-list";
    case "remote-file-list":
    case "remotefilelist":
    case "remote-files":
    case "remotefiles":
    case "remote-files-list":
      return "remote-file-list";
    case "expense-sheet":
    case "expensesheet":
    case "expense":
      return "expense-sheet";
    case "fin-doc":
    case "financial-document":
    case "financial-doc":
    case "financialdoc":
    case "presupuesto":
      return "fin-doc";
    case "simple-element":
    case "folder":
    case "element":
      return "simple-element";
    default:
      return undefined;
  }
}

