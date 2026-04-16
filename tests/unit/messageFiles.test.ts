/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { buildDisplayMessage } from '@/renderer/utils/file/messageFiles';
import { buildWorkspaceReferenceLabel } from '@/renderer/utils/file/workspaceReferences';

describe('buildDisplayMessage', () => {
  const workspace = '/tmp/contextgo/workspace-1';

  it('preserves uploads/ subdirectory for files inside workspace', () => {
    const files = [`${workspace}/uploads/photo.jpg`];
    const result = buildDisplayMessage('hello', files, workspace);
    expect(result).toContain(`${workspace}/uploads/photo.jpg`);
  });

  it('preserves nested subdirectories inside workspace', () => {
    const files = [`${workspace}/uploads/subdir/doc.pdf`];
    const result = buildDisplayMessage('hello', files, workspace);
    expect(result).toContain(`${workspace}/uploads/subdir/doc.pdf`);
  });

  it('uses basename for absolute paths outside workspace', () => {
    const files = ['/other/path/external.txt'];
    const result = buildDisplayMessage('hello', files, workspace);
    expect(result).toContain(`${workspace}/external.txt`);
    expect(result).not.toContain('/other/path');
  });

  it('passes relative paths through unchanged', () => {
    const files = ['relative/file.txt'];
    const result = buildDisplayMessage('hello', files, workspace);
    expect(result).toContain(`${workspace}/relative/file.txt`);
  });

  it('returns input unchanged when no files', () => {
    const result = buildDisplayMessage('hello', [], workspace);
    expect(result).toBe('hello');
  });

  it('strips ContextGo timestamp separators from filenames', () => {
    const files = [`${workspace}/uploads/photo_contextgo_1234567890123.jpg`];
    const result = buildDisplayMessage('hello', files, workspace);
    expect(result).toContain(`${workspace}/uploads/photo.jpg`);
  });
});

describe('buildWorkspaceReferenceLabel', () => {
  it('uses relative workspace paths when available', () => {
    const result = buildWorkspaceReferenceLabel({
      path: '/tmp/contextgo/workspace-1/src/index.ts',
      name: 'index.ts',
      isFile: true,
      relativePath: 'src/index.ts',
    });

    expect(result).toBe('@workspace/src/index.ts');
  });

  it('falls back to basename when no relative workspace path is available', () => {
    const result = buildWorkspaceReferenceLabel('/tmp/contextgo/workspace-1/README.md');

    expect(result).toBe('@workspace/README.md');
  });
});
