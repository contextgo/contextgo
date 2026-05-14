import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const docsRoot = path.resolve(__dirname, '..');
const distRoot = path.join(docsRoot, 'dist');

await rm(distRoot, { recursive: true, force: true });
await mkdir(distRoot, { recursive: true });
