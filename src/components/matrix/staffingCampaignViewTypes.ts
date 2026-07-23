import type { Dispatch, SetStateAction } from "react";
import type {
  JobProfileName,
  ProfileDefaults,
  RoleProfilePolicy,
} from "@/features/staffing/crewingProfiles";
import type {
  Campaign,
  CampaignRole,
  JobMeta,
  StaffingCampaignFormData,
} from "@/components/matrix/StaffingCampaignPanel";

type MutationControl = {
  mutate: () => void;
  isPending: boolean;
};

export interface StaffingCampaignViewProps {
  jobMeta?: JobMeta;
  inferredJobProfile: JobProfileName;
  profileOverrideActive: boolean;
  roleCodes: string[];
  roleProfiles: Record<string, RoleProfilePolicy>;
  selectedProfileDefaults: ProfileDefaults;
  applyProfileDefaults: (profile: JobProfileName) => void;
  updateRoleProfileOverride: (roleCode: string, profile: JobProfileName) => void;
  formData: StaffingCampaignFormData;
  setFormData: Dispatch<SetStateAction<StaffingCampaignFormData>>;
  updateMode: (mode: "assisted" | "auto") => void;
  campaign?: Campaign | null;
  jobTitle?: string;
  department: string;
  showStartDialog: boolean;
  setShowStartDialog: Dispatch<SetStateAction<boolean>>;
  startMutation: MutationControl;
  campaignRoles?: CampaignRole[];
  getStatusColor: (status: string) => string;
  getStageColor: (stage: string) => string;
  updateMutation: MutationControl;
  pauseMutation: MutationControl;
  resumeMutation: MutationControl;
  stopMutation: MutationControl;
}
