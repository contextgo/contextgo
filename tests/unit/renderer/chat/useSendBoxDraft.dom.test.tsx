/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { getSendBoxDraftHook, useDeleteDraft, useHasDraft } from '@/renderer/hooks/chat/useSendBoxDraft';

const useAcpDraft = getSendBoxDraftHook('acp', {
  _type: 'acp',
  atPath: [],
  content: '',
  uploadFile: [],
});

describe('useSendBoxDraft', () => {
  it('should notify subscribers immediately when a draft is added or removed', async () => {
    const conversationId = `draft-reactivity-${Date.now()}`;

    const { result } = renderHook(() => {
      const draft = useAcpDraft(conversationId);
      const hasDraft = useHasDraft(conversationId);
      const deleteDraft = useDeleteDraft();

      return {
        draft,
        hasDraft,
        deleteDraft,
      };
    });

    expect(result.current.hasDraft).toBe(false);
    expect(result.current.draft.data).toBeUndefined();

    act(() => {
      result.current.draft.mutate((prev) => ({
        ...prev,
        content: 'hello draft',
      }));
    });

    await waitFor(() => {
      expect(result.current.draft.data?.content).toBe('hello draft');
      expect(result.current.hasDraft).toBe(true);
    });

    await act(async () => {
      const deleted = await result.current.deleteDraft({ conversation_id: conversationId });
      expect(deleted).toBe(true);
    });

    await waitFor(() => {
      expect(result.current.draft.data).toBeUndefined();
      expect(result.current.hasDraft).toBe(false);
    });
  });

  it('should return false when deleting a missing draft', async () => {
    const conversationId = `draft-missing-${Date.now()}`;

    const { result } = renderHook(() => useDeleteDraft());

    await act(async () => {
      const deleted = await result.current({ conversation_id: conversationId });
      expect(deleted).toBe(false);
    });
  });
});
