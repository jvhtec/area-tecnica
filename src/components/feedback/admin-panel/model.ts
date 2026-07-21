export type BugReport = {
  id: string;
  title: string;
  description: string;
  reproduction_steps: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'resolved';
  reporter_email: string;
  github_issue_url: string | null;
  github_issue_number: number | null;
  screenshot_url: string | null;
  console_logs: Array<{ type: string; message: string; timestamp: string }> | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  admin_notes: string | null;
  app_version: string | null;
  environment_info: Record<string, unknown> | null;
};

export type FeatureRequest = {
  id: string;
  title: string;
  description: string;
  use_case: string | null;
  status: 'pending' | 'under_review' | 'accepted' | 'rejected' | 'completed';
  reporter_email: string;
  created_at: string;
  updated_at: string;
  admin_notes: string | null;
};

export const severityColors: Record<BugReport['severity'], string> = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
};

export const bugStatusColors: Record<BugReport['status'], string> = {
  open: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-purple-100 text-purple-800',
  resolved: 'bg-green-100 text-green-800',
};

export const featureStatusColors: Record<FeatureRequest['status'], string> = {
  pending: 'bg-gray-100 text-gray-800',
  under_review: 'bg-blue-100 text-blue-800',
  accepted: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  completed: 'bg-emerald-100 text-emerald-800',
};
