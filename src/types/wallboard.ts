export type Dept = 'sound' | 'lights' | 'video';
export type DeptCounts = Record<Dept, number> & { total?: number };
