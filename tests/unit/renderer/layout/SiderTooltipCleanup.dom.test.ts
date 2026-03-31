import { afterEach, describe, expect, it } from 'vitest';

import { cleanupSiderTooltips } from '@/renderer/utils/ui/siderTooltip';

describe('cleanupSiderTooltips', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('removes only sider-scoped tooltip popups', () => {
    const siderTooltip = document.createElement('div');
    siderTooltip.className = 'arco-tooltip-popup sider-tooltip-popup';

    const genericTooltip = document.createElement('div');
    genericTooltip.className = 'arco-tooltip-popup';

    document.body.appendChild(siderTooltip);
    document.body.appendChild(genericTooltip);

    cleanupSiderTooltips();

    expect(document.body.contains(siderTooltip)).toBe(false);
    expect(document.body.contains(genericTooltip)).toBe(true);
  });
});
