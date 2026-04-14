import type { AssistantListItem } from '@/renderer/pages/settings/AgentSettings/AssistantManagement/types';
import type { useAssistantEditor } from '@/renderer/hooks/assistant';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import React from 'react';
import AgentBasicsPanel from '../detail/AgentBasicsPanel';

type AssistantEditorState = ReturnType<typeof useAssistantEditor>;

type AgentCreatePageProps = {
  activeAssistant: AssistantListItem | null;
  isReadonlyAssistant: boolean;
  availableBackends: Set<string>;
  extensionAcpAdapters: Record<string, unknown>[] | undefined;
  editAvatarImage?: string;
  editor: AssistantEditorState;
  onInitializeCreate: () => Promise<void> | void;
};

const AgentCreatePage: React.FC<AgentCreatePageProps> = ({
  activeAssistant,
  isReadonlyAssistant,
  availableBackends,
  extensionAcpAdapters,
  editAvatarImage,
  editor,
  onInitializeCreate,
}) => {
  const navigate = useNavigate();
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) {
      return;
    }

    initializedRef.current = true;
    void onInitializeCreate();
  }, [onInitializeCreate]);

  return (
    <AgentBasicsPanel
      mode='create'
      activeAssistant={activeAssistant}
      editName={editor.editName}
      setEditName={editor.setEditName}
      editDescription={editor.editDescription}
      setEditDescription={editor.setEditDescription}
      editAvatar={editor.editAvatar}
      setEditAvatar={editor.setEditAvatar}
      editAvatarImage={editAvatarImage}
      editAgent={editor.editAgent}
      setEditAgent={editor.setEditAgent as (value: string) => void}
      editContext={editor.editContext}
      setEditContext={editor.setEditContext}
      promptViewMode={editor.promptViewMode}
      setPromptViewMode={editor.setPromptViewMode as (value: 'edit' | 'preview') => void}
      availableBackends={availableBackends}
      extensionAcpAdapters={extensionAcpAdapters}
      isReadonlyAssistant={isReadonlyAssistant}
      onClose={() => navigate('/agents')}
      onSave={async () => {
        const assistantId = await editor.handleSave({ closeAfterSave: false });
        if (assistantId) {
          navigate(`/agents/${assistantId}/skills`);
        }
      }}
    />
  );
};

export default AgentCreatePage;
