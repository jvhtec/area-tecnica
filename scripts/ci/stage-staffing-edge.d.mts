export const STAFFING_EDGE_ROOTS: readonly [
  'staffing-orchestrator',
  'send-staffing-email',
  'notify-staffing-cancellation',
  'push',
  'manage-flex-crew-assignments',
];

export type StaffingEdgeRoot = typeof STAFFING_EDGE_ROOTS[number];

export interface StaffingEdgeFileEvidence {
  path: string;
  bytes: number;
  sha256: string;
  source: string | null;
  sourceSha256: string | null;
  prelude: boolean;
}

export interface StaffingEdgeStagingReport {
  protocol: number;
  outputDirectory: string;
  roots: StaffingEdgeRoot[];
  manifest: Record<StaffingEdgeRoot, { verify_jwt: boolean }>;
  counts: {
    entrypoints: number;
    sourceFiles: number;
    runtimeFiles: number;
    stagedFiles: number;
  };
  configSha256: string;
  files: StaffingEdgeFileEvidence[];
}

export function stageStaffingEdge(options: {
  outputDirectory: string;
  checkoutRoot?: string;
}): StaffingEdgeStagingReport;
