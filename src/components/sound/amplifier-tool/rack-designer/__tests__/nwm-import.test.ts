import { describe, expect, it } from 'vitest';
import { nwmMapToLayout, type NwmMap } from '../nwm-import';

// Mirrors the real NM structure: overlapping logical groups (a unit can appear
// in several), top-level sections (MAINS/SUBS…), and LEFT/RIGHT side groups.
const sampleMap: NwmMap = {
  sessionName: 'OT_PSJ',
  units: [
    { octet: 11, ip: '192.168.1.11', presetName: 'K1', familyName: 'K1', model: 'LA12X', x: 67, y: 13 },
    { octet: 13, ip: '192.168.1.13', presetName: 'K1', familyName: 'K1', model: 'LA12X', x: 67, y: 17 },
    { octet: 12, ip: '192.168.1.12', presetName: 'K1', familyName: 'K1', model: 'LA12X', x: 67, y: 15 },
    { octet: 21, ip: '192.168.1.21', presetName: 'K1', familyName: 'K1', model: 'LA12X', x: 75, y: 13 },
    { octet: 22, ip: '192.168.1.22', presetName: 'K1', familyName: 'K1', model: 'LA12X', x: 75, y: 15 },
    { octet: 31, ip: '192.168.1.31', presetName: 'KS28_60_Cx', familyName: 'KS28', model: 'LA12X', x: 67, y: 36 },
    { octet: 34, ip: '192.168.1.34', presetName: 'KS28_60_Cx', familyName: 'KS28', model: 'LA12X', x: 75, y: 36 },
    { octet: 90, ip: '192.168.1.90', presetName: 'X15', familyName: 'X15', model: 'LA12X', x: 6, y: 24 },
  ],
  groups: [
    { name: 'ALL', role: 'parent', members: [11, 13, 12, 21, 22, 31, 34, 90] },
    { name: 'MAINS', role: 'parent', members: [11, 13, 12, 21, 22] },
    { name: 'SUBS', role: 'parent', members: [31, 34] },
    { name: 'MAIN L', role: 'source', members: [11, 13, 12] },
    { name: 'MAIN R', role: 'source', members: [21, 22] },
    { name: 'LEFT', role: '', members: [11, 12, 13, 31] },
    { name: 'RIGHT', role: '', members: [21, 22, 34] },
  ],
};

describe('nwmMapToLayout', () => {
  it('uses the session name as the layout title', () => {
    expect(nwmMapToLayout(sampleMap).title).toBe('OT_PSJ');
  });

  it('creates one block per section+side, ordered MAIN then SUB, L before R, OTROS last', () => {
    const labels = nwmMapToLayout(sampleMap).blocks.map((b) => b.label);
    expect(labels).toEqual(['MAIN L', 'MAIN R', 'SUB L', 'SUB R', 'OTROS']);
  });

  it('places each amp in exactly one cell (no duplication across groups)', () => {
    const layout = nwmMapToLayout(sampleMap);
    const ips = layout.blocks.flatMap((b) => b.amps.map((a) => a.ip));
    expect(ips).toHaveLength(8); // every unit once
    expect(new Set(ips).size).toBe(8);
  });

  it('IP-sorts amps within a block and carries preset + full IP', () => {
    const mainL = nwmMapToLayout(sampleMap).blocks.find((b) => b.label === 'MAIN L')!;
    expect(mainL.amps.map((a) => a.ip)).toEqual(['192.168.1.11', '192.168.1.12', '192.168.1.13']);
    expect(mainL.amps.map((a) => a.presetName)).toEqual(['K1', 'K1', 'K1']);
  });

  it('colors L red, R blue', () => {
    const layout = nwmMapToLayout(sampleMap);
    expect(layout.blocks.find((b) => b.label === 'MAIN L')!.color).toBe('#f87171');
    expect(layout.blocks.find((b) => b.label === 'MAIN R')!.color).toBe('#60a5fa');
  });

  it('buckets units with no known section into an OTROS block', () => {
    const otros = nwmMapToLayout(sampleMap).blocks.find((b) => b.label === 'OTROS');
    expect(otros).toBeDefined();
    expect(otros!.amps.map((a) => a.ip)).toEqual(['192.168.1.90']);
  });

  it('packs a section+side into physical-rack-sized blocks of 3, numbered', () => {
    const sevenMainL: NwmMap = {
      sessionName: 'BIG',
      units: Array.from({ length: 7 }, (_, i) => ({
        octet: 11 + i,
        ip: `192.168.1.${11 + i}`,
        presetName: 'K1',
        familyName: 'K1',
        model: 'LA12X',
        x: 0,
        y: 0,
      })),
      groups: [
        { name: 'MAINS', role: 'parent', members: [11, 12, 13, 14, 15, 16, 17] },
        { name: 'LEFT', role: '', members: [11, 12, 13, 14, 15, 16, 17] },
      ],
    };
    const blocks = nwmMapToLayout(sevenMainL).blocks;
    expect(blocks.map((b) => b.label)).toEqual(['MAIN L 1', 'MAIN L 2', 'MAIN L 3']);
    expect(blocks.map((b) => b.amps.length)).toEqual([3, 3, 1]);
    // Every amp present exactly once, in IP order across the racks.
    expect(blocks.flatMap((b) => b.amps.map((a) => a.ip))).toEqual(
      Array.from({ length: 7 }, (_, i) => `192.168.1.${11 + i}`),
    );
  });

  it('does not overlap block positions', () => {
    const positions = nwmMapToLayout(sampleMap).blocks.map((b) => `${b.x},${b.y}`);
    expect(new Set(positions).size).toBe(positions.length);
  });

  it('falls back to a default title when the session is unnamed', () => {
    expect(nwmMapToLayout({ ...sampleMap, sessionName: '' }).title).toBe('SISTEMA PA');
  });
});

// Soundvision .xmlp has no LEFT/RIGHT groups; sides live in the role="source"
// group names, and an amp can appear in several source groups (first wins).
const xmlpMap: NwmMap = {
  sessionName: 'PA',
  units: [
    { octet: 11, ip: '192.168.1.11', presetName: 'K2 110', familyName: 'K2', model: 'LA12X', x: 0, y: 0 },
    { octet: 12, ip: '192.168.1.12', presetName: 'K2 110', familyName: 'K2', model: 'LA12X', x: 0, y: 0 },
    { octet: 21, ip: '192.168.1.21', presetName: 'K2 110', familyName: 'K2', model: 'LA12X', x: 0, y: 0 },
    { octet: 31, ip: '192.168.1.31', presetName: 'KS28_60_C', familyName: 'KS28', model: 'LA12X', x: 0, y: 0 },
    { octet: 41, ip: '192.168.1.41', presetName: 'KARA', familyName: 'KARA', model: 'LA12X', x: 0, y: 0 },
    { octet: 99, ip: '192.168.1.99', presetName: 'SPARE', familyName: '', model: 'LA12X', x: 0, y: 0 },
  ],
  groups: [
    { name: 'Main', role: 'parent', members: [11, 12, 21] },
    { name: 'K2 L', role: 'source', members: [11, 12] },
    { name: 'K2 R', role: 'source', members: [21] },
    { name: 'KS28 Out L', role: 'source', members: [31] },
    { name: 'KARA 1', role: 'source', members: [41] },
    { name: 'KARA 2', role: 'source', members: [41] }, // overlaps 41 — first wins
    { name: '#1…3 K2 L', role: 'zoning', members: [11, 21] },
  ],
};

describe('nwmMapToLayout — Soundvision (.xmlp) source-group convention', () => {
  it('buckets by source-group name in document order', () => {
    const labels = nwmMapToLayout(xmlpMap).blocks.map((b) => b.label);
    expect(labels).toEqual(['K2 L', 'K2 R', 'KS28 Out L', 'KARA 1', 'OTROS']);
  });

  it('reads side (and color) from the source-group name suffix', () => {
    const blocks = nwmMapToLayout(xmlpMap).blocks;
    expect(blocks.find((b) => b.label === 'K2 L')!.color).toBe('#f87171'); // L → red
    expect(blocks.find((b) => b.label === 'K2 R')!.color).toBe('#60a5fa'); // R → blue
    expect(blocks.find((b) => b.label === 'KARA 1')!.color).toBe('#4ade80'); // no side → green
  });

  it('assigns an amp shared across source groups to the first only (no duplication)', () => {
    const ips = nwmMapToLayout(xmlpMap).blocks.flatMap((b) => b.amps.map((a) => a.ip));
    expect(ips.filter((ip) => ip === '192.168.1.41')).toHaveLength(1);
    expect(new Set(ips).size).toBe(ips.length);
  });

  it('routes an amp in no source group to OTROS', () => {
    const otros = nwmMapToLayout(xmlpMap).blocks.find((b) => b.label === 'OTROS');
    expect(otros!.amps.map((a) => a.ip)).toEqual(['192.168.1.99']);
  });
});
