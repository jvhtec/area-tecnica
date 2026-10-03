import { campaignHarnessCore } from './campaignHarnessCore';

/** Historical by default; CI requires its separately validated manifest. */
export function localCampaignHarness(extraHandlers: string[] = []) {
  return campaignHarnessCore(extraHandlers, { mode: process.env.STAFFING_CI_MANIFEST !== undefined ? 'ci' : 'historical' });
}
