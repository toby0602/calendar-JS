const { spawnSync } = require('node:child_process');
// Preserve normal output and expose a failed test's details as a check annotation.
const result = spawnSync(process.execPath, [process.env.npm_execpath, 'test'], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, env: process.env });
const output = (result.stdout || '') + (result.stderr || '');
process.stdout.write(output);
if (result.status !== 0) {
  const detail = output.split(/\r?\n/).slice(-70).join('\n').replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  console.log(`::error title=Calendar tests failed::${detail}`);
}
process.exitCode = result.status || (result.error ? 1 : 0);
