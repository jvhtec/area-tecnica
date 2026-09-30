/** Query keys of the Flex pullsheet push. */
export const festivalFlexKeys = {
  resourceIds: (names: readonly string[]) => ["festival-flex", "resource-ids", names] as const,
  presets: (jobId: string | undefined) => ["festival-flex", "presets", jobId] as const,
  presetItems: (presetId: string | null) => ["festival-flex", "preset-items", presetId] as const,
  pullsheets: (jobId: string | undefined) => ["festival-flex", "pullsheets", jobId] as const,
};
