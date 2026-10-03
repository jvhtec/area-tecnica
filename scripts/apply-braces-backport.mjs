import { applyBackport } from './governance/braces-backport.mjs';

try {
  const applied = applyBackport(process.cwd());
  console.log(applied ? 'Verified braces 3.0.3 depth security backport installed.' : 'No development braces package installed; backport not needed.');
} catch (error) {
  console.error(`Braces security backport refused: ${error.message}`);
  process.exitCode = 1;
}
