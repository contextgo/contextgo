import { describe, expect, it } from 'vitest';
import {
  GROUP_MODAL_FIELD_CLASS_NAME,
  GROUP_MODAL_SELECT_CLASS_NAME,
} from '../../../src/renderer/pages/conversation/platforms/group/GroupModalShared';

describe('group modal shared styles', () => {
  it('exposes a shared field class for rounded input controls', () => {
    expect(GROUP_MODAL_FIELD_CLASS_NAME).toBeTruthy();
  });

  it('keeps a dedicated select class alongside the shared field class', () => {
    expect(GROUP_MODAL_SELECT_CLASS_NAME).toBeTruthy();
    expect(GROUP_MODAL_SELECT_CLASS_NAME).not.toBe(GROUP_MODAL_FIELD_CLASS_NAME);
  });
});
