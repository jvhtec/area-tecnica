import { describe, expect, it } from 'vitest';

import {
  DEPARTMENT_PACKAGE_LABELS,
  DEPARTMENT_PACKAGE_PREFIX,
  TOUR_PACKAGE_LABELS,
  getDepartmentDefaultSetId,
  getDepartmentPackageSize,
  getPackageBadgeLabel,
  resolveDefaultSetForTourDate,
  type TourDefaultSetLike,
} from '@/utils/tourPackages';

const makeSet = (
  overrides: Partial<TourDefaultSetLike> & Pick<TourDefaultSetLike, 'id' | 'department'>
): TourDefaultSetLike => ({
  tour_id: 'tour-1',
  name: overrides.id,
  package_size: null,
  ...overrides,
});

describe('tourPackages', () => {
  it('maps package labels and department labels/prefixes', () => {
    expect(TOUR_PACKAGE_LABELS).toMatchObject({
      xl: 'XL',
      l: 'L',
      m: 'M',
      s: 'S',
    });

    expect(DEPARTMENT_PACKAGE_LABELS.sound).toBe('Sound');
    expect(DEPARTMENT_PACKAGE_LABELS.lights).toBe('Lights');
    expect(DEPARTMENT_PACKAGE_LABELS.video).toBe('Video');
    expect(DEPARTMENT_PACKAGE_PREFIX.sound).toBe('SX');
    expect(DEPARTMENT_PACKAGE_PREFIX.lights).toBe('LX');
    expect(DEPARTMENT_PACKAGE_PREFIX.video).toBe('VX');
  });

  it('builds desktop and mobile badge labels', () => {
    expect(getPackageBadgeLabel({ department: 'sound', packageSize: 'xl' })).toBe('Sound XL');
    expect(getPackageBadgeLabel({ department: 'lights', packageSize: 'm' })).toBe('Lights M');
    expect(getPackageBadgeLabel({ department: 'video', packageSize: 's' })).toBe('Video S');
    expect(getPackageBadgeLabel({ department: 'sound', packageSize: 'xl', mobile: true })).toBe('SX XL');
    expect(getPackageBadgeLabel({ department: 'lights', packageSize: 'm', mobile: true })).toBe('LX M');
    expect(getPackageBadgeLabel({ department: 'video', packageSize: 's', mobile: true })).toBe('VX S');
  });

  it('reads package sizes and default set ids by department with legacy S fallback', () => {
    const tourDate = {
      sound_package_size: 'xl',
      lights_package_size: 'm',
      video_default_set_id: 'video-set',
      is_tour_pack_only: true,
    };

    expect(getDepartmentPackageSize(tourDate, 'sound')).toBe('xl');
    expect(getDepartmentPackageSize(tourDate, 'lights')).toBe('m');
    expect(getDepartmentPackageSize(tourDate, 'video')).toBe('s');
    expect(getDepartmentDefaultSetId(tourDate, 'video')).toBe('video-set');
    expect(getDepartmentPackageSize({ is_tour_pack_only: false }, 'sound')).toBeNull();
  });

  it('resolves an explicit valid set before package matching', () => {
    const sets = [
      makeSet({ id: 'sound-s', department: 'sound', package_size: 's' }),
      makeSet({ id: 'sound-custom', department: 'sound', package_size: null }),
    ];

    const result = resolveDefaultSetForTourDate({
      tourDate: {
        tour_id: 'tour-1',
        sound_package_size: 's',
        sound_default_set_id: 'sound-custom',
      },
      department: 'sound',
      defaultSets: sets,
    });

    expect(result.status).toBe('resolved');
    if (result.status === 'resolved') {
      expect(result.source).toBe('explicit');
      expect(result.set.id).toBe('sound-custom');
    }
  });

  it('rejects explicit pins with mismatched package size', () => {
    const result = resolveDefaultSetForTourDate({
      tourDate: {
        tour_id: 'tour-1',
        sound_package_size: 's',
        sound_default_set_id: 'sound-xl',
      },
      department: 'sound',
      defaultSets: [makeSet({ id: 'sound-xl', department: 'sound', package_size: 'xl' })],
    });

    expect(result.status).toBe('invalid_explicit');
    if (result.status === 'invalid_explicit') {
      expect(result.reason).toBe('package_mismatch');
    }
  });

  it('resolves a unique package match', () => {
    const result = resolveDefaultSetForTourDate({
      tourDate: { tour_id: 'tour-1', lights_package_size: 'm' },
      department: 'lights',
      defaultSets: [
        makeSet({ id: 'lights-m', department: 'lights', package_size: 'm' }),
        makeSet({ id: 'lights-s', department: 'lights', package_size: 's' }),
      ],
    });

    expect(result.status).toBe('resolved');
    if (result.status === 'resolved') {
      expect(result.source).toBe('package_size');
      expect(result.set.id).toBe('lights-m');
    }
  });

  it('resolves legacy tour-pack dates as S', () => {
    const result = resolveDefaultSetForTourDate({
      tourDate: { tour_id: 'tour-1', is_tour_pack_only: true },
      department: 'video',
      defaultSets: [makeSet({ id: 'video-s', department: 'video', package_size: 's' })],
    });

    expect(result.status).toBe('resolved');
    if (result.status === 'resolved') {
      expect(result.source).toBe('legacy_tour_pack');
      expect(result.packageSize).toBe('s');
    }
  });

  it('uses single-set fallback for old tours without package intent', () => {
    const result = resolveDefaultSetForTourDate({
      tourDate: { tour_id: 'tour-1' },
      department: 'sound',
      defaultSets: [makeSet({ id: 'only-sound-set', department: 'sound' })],
    });

    expect(result.status).toBe('resolved');
    if (result.status === 'resolved') {
      expect(result.source).toBe('single_set_fallback');
    }
  });

  it('returns missing or ambiguous instead of merging defaults', () => {
    expect(
      resolveDefaultSetForTourDate({
        tourDate: { tour_id: 'tour-1', sound_package_size: 'xl' },
        department: 'sound',
        defaultSets: [],
      }).status
    ).toBe('missing');

    const ambiguous = resolveDefaultSetForTourDate({
      tourDate: { tour_id: 'tour-1', sound_package_size: 's' },
      department: 'sound',
      defaultSets: [
        makeSet({ id: 'sound-s-a', department: 'sound', package_size: 's' }),
        makeSet({ id: 'sound-s-b', department: 'sound', package_size: 's' }),
      ],
    });

    expect(ambiguous.status).toBe('ambiguous');
    if (ambiguous.status === 'ambiguous') {
      expect(ambiguous.matches).toHaveLength(2);
    }
  });

  it('rejects wrong explicit department and tour pins', () => {
    const wrongDepartment = resolveDefaultSetForTourDate({
      tourDate: { tour_id: 'tour-1', sound_default_set_id: 'lights-s' },
      department: 'sound',
      defaultSets: [makeSet({ id: 'lights-s', department: 'lights', package_size: 's' })],
    });
    expect(wrongDepartment.status).toBe('invalid_explicit');
    if (wrongDepartment.status === 'invalid_explicit') {
      expect(wrongDepartment.reason).toBe('wrong_department');
    }

    const wrongTour = resolveDefaultSetForTourDate({
      tourDate: { tour_id: 'tour-1', sound_default_set_id: 'sound-other-tour' },
      department: 'sound',
      defaultSets: [
        makeSet({
          id: 'sound-other-tour',
          department: 'sound',
          tour_id: 'tour-2',
          package_size: 's',
        }),
      ],
    });
    expect(wrongTour.status).toBe('invalid_explicit');
    if (wrongTour.status === 'invalid_explicit') {
      expect(wrongTour.reason).toBe('wrong_tour');
    }
  });
});
