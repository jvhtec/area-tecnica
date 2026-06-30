import { describe, expect, it } from 'vitest';
import {
  buildCampaignPolicy,
  buildRoleProfiles,
  inferJobProfile,
  inferRoleProfile,
  recommendedWaveNumber,
} from '../crewingProfiles';

describe('crewing profile inference', () => {
  it('maps stored job types to operational default profiles', () => {
    expect(inferJobProfile({ jobType: 'single' })).toBe('standard');
    expect(inferJobProfile({ jobType: 'evento' })).toBe('standard');
    expect(inferJobProfile({ jobType: 'festival' })).toBe('high_risk_critical');
    expect(inferJobProfile({ jobType: 'ciclo' })).toBe('multi_day_tour');
    expect(inferJobProfile({ jobType: 'tourdate' })).toBe('multi_day_tour');
  });

  it('escalates near-start unfilled roles to emergency fill', () => {
    const now = new Date('2026-05-20T08:00:00Z');
    const startTime = '2026-05-20T12:00:00Z';

    expect(inferJobProfile({ jobType: 'single', startTime, now })).toBe('emergency_fill');
    expect(
      inferRoleProfile({
        jobProfile: 'standard',
        roleCode: 'SND-FOH-R',
        requiredCount: 2,
        assignedCount: 1,
        startsWithinHours: 18,
      }),
    ).toBe('emergency_fill');
  });

  it('lets role criticality override a broad job profile', () => {
    expect(
      inferRoleProfile({
        jobProfile: 'standard',
        roleCode: 'SND-PA-T',
        requiredCount: 1,
        assignedCount: 0,
      }),
    ).toBe('high_risk_critical');

    expect(
      inferRoleProfile({
        jobProfile: 'standard',
        roleCode: 'Runner',
        requiredCount: 1,
        assignedCount: 0,
      }),
    ).toBe('training_friendly');
  });

  it('builds a backward-compatible campaign policy with profile, wave, and cost metadata', () => {
    const roleProfiles = buildRoleProfiles({
      roleCodes: ['SND-PA-T', 'Runner'],
      requiredByRole: { 'SND-PA-T': 2, Runner: 1 },
      selectedJobProfile: 'high_risk_critical',
    });

    const policy = buildCampaignPolicy({
      mode: 'assisted',
      jobType: 'festival',
      selectedJobProfile: 'high_risk_critical',
      inferProfileFromJobType: true,
      roleProfiles,
      roleProfileOverrides: { Runner: 'training_friendly' },
      availabilityTtlHours: 24,
      offerTtlHours: 2,
      softConflictPolicy: 'block',
      excludeFridge: true,
      sendChannel: 'whatsapp',
      costScoring: {
        enabled: true,
        penaltyStrength: 'normal',
        maxRatePenalty: 10,
      },
      waves: {
        mode: 'controlled_waves',
        buffer: 1,
        waitMinutes: 15,
        maxWaves: 3,
        autoSendNextWave: false,
      },
      tickIntervalSeconds: 300,
    });

    expect(policy.profile.selected_job_profile).toBe('high_risk_critical');
    expect(policy.role_profiles.Runner.selected_profile).toBe('training_friendly');
    expect(policy.weights.skills).toBe(0.4);
    expect(policy.weights.cost_efficiency).toBe(0.03);
    expect(policy.cost_scoring.enabled).toBe(true);
    expect(policy.surrounding_jobs).toEqual({
      enabled: true,
      max_location_distance_km: 25,
    });
    expect(policy.waves).toMatchObject({
      mode: 'controlled_waves',
      buffer: 1,
      wait_minutes: 15,
      max_waves: 3,
    });
    expect(policy.channel).toBe('whatsapp');
  });

  it('passes surrounding-job policy overrides into campaign policy', () => {
    const policy = buildCampaignPolicy({
      mode: 'assisted',
      selectedJobProfile: 'standard',
      inferProfileFromJobType: false,
      roleProfiles: {},
      availabilityTtlHours: 24,
      offerTtlHours: 2,
      softConflictPolicy: 'warn',
      excludeFridge: false,
      sendChannel: 'email',
      costScoring: {
        enabled: false,
        penaltyStrength: 'disabled',
        maxRatePenalty: 0,
      },
      waves: {
        mode: 'manual_selection',
        buffer: 0,
        waitMinutes: 15,
        maxWaves: 1,
        autoSendNextWave: false,
      },
      tickIntervalSeconds: 300,
      surroundingJobs: {
        enabled: false,
        maxLocationDistanceKm: 12,
      },
    });

    expect(policy.surrounding_jobs).toEqual({
      enabled: false,
      max_location_distance_km: 12,
    });
  });

  it('groups ranked candidates into recommended waves from required count plus buffer', () => {
    expect(recommendedWaveNumber(0, 2, 1)).toBe(1);
    expect(recommendedWaveNumber(2, 2, 1)).toBe(1);
    expect(recommendedWaveNumber(3, 2, 1)).toBe(2);
  });
});
