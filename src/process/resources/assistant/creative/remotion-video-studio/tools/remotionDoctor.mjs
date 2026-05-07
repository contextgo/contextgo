#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const cwd = process.argv[2] || process.cwd();

function commandExists(command) {
  const result = spawnSync(command, ['--version'], { stdio: 'ignore' });
  return result.status === 0;
}

const checks = [
  { name: 'workspace', ok: existsSync(cwd), detail: cwd },
  { name: 'package.json', ok: existsSync(join(cwd, 'package.json')), detail: join(cwd, 'package.json') },
  { name: 'node', ok: commandExists('node'), detail: 'node --version' },
];

const failed = checks.filter((check) => !check.ok);

for (const check of checks) {
  const status = check.ok ? 'ok' : 'missing';
  console.log(`${status} ${check.name} ${check.detail}`);
}

if (failed.length > 0) {
  process.exitCode = 1;
}
