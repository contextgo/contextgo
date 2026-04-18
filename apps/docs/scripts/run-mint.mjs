import { spawn } from 'node:child_process';

const args = process.argv.slice(2);

if (args.length === 0) {
  throw new Error('A Mintlify CLI command is required');
}

const run = (command, commandArgs) =>
  new Promise((resolve) => {
    const child = spawn(command, commandArgs, {
      stdio: 'inherit',
      env: process.env,
    });

    child.on('error', (error) => {
      resolve({
        code: null,
        error,
      });
    });

    child.on('close', (code) => {
      resolve({
        code,
        error: null,
      });
    });
  });

const directResult = await run('mint', args);

if (directResult.error && directResult.error.code === 'ENOENT') {
  const fallbackResult = await run('npx', ['-y', 'mint@4.2.521', ...args]);
  if (fallbackResult.error) {
    throw fallbackResult.error;
  }

  process.exit(fallbackResult.code ?? 1);
}

if (directResult.error) {
  throw directResult.error;
}

process.exit(directResult.code ?? 1);
