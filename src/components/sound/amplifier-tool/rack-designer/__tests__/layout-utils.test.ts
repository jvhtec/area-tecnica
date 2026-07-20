import { describe, expect, it } from 'vitest';
import type { AmplifierResults } from '../../types';
import type { RackDesignerBlock } from '../types';
import {
  AMPS_PER_RACK,
  assignBlockIps,
  assignSequentialIps,
  computeResultsFingerprint,
  createEmptyRackDesignerLayout,
  findMergeTarget,
  generateLayoutFromResults,
  incrementIp,
  isValidIp,
  joinAmpsIntoRack,
  mergeRackIntoRack,
} from '../layout-utils';

describe('createEmptyRackDesignerLayout', () => {
  it('creates a standalone canvas without a calculator fingerprint', () => {
    expect(createEmptyRackDesignerLayout()).toEqual({
      version: 1,
      title: 'SISTEMA PA',
      blocks: [],
    });
  });
});

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

describe('joinAmpsIntoRack', () => {
  const amp = (id: string) => ({ id, presetName: id.toUpperCase(), ip: '192.168.1.11', model: 'LA12X' as const });
  const singleAmpBlocks = (): RackDesignerBlock[] => [
    { id: 'b1', label: 'SUB L', color: '#f87171', x: 40, y: 40, amps: [amp('a1')] },
    { id: 'b2', label: 'SUB R', color: '#60a5fa', x: 240, y: 40, amps: [amp('a2')] },
    { id: 'b3', label: 'FRONT', color: '#4ade80', x: 440, y: 40, amps: [amp('a3')] },
  ];

  it('merges selected single-amp racks into one, removing the emptied sources', () => {
    const result = joinAmpsIntoRack(singleAmpBlocks(), ['a1', 'a2']);
    expect(result).toHaveLength(2); // joined rack + untouched b3
    const joined = result[0];
    expect(joined.amps.map((a) => a.id)).toEqual(['a1', 'a2']);
    // New rack inherits the anchor (first selected amp's) position + label.
    expect(joined.label).toBe('SUB L');
    expect({ x: joined.x, y: joined.y }).toEqual({ x: 40, y: 40 });
    expect(result.some((b) => b.id === 'b2')).toBe(false);
    expect(result.some((b) => b.id === 'b3')).toBe(true);
  });

  it('never exceeds the rack capacity and leaves the surplus amp in place', () => {
    const blocks = [
      ...singleAmpBlocks(),
      { id: 'b4', label: 'X', color: '#000', x: 640, y: 40, amps: [amp('a4')] },
    ];
    const result = joinAmpsIntoRack(blocks, ['a1', 'a2', 'a3', 'a4']);
    const joined = result.find((b) => b.amps.length > 1)!;
    expect(joined.amps).toHaveLength(AMPS_PER_RACK);
    expect(joined.amps.map((a) => a.id)).toEqual(['a1', 'a2', 'a3']);
    // The 4th amp is untouched in its own rack.
    expect(result.find((b) => b.id === 'b4')?.amps.map((a) => a.id)).toEqual(['a4']);
  });

  it('keeps and shifts leftover amps when a source rack is only partially joined', () => {
    const blocks: RackDesignerBlock[] = [
      { id: 'b1', label: 'MAIN L', color: '#f87171', x: 40, y: 40, amps: [amp('a1'), amp('a2')] },
      { id: 'b2', label: 'MAIN R', color: '#60a5fa', x: 240, y: 40, amps: [amp('a3')] },
    ];
    const result = joinAmpsIntoRack(blocks, ['a1', 'a3']);
    const joined = result[0];
    expect(joined.amps.map((a) => a.id)).toEqual(['a1', 'a3']);
    const leftover = result.find((b) => b.amps.some((a) => a.id === 'a2'))!;
    expect(leftover.amps.map((a) => a.id)).toEqual(['a2']);
    // Leftover is nudged aside so it doesn't sit under the new rack.
    expect(leftover.x).toBeGreaterThan(joined.x);
  });

  it('is a no-op for fewer than two resolved amps', () => {
    const blocks = singleAmpBlocks();
    expect(joinAmpsIntoRack(blocks, ['a1'])).toBe(blocks);
    expect(joinAmpsIntoRack(blocks, [])).toBe(blocks);
    expect(joinAmpsIntoRack(blocks, ['nope', 'nada'])).toBe(blocks);
  });

  it('preserves amp identity (id, preset, ip)', () => {
    const blocks: RackDesignerBlock[] = [
      { id: 'b1', label: 'A', color: '#f87171', x: 0, y: 0, amps: [{ id: 'a1', presetName: 'K1', ip: '192.168.1.31', model: 'LA12X' }] },
      { id: 'b2', label: 'B', color: '#60a5fa', x: 200, y: 0, amps: [{ id: 'a2', presetName: 'K2 90', ip: '192.168.1.34', model: 'LA12X' }] },
    ];
    const joined = joinAmpsIntoRack(blocks, ['a1', 'a2'])[0];
    expect(joined.amps).toEqual([
      { id: 'a1', presetName: 'K1', ip: '192.168.1.31', model: 'LA12X' },
      { id: 'a2', presetName: 'K2 90', ip: '192.168.1.34', model: 'LA12X' },
    ]);
  });
});

describe('mergeRackIntoRack', () => {
  const amp = (id: string) => ({ id, presetName: id.toUpperCase(), ip: '192.168.1.11', model: 'LA12X' as const });

  it('pours the source amp into the target and drops the emptied source', () => {
    const blocks: RackDesignerBlock[] = [
      { id: 'src', label: 'SUELTO', color: '#f87171', x: 400, y: 200, amps: [amp('a1')] },
      { id: 'dst', label: 'RACK L', color: '#60a5fa', x: 40, y: 40, amps: [amp('a2')] },
    ];
    const result = mergeRackIntoRack(blocks, 'src', 'dst');
    expect(result).toHaveLength(1);
    const target = result[0];
    // Target keeps its identity and gains the source's amp.
    expect(target.id).toBe('dst');
    expect(target.label).toBe('RACK L');
    expect({ x: target.x, y: target.y }).toEqual({ x: 40, y: 40 });
    expect(target.amps.map((a) => a.id)).toEqual(['a2', 'a1']);
  });

  it('moves only what fits and leaves the surplus in the source rack', () => {
    const blocks: RackDesignerBlock[] = [
      { id: 'src', label: 'SUELTOS', color: '#f87171', x: 400, y: 40, amps: [amp('a1'), amp('a2')] },
      { id: 'dst', label: 'RACK', color: '#60a5fa', x: 40, y: 40, amps: [amp('a3'), amp('a4')] },
    ];
    const result = mergeRackIntoRack(blocks, 'src', 'dst');
    const target = result.find((b) => b.id === 'dst')!;
    expect(target.amps).toHaveLength(AMPS_PER_RACK);
    expect(target.amps.map((a) => a.id)).toEqual(['a3', 'a4', 'a1']);
    // The amp that didn't fit stays in the source rack, kept in place.
    const source = result.find((b) => b.id === 'src')!;
    expect(source.amps.map((a) => a.id)).toEqual(['a2']);
    expect({ x: source.x, y: source.y }).toEqual({ x: 400, y: 40 });
  });

  it('is a no-op for a full target, a self-merge or a missing block', () => {
    const blocks: RackDesignerBlock[] = [
      { id: 'src', label: 'S', color: '#f87171', x: 400, y: 40, amps: [amp('a1')] },
      { id: 'full', label: 'F', color: '#60a5fa', x: 40, y: 40, amps: [amp('b1'), amp('b2'), amp('b3')] },
    ];
    expect(mergeRackIntoRack(blocks, 'src', 'full')).toBe(blocks);
    expect(mergeRackIntoRack(blocks, 'src', 'src')).toBe(blocks);
    expect(mergeRackIntoRack(blocks, 'src', 'ghost')).toBe(blocks);
  });

  it('preserves amp identity when merging', () => {
    const blocks: RackDesignerBlock[] = [
      { id: 'src', label: 'S', color: '#f87171', x: 400, y: 40, amps: [{ id: 'a1', presetName: 'K2 55', ip: '192.168.1.40', model: 'LA12X' }] },
      { id: 'dst', label: 'D', color: '#60a5fa', x: 40, y: 40, amps: [] },
    ];
    const target = mergeRackIntoRack(blocks, 'src', 'dst').find((b) => b.id === 'dst')!;
    expect(target.amps).toEqual([{ id: 'a1', presetName: 'K2 55', ip: '192.168.1.40', model: 'LA12X' }]);
  });
});

describe('findMergeTarget', () => {
  const amp = (id: string) => ({ id, presetName: id.toUpperCase(), ip: '192.168.1.11', model: 'LA12X' as const });

  it('returns the rack whose bounds contain the dragged rack header centre', () => {
    const blocks: RackDesignerBlock[] = [
      { id: 'src', label: 'S', color: '#f87171', x: 100, y: 100, amps: [amp('a1')] },
      { id: 'dst', label: 'D', color: '#60a5fa', x: 150, y: 90, amps: [amp('a2')] },
    ];
    // src header centre is (100+90, 100+14) = (190, 114), inside dst (150..330, 90..166).
    expect(findMergeTarget(blocks, 'src')).toBe('dst');
  });

  it('ignores full racks and returns null when the target has no room', () => {
    const blocks: RackDesignerBlock[] = [
      { id: 'src', label: 'S', color: '#f87171', x: 100, y: 100, amps: [amp('a1')] },
      { id: 'dst', label: 'D', color: '#60a5fa', x: 150, y: 90, amps: [amp('a2'), amp('a3'), amp('a4')] },
    ];
    expect(findMergeTarget(blocks, 'src')).toBeNull();
  });

  it('returns null when the dragged rack overlaps nothing', () => {
    const blocks: RackDesignerBlock[] = [
      { id: 'src', label: 'S', color: '#f87171', x: 100, y: 100, amps: [amp('a1')] },
      { id: 'dst', label: 'D', color: '#60a5fa', x: 800, y: 600, amps: [amp('a2')] },
    ];
    expect(findMergeTarget(blocks, 'src')).toBeNull();
  });

  it('picks the nearest rack when several overlap the header centre', () => {
    const blocks: RackDesignerBlock[] = [
      { id: 'src', label: 'S', color: '#f87171', x: 100, y: 100, amps: [amp('a1')] },
      // Both contain the probe (190,114); far's centre is further from it.
      { id: 'near', label: 'N', color: '#60a5fa', x: 120, y: 100, amps: [amp('a2')] },
      { id: 'far', label: 'F', color: '#4ade80', x: 40, y: 60, amps: [amp('a3')] },
    ];
    expect(findMergeTarget(blocks, 'src')).toBe('near');
  });
});
