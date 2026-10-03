import { campaignHarnessCore } from './campaignHarnessCore';

/** Fixed historical target; fault fixtures use the separate disposable entry point. */
export function localCampaignHarness(extraHandlers: string[] = []) {
  return campaignHarnessCore(extraHandlers, { mode: 'historical' });
}
