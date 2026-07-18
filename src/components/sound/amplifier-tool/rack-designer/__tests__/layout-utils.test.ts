import { describe, expect, it } from 'vitest';
import type { AmplifierResults } from '../../types';
import {
  AMPS_PER_RACK,
  assignBlockIps,
  assignSequentialIps,
  computeResultsFingerprint,
  generateLayoutFromResults,
  incrementIp,
  isValidIp,
} from '../layout-utils';

const emptySection = { amps: 0, details: [] as string[], totalAmps: 0 };

const makeResults = (
  perSection: AmplifierResults['perSection'],
): AmplifierResults => ({
  totalAmplifiersNeeded: 0,
  completeRaks: 0,
  looseAmplifiers: 0,
  plmRacks: 0,
  loosePLMAmps: 0,
  laAmpsTotal: 0,
  plmAmpsTotal: 0,
  perSection,
});

describe('isValidIp', () => {
  it('accepts valid IPv4 addresses', () => {
    expect(isValidIp('192.168.1.11')).toBe(true);
    expect(isValidIp('10.0.0.255')).toBe(true);
  });

  it('rejects malformed addresses', () => {
    expect(isValidIp('192.168.1')).toBe(false);
    expect(isValidIp('192.168.1.256')).toBe(false);
    expect(isValidIp('192.168.1.a')).toBe(false);
    expect(isValidIp('')).toBe(false);
  });
});

describe('incrementIp', () => {
  it('increments the last octet', () => {
    expect(incrementIp('192.168.1.11', 3)).toBe('192.168.1.14');
  });

  it('carries over octet boundaries', () => {
    expect(incrementIp('192.168.1.255', 1)).toBe('192.168.2.0');
  });

  it('returns the input unchanged when invalid', () => {
    expect(incrementIp('not-an-ip', 5)).toBe('not-an-ip');
  });
});

describe('assignSequentialIps / assignBlockIps', () => {
  it('numbers amps sequentially across blocks', () => {
    const results = makeResults({
      mains: { amps: 4, details: [], totalAmps: 4, mirrored: true, laAmps: 4, plmAmps: 0 },
      subs: { ...emptySection, amps: 2, totalAmps: 2, laAmps: 2, plmAmps: 0 },
    });
    const layout = generateLayoutFromResults(results);
    const blocks = assignSequentialIps(layout.blocks, '192.168.1.11');
    const ips = blocks.flatMap((block) => block.amps.map((amp) => amp.ip));
    expect(ips).toEqual(['192.168.1.11', '192.168.1.12', '192.168.1.13', '192.168.1.14', '192.168.1.15', '192.168.1.16']);
  });

  it('assigns block IPs starting at the given base', () => {
    const results = makeResults({
      subs: { ...emptySection, amps: 3, totalAmps: 3, laAmps: 3, plmAmps: 0 },
    });
    const layout = generateLayoutFromResults(results);
    const block = assignBlockIps(layout.blocks[0], '192.168.1.31');
    expect(block.amps.map((amp) => amp.ip)).toEqual(['192.168.1.31', '192.168.1.32', '192.168.1.33']);
  });
});

describe('generateLayoutFromResults', () => {
  it('splits mirrored sections into L and R preset names', () => {
    const results = makeResults({
      mains: { amps: 4, details: [], totalAmps: 4, mirrored: true, laAmps: 4, plmAmps: 0 },
    });
    const layout = generateLayoutFromResults(results);
    const names = layout.blocks.flatMap((block) => block.amps.map((amp) => amp.presetName));
    expect(names).toEqual(['MAIN L1', 'MAIN L2', 'MAIN R1', 'MAIN R2']);
  });

  it('gives the left side the extra amp on odd mirrored counts', () => {
    const results = makeResults({
      mains: { amps: 3, details: [], totalAmps: 3, mirrored: true, laAmps: 3, plmAmps: 0 },
    });
    const names = generateLayoutFromResults(results)
      .blocks.flatMap((block) => block.amps.map((amp) => amp.presetName));
    expect(names).toEqual(['MAIN L1', 'MAIN L2', 'MAIN R1']);
  });

  it('numbers non-mirrored sections without a side suffix', () => {
    const results = makeResults({
      subs: { ...emptySection, amps: 2, totalAmps: 2, laAmps: 2, plmAmps: 0 },
    });
    const names = generateLayoutFromResults(results)
      .blocks.flatMap((block) => block.amps.map((amp) => amp.presetName));
    expect(names).toEqual(['SUB 1', 'SUB 2']);
  });

  it('packs at most 3 amps per rack and never mixes amp models in one rack', () => {
    const results = makeResults({
      mains: { amps: 8, details: [], totalAmps: 8, mirrored: true, laAmps: 8, plmAmps: 0 },
      delays: { ...emptySection, amps: 2, totalAmps: 2, laAmps: 1, plmAmps: 1 },
    });
    const layout = generateLayoutFromResults(results);
    for (const block of layout.blocks) {
      expect(block.amps.length).toBeLessThanOrEqual(AMPS_PER_RACK);
      expect(new Set(block.amps.map((amp) => amp.model)).size).toBe(1);
    }
  });

  it('stamps and changes the results fingerprint when the calculation changes', () => {
    const resultsA = makeResults({
      mains: { amps: 4, details: [], totalAmps: 4, mirrored: true, laAmps: 4, plmAmps: 0 },
    });
    const resultsB = makeResults({
      mains: { amps: 6, details: [], totalAmps: 6, mirrored: true, laAmps: 6, plmAmps: 0 },
    });
    const layout = generateLayoutFromResults(resultsA);
    expect(layout.resultsFingerprint).toBe(computeResultsFingerprint(resultsA));
    expect(computeResultsFingerprint(resultsA)).not.toBe(computeResultsFingerprint(resultsB));
    expect(computeResultsFingerprint(resultsA)).toBe(computeResultsFingerprint(makeResults(resultsA.perSection)));
  });

  it('colors left racks red, right racks blue and center racks green', () => {
    const results = makeResults({
      mains: { amps: 2, details: [], totalAmps: 2, mirrored: true, laAmps: 2, plmAmps: 0 },
      subs: { ...emptySection, amps: 1, totalAmps: 1, laAmps: 1, plmAmps: 0 },
    });
    const layout = generateLayoutFromResults(results);
    const byName = (needle: string) =>
      layout.blocks.find((block) => block.amps.some((amp) => amp.presetName.includes(needle)));
    expect(byName('MAIN L')?.color).toBe('#f87171');
    expect(byName('MAIN R')?.color).toBe('#60a5fa');
    expect(byName('SUB')?.color).toBe('#4ade80');
  });

  it('balances mixed amp models across sides in mirrored sections', () => {
    const results = makeResults({
      mains: { amps: 2, details: [], totalAmps: 2, mirrored: true, laAmps: 1, plmAmps: 1 },
    });
    const layout = generateLayoutFromResults(results);
    const names = layout.blocks.flatMap((block) => block.amps.map((amp) => amp.presetName));
    expect(names).toEqual(['MAIN L1', 'MAIN R1']);
  });

  it('does not overlap default block positions', () => {
    const results = makeResults({
      mains: { amps: 8, details: [], totalAmps: 8, mirrored: true, laAmps: 8, plmAmps: 0 },
      subs: { ...emptySection, amps: 6, totalAmps: 6, laAmps: 6, plmAmps: 0 },
    });
    const layout = generateLayoutFromResults(results);
    const positions = layout.blocks.map((block) => `${block.x},${block.y}`);
    expect(new Set(positions).size).toBe(positions.length);
  });
});
