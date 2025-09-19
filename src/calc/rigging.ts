// src/calc/rigging.ts
// Euler–Bernoulli FEM with prescribed support settlements (tilt). SI units.

export type Fixture = {
  x: number;        // meters from left end
  weightKg: number;
  qty: number;
  name?: string;
};

export type TrussModel = {
  id: string;
  name: string;
  lengthM: number;            // span (m)
  selfWeightKgPerM: number;   // kg/m from datasheet
  EI: number;                 // N·m² (E*I) from datasheet
  allowableM_Nm?: number;     // optional
  allowableDeflectionM?: number; // e.g., L/200
};

export type Support = {
  x: number;        // position (m)
  label?: string;   // H1, H2, ...
};

export type HoistType = {
  id: string;
  name: string;     // e.g., "CM 500 kg D8+"
  WLL_kg: number;   // working load limit (kg)
  selfWeightKg?: number;
};

export type LoadCase = {
  fixtures: Fixture[];
  includeMotorWeightOnTruss?: boolean;
  motorWeightKgEach?: number;
  g?: number;              // default 9.81 m/s²
  dynamicFactor?: number;  // default 1.2 (motorized lifts)
};

export type SolveOptions = {
  supports: Support[];
  nElements?: number;  // default 24
  tiltDeg?: number;    // + raises right
};

export type SolveResult = {
  supportReactionsN: number[];
  supportReactionsKg: number[];
  supportLabels: string[];
  maxMomentNm: number;
  maxDeflectionM: number;
  deflectionsM: number[]; // node deflections
  xNodesM: number[];
  okAgainstAllowables: {
    moment?: boolean;
    deflection?: boolean;
  };
};

export function solveTrussWithTilt(
  truss: TrussModel,
  loadCase: LoadCase,
  opts: SolveOptions
): SolveResult {
  const g = loadCase.g ?? 9.81;
  const γ = loadCase.dynamicFactor ?? 1.2;
  const nEl = Math.max(8, opts.nElements ?? 24);
  const L = truss.lengthM;
  const EI = truss.EI;
  if (EI <= 0) throw new Error("Truss EI must be > 0 (from datasheet).");

  // Mesh
  const nNodes = nEl + 1;
  const x: number[] = Array.from({ length: nNodes }, (_, i) => (L * i) / nEl);
  const ndof = 2 * nNodes; // [w, θ] per node
  const K = mzeros(ndof, ndof);
  const F = vzeros(ndof);

  // UDL from truss self-weight (+ optional smeared motors)
  const smearMotors =
    (loadCase.includeMotorWeightOnTruss && loadCase.motorWeightKgEach && opts.supports?.length)
      ? (loadCase.motorWeightKgEach * opts.supports.length * g) / L
      : 0;

  // Assemble
  for (let e = 0; e < nEl; e++) {
    const x1 = x[e], x2 = x[e + 1], Le = x2 - x1;
    const k = kBeam(EI, Le);
    const q = truss.selfWeightKgPerM * g + smearMotors; // N/m
    const fe = feUDL(q, Le);
    const i0 = 2 * e, i1 = i0 + 2;
    scatter(K, k, i0, i1);
    addLoad(F, fe, i0, i1);
  }

  // Point loads (fixtures at nearest node; refine later if desired)
  for (const fx of loadCase.fixtures) {
    const P = fx.qty * fx.weightKg * g * γ;
    const n = nearestNode(x, fx.x);
    F[2 * n] -= P;
  }

  // Supports: prescribe vertical displacements to enforce tilt
  const supportNodes = opts.supports.map(s => nearestNode(x, s.x));
  const labels = opts.supports.map((s, i) => s.label ?? `H${i + 1}`);
  const theta = (opts.tiltDeg ?? 0) * Math.PI / 180;
  const x0 = x[supportNodes[0]];
  const wPres = (xi: number) => Math.tan(theta) * (xi - x0);

  const constrained: number[] = [];
  const prescribed: number[] = [];
  for (const n of supportNodes) {
    constrained.push(2 * n); // vertical DOF
    prescribed.push(wPres(x[n]));
  }

  const allIdx = Array.from({ length: ndof }, (_, i) => i);
  const cset = new Set(constrained);
  const free = allIdx.filter(i => !cset.has(i));

  const Kff = select(K, free, free);
  const Kfc = select(K, free, constrained);
  const Kcf = select(K, constrained, free);
  const Kcc = select(K, constrained, constrained);
  const Ff = pick(F, free);
  const Fc = pick(F, constrained);

  const rhs = sub(Ff, mv(Kfc, prescribed));
  const df = cholSolveSPD(Kff, rhs);
  const Rc = sub(addv(mv(Kcf, df), mv(Kcc, prescribed)), Fc);

  // rebuild displacement vector (only needed for reporting)
  const d = vzeros(ndof);
  free.forEach((idx, i) => (d[idx] = df[i]));
  constrained.forEach((idx, i) => (d[idx] = prescribed[i]));

  // Post-process (rough but safe sampling)
  let maxW = 0, maxM = 0;
  const deflectionsM: number[] = [];
  for (let e = 0; e < nEl; e++) {
    const Le = x[e + 1] - x[e];
    const i0 = 2 * e, i1 = i0 + 2;
    const de = [d[i0], d[i0 + 1], d[i1], d[i1 + 1]];
    deflectionsM.push(d[i0]);
    const q = truss.selfWeightKgPerM * g + smearMotors;
    const { wMid, Mabs } = sampleMid(EI, Le, de, q);
    maxW = Math.max(maxW, Math.abs(d[i0]), Math.abs(wMid));
    maxM = Math.max(maxM, Mabs);
    if (e === nEl - 1) deflectionsM.push(d[i1]);
  }

  const supportReactionsN = Rc.slice(); // already vertical reactions
  const supportReactionsKg = supportReactionsN.map(R => R / g);

  return {
    supportReactionsN,
    supportReactionsKg,
    supportLabels: labels,
    maxMomentNm: maxM,
    maxDeflectionM: maxW,
    deflectionsM,
    xNodesM: x,
    okAgainstAllowables: {
      moment: truss.allowableM_Nm === undefined ? undefined : maxM <= truss.allowableM_Nm,
      deflection: truss.allowableDeflectionM === undefined ? undefined : maxW <= truss.allowableDeflectionM
    }
  };
}

export function suggestHoists(
  reactionsKg: number[],
  catalog: HoistType[]
): { support: string; requiredKg: number; hoist: HoistType }[] {
  const sorted = [...catalog].sort((a, b) => a.WLL_kg - b.WLL_kg);
  return reactionsKg.map((Rkg, i) => {
    const pickHoist = sorted.find(h => h.WLL_kg >= Rkg) ?? sorted[sorted.length - 1];
    return { support: `H${i + 1}`, requiredKg: Math.ceil(Rkg), hoist: pickHoist };
  });
}

/* ------- FE helpers ------- */
function mzeros(n: number, m: number) { return Array.from({ length: n }, () => Array(m).fill(0)); }
function vzeros(n: number) { return Array(n).fill(0); }
function kBeam(EI: number, L: number) {
  const L2 = L * L, L3 = L2 * L;
  const a = 12 * EI / L3, b = 6 * EI / L2, c = 4 * EI / L, d = 2 * EI / L;
  return [[ a,  b, -a,  b],[ b,  c, -b,  d],[-a, -b,  a, -b],[ b,  d, -b,  c]];
}
function feUDL(q: number, L: number) {
  const s = q * L / 2;
  return [ s,  s * (L / 6),  s, -s * (L / 6) ];
}
function scatter(K: number[][], k: number[][], i0: number, i1: number) {
  const map = [i0, i0 + 1, i1, i1 + 1];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) K[map[r]][map[c]] += k[r][c];
}
function addLoad(F: number[], fe: number[], i0: number, i1: number) {
  F[i0 + 0] += fe[0]; F[i0 + 1] += fe[1]; F[i1 + 0] += fe[2]; F[i1 + 1] += fe[3];
}
function nearestNode(nodes: number[], xi: number) {
  let best = 0, err = Infinity;
  nodes.forEach((xj, j) => { const e = Math.abs(xj - xi); if (e < err) { err = e; best = j; } });
  return best;
}
function select(M: number[][], rows: number[], cols: number[]) {
  return rows.map(r => cols.map(c => M[r][c]));
}
function pick(v: number[], idx: number[]) { return idx.map(i => v[i]); }
function addv(a: number[], b: number[]) { return a.map((v, i) => v + b[i]); }
function sub(a: number[], b: number[]) { return a.map((v, i) => v - b[i]); }
function mv(A: number[][], x: number[]) { return A.map(row => row.reduce((s, v, i) => s + v * x[i], 0)); }
function cholSolveSPD(A: number[][], b: number[]) {
  const n = A.length, L = mzeros(n, n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = A[i][j];
      for (let k = 0; k < j; k++) sum -= L[i][k] * L[j][k];
      if (i === j) { if (sum <= 0) throw new Error("Matrix not SPD."); L[i][j] = Math.sqrt(sum); }
      else L[i][j] = sum / L[j][j];
    }
  }
  const y = Array(n).fill(0);
  for (let i = 0; i < n; i++) y[i] = (b[i] - L[i].slice(0, i).reduce((s, v, k) => s + v * y[k], 0)) / L[i][i];
  const x = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = 0; for (let k = i + 1; k < n; k++) s += L[k][i] * x[k];
    x[i] = (y[i] - s) / L[i][i];
  }
  return x;
}
function sampleMid(EI: number, L: number, de: number[], q: number) {
  const k = kBeam(EI, L), fe = feUDL(q, L);
  const endForces = mv(k, de).map((v, i) => v - fe[i]);
  const M1 = endForces[1], M2 = endForces[3];
  const Mmid_udl = q * L * L / 8;
  const Mabs = Math.max(Math.abs(M1), Math.abs(M2), Math.abs(Mmid_udl));
  // Hermite shape functions at ξ=0.5
  const N1 = 1 - 3*0.25 + 2*0.125;
  const N2 = L*(0.5 - 2*0.25 + 0.125);
  const N3 = 3*0.25 - 2*0.125;
  const N4 = L*(-0.25 + 0.125);
  const wMid = N1*de[0] + N2*de[1] + N3*de[2] + N4*de[3];
  return { wMid, Mabs };
}

