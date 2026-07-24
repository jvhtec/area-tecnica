import { describe, expect, it } from 'vitest';
import { normalizeStoredCampaignPolicy } from '../storedCampaignPolicy';

describe('normalizeStoredCampaignPolicy', () => {
  it('preserves canonical snake_case rate penalty settings', () => {
    const policy = normalizeStoredCampaignPolicy({
      cost_scoring: {
        enabled: true,
        penalty_strength: 'high',
        max_rate_penalty: 20,
      },
    })

    expect(policy.cost_scoring).toEqual({
      enabled: true,
      penalty_strength: 'high',
      max_rate_penalty: 20,
    })
  })

  it('normalizes camelCase policies written by older clients', () => {
    const policy = normalizeStoredCampaignPolicy({
      cost_scoring: {
        enabled: false,
        penaltyStrength: 'low',
        maxRatePenalty: 5,
      },
    })

    expect(policy.cost_scoring).toEqual({
      enabled: false,
      penalty_strength: 'low',
      max_rate_penalty: 5,
    })
  })
})
