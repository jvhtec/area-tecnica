import type { createClient } from "../deps.ts";
import type { BroadcastBody, DepartmentRoleSummary, PushNotificationRoute } from "../types.ts";

export type BroadcastClient = ReturnType<typeof createClient>;

export type BroadcastMetaExtras = {
  view?: string;
  department?: string;
  description?: string;
  targetUrl?: string;
  targetDate?: string;
  singleDay?: boolean;
  requirementsSummary?: DepartmentRoleSummary[];
  requirementsSummaryText?: string;
};

export type BroadcastMessageState = {
  title: string;
  text: string;
  url: string;
  metaExtras: BroadcastMetaExtras;
  changeSummary?: string;
};

export type BroadcastRecipients = {
  recipients: Set<string>;
  naturalRecipients: Set<string>;
  management: Set<string>;
  soundDept: Set<string>;
  admin: Set<string>;
  mgmt: Set<string>;
  participants: Set<string>;
  addRecipients: (ids: (string | null | undefined)[]) => void;
  addNaturalRecipients: (ids: (string | null | undefined)[]) => void;
  clearAllRecipients: () => void;
};

export type BroadcastEventContext = {
  client: BroadcastClient;
  userId: string;
  body: BroadcastBody;
  type: string;
  jobId?: string;
  jobTitle: string;
  jobDepartment: string | null;
  jobType: string | null;
  tourId?: string;
  tourName: string | null;
  routes: PushNotificationRoute[];
  actor: string;
  recipName: string;
  channelLabel: string;
  rawTargetDate?: string;
  normalizedTargetDate: string | null;
  formattedTargetDate: string | null;
  singleDayFlag: boolean;
  state: BroadcastMessageState;
  audience: BroadcastRecipients;
  getScopedManagementIds: (technicianId: string | undefined, context?: string, departmentHint?: string | null) => Promise<string[]>;
};

export type BroadcastHandlerResult = false | true | Response;
export type BroadcastEventHandler = (context: BroadcastEventContext) => Promise<BroadcastHandlerResult>;

export function setBroadcastMessage(
  state: BroadcastMessageState,
  title: string,
  text: string,
) {
  state.title = title;
  state.text = text;
}
