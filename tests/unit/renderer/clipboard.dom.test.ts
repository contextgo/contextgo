/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyText } from '../../../src/renderer/utils/ui/clipboard';

describe('copyText', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('falls back to execCommand when clipboard.writeText rejects in a secure context', async () => {
    const writeText = vi.fn(async () => {
      throw new Error('NotAllowedError');
    });
    const execCommand = vi.fn(() => true);

    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: true,
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommand,
    });

    await expect(copyText('message scoped copy')).resolves.toBeUndefined();

    expect(writeText).toHaveBeenCalledWith('message scoped copy');
    expect(execCommand).toHaveBeenCalledWith('copy');
  });
});
