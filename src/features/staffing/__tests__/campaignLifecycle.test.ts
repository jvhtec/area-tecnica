import { describe, expect, it } from 'vitest'

import {
  canResumeStaffingCampaign,
  staffingCampaignResumeLabel,
  staffingCampaignResumeToastTitle,
} from '../campaignLifecycle'

describe('staffing campaign lifecycle helpers', () => {
  it('treats completed campaigns as restartable', () => {
    expect(canResumeStaffingCampaign('paused')).toBe(true)
    expect(canResumeStaffingCampaign('stopped')).toBe(true)
    expect(canResumeStaffingCampaign('completed')).toBe(true)

    expect(canResumeStaffingCampaign('active')).toBe(false)
    expect(canResumeStaffingCampaign('failed')).toBe(false)
  })

  it('labels paused campaigns as resume and terminal campaigns as restart', () => {
    expect(staffingCampaignResumeLabel('paused')).toBe('Reanudar')
    expect(staffingCampaignResumeLabel('stopped')).toBe('Reiniciar')
    expect(staffingCampaignResumeLabel('completed')).toBe('Reiniciar')

    expect(staffingCampaignResumeToastTitle('Carlos', 'paused')).toBe('Carlos reanudado')
    expect(staffingCampaignResumeToastTitle('Carlos', 'completed')).toBe('Carlos reiniciado')
  })
})
