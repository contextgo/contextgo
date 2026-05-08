#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import process from 'node:process';

function run(command, args = []) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
  };
}

function nodeCheck() {
  const major = Number(process.versions.node.split('.')[0]);
  return {
    name: 'node',
    ok: Number.isFinite(major) && major >= 22,
    version: process.versions.node,
    required: '>=22',
  };
}

function ffmpegCheck() {
  const result = run('ffmpeg', ['-version']);
  const firstLine = result.stdout.split('\n')[0] || result.stderr.split('\n')[0] || '';
  return {
    name: 'ffmpeg',
    ok: result.ok,
    version: firstLine,
  };
}

function commandCheck(name, args) {
  const result = run(name, args);
  return {
    name,
    ok: result.ok,
    output: result.stdout || result.stderr,
  };
}

const checks = [
  nodeCheck(),
  ffmpegCheck(),
  commandCheck('npx', ['--version']),
  commandCheck('bunx', ['--version']),
  commandCheck('docker', ['--version']),
];

const requiredOk =
  checks.find((check) => check.name === 'node')?.ok && checks.find((check) => check.name === 'ffmpeg')?.ok;
const hasPackageRunner =
  checks.find((check) => check.name === 'npx')?.ok || checks.find((check) => check.name === 'bunx')?.ok;

const result = {
  ok: Boolean(requiredOk && hasPackageRunner),
  checks,
  notes: [
    'HyperFrames rendering requires Node.js 22+ and FFmpeg.',
    'Use npx or bunx for portable CLI execution unless the project pins a package script.',
    'Docker is optional and mainly useful for reproducible render environments.',
  ],
};

console.log(JSON.stringify(result, null, 2));
process.exitCode = result.ok ? 0 : 1;
