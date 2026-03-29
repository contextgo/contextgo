#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const outputDir = path.resolve(process.argv[2] || 'release-assets');
const packageJsonPath = path.resolve(import.meta.dirname, '../package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const productName = packageJson.productName || packageJson.name || 'ContextGo';

const DIRECT_ASSET_EXTENSIONS = new Set(['aab', 'apk', 'app', 'deb', 'dmg', 'exe', 'hap', 'msi', 'zip']);
const CANONICAL_ASSET_PATTERN = new RegExp(
  `^${escapeForRegex(productName)}-(?<version>\\d+\\.\\d+\\.\\d+(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?)-(?<platform>mac|macos|win|windows|linux|android|harmony|harmonyos)-(?<arch>[A-Za-z0-9._-]+)\\.(?<extension>[A-Za-z0-9]+)$`,
  'i'
);

function escapeForRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function mapPlatform(platformToken) {
  switch (platformToken.toLowerCase()) {
    case 'mac':
    case 'macos':
      return 'macos';
    case 'win':
    case 'windows':
      return 'windows';
    case 'linux':
      return 'linux';
    case 'android':
      return 'android';
    case 'harmony':
    case 'harmonyos':
      return 'harmony';
    default:
      return null;
  }
}

function sha256ForFile(filePath) {
  const hash = createHash('sha256');
  hash.update(readFileSync(filePath));
  return hash.digest('hex');
}

const directAssets = readdirSync(outputDir)
  .filter((fileName) => {
    const filePath = path.join(outputDir, fileName);
    return statSync(filePath).isFile() && DIRECT_ASSET_EXTENSIONS.has(path.extname(fileName).slice(1).toLowerCase());
  })
  .sort();

const versions = new Set();
const assets = directAssets.map((fileName) => {
  const match = fileName.match(CANONICAL_ASSET_PATTERN);
  if (!match?.groups) {
    throw new Error(`Direct release asset does not match canonical naming: ${fileName}`);
  }

  const platform = mapPlatform(match.groups.platform);
  if (!platform) {
    throw new Error(`Unsupported platform token in release asset: ${fileName}`);
  }

  versions.add(match.groups.version);

  const filePath = path.join(outputDir, fileName);
  const stat = statSync(filePath);

  return {
    arch: match.groups.arch.toLowerCase(),
    extension: match.groups.extension.toLowerCase(),
    fileName,
    platform,
    sha256: sha256ForFile(filePath),
    size: stat.size,
  };
});

if (versions.size > 1) {
  throw new Error(`Multiple versions found in release assets: ${Array.from(versions).join(', ')}`);
}

const manifest = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  product: productName,
  version: Array.from(versions)[0] || null,
  checksumAlgorithm: 'sha256',
  assets,
};

writeFileSync(path.join(outputDir, 'release-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
