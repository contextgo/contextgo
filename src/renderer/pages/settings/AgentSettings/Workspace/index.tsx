import { CUSTOM_AVATAR_IMAGE_MAP } from '@/renderer/pages/guid/constants';
import { useAssistantBackends, useAssistantEditor, useAssistantList } from '@/renderer/hooks/assistant';
import { resolveAvatarImageSrc } from '@/renderer/pages/settings/AgentSettings/AssistantManagement/assistantUtils';
import { Message } from '@arco-design/web-react';
import React, { useMemo } from 'react';
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import AgentCreatePage from './create';
import AgentDetailPage from './detail/AgentDetailPage';
import AgentListPage from './list';
import { buildAssistantWorkspaceModel, getVisibleAgentWorkspaceTabs } from './viewModel';

const WorkspaceRootRedirect: React.FC = () => <Navigate to='/agents' replace />;

const AgentWorkspace: React.FC = () => {
  const navigate = useNavigate();
  const [message, messageContext] = Message.useMessage({ maxCount: 10 });

  const {
    assistants,
    systemAssistants,
    activeAssistantId,
    setActiveAssistantId,
    activeAssistant,
    isReadonlyAssistant,
    isExtensionAssistant,
    loadAssistants,
    localeKey,
  } = useAssistantList();

  const { availableBackends, extensionAcpAdapters, refreshAgentDetection } = useAssistantBackends();

  const editor = useAssistantEditor({
    localeKey,
    activeAssistant,
    isReadonlyAssistant,
    isExtensionAssistant,
    setActiveAssistantId,
    loadAssistants,
    refreshAgentDetection,
    message,
  });

  const avatarImageMap = useMemo(() => CUSTOM_AVATAR_IMAGE_MAP, []);
  const editAvatarImage = resolveAvatarImageSrc(editor.editAvatar, avatarImageMap);

  const handleOpenAssistant = async (assistantId: string) => {
    const assistant = assistants.find((item) => item.id === assistantId);
    if (!assistant) {
      navigate('/agents', { replace: true });
      return;
    }

    setActiveAssistantId(assistant.id);
    const model = buildAssistantWorkspaceModel({
      assistant,
      availableSkills: activeAssistant?.id === assistant.id ? editor.availableSkills : [],
      availableHooks: activeAssistant?.id === assistant.id ? editor.availableHooks : [],
      pendingSkills: activeAssistant?.id === assistant.id ? editor.pendingSkills : [],
      selectedSkills: activeAssistant?.id === assistant.id ? editor.selectedSkills : assistant.enabledSkills || [],
      selectedHooks: activeAssistant?.id === assistant.id ? editor.selectedHooks : assistant.enabledHooks || [],
    });

    navigate(`/agents/${assistant.id}/${model.defaultTab || 'skills'}`);
  };

  const handleCreateAssistant = async () => {
    await editor.handleCreate({ openEditor: false });
    navigate('/agents/new');
  };

  return (
    <>
      {messageContext}
      <Routes>
        <Route
          index
          element={
            <AgentListPage
              assistants={assistants}
              systemAssistants={systemAssistants}
              activeAssistantId={activeAssistantId}
              localeKey={localeKey}
              avatarImageMap={avatarImageMap}
              isExtensionAssistant={isExtensionAssistant}
              onCreate={() => void handleCreateAssistant()}
              onOpenAssistant={(assistant) => void handleOpenAssistant(assistant.id)}
              onDuplicateAssistant={(assistant) => void editor.handleDuplicate(assistant, { openEditor: false })}
              onToggleEnabled={(assistant, enabled) => void editor.handleToggleEnabled(assistant, enabled)}
              setActiveAssistantId={setActiveAssistantId}
            />
          }
        />
        <Route
          path='new'
          element={
            <AgentCreatePage
              activeAssistant={activeAssistant}
              isReadonlyAssistant={isReadonlyAssistant}
              availableBackends={availableBackends}
              extensionAcpAdapters={extensionAcpAdapters}
              editAvatarImage={editAvatarImage}
              editor={editor}
              onInitializeCreate={() => editor.handleCreate({ openEditor: false })}
            />
          }
        />
        <Route path=':assistantId' element={<AgentDetailRedirect assistants={assistants} />} />
        <Route
          path=':assistantId/:tabId'
          element={
            <AgentDetailRoute
              assistants={assistants}
              activeAssistant={activeAssistant}
              editor={editor}
              localeKey={localeKey}
              editAvatarImage={editAvatarImage}
            />
          }
        />
        <Route path='*' element={<WorkspaceRootRedirect />} />
      </Routes>
    </>
  );
};

type AgentDetailRedirectProps = {
  assistants: ReturnType<typeof useAssistantList>['assistants'];
};

const AgentDetailRedirect: React.FC<AgentDetailRedirectProps> = ({ assistants }) => {
  const { assistantId } = useParams<{ assistantId: string }>();

  if (!assistantId) {
    return <Navigate to='/agents' replace />;
  }

  const assistant = assistants.find((item) => item.id === assistantId);
  if (!assistant) {
    return <Navigate to='/agents' replace />;
  }

  const model = buildAssistantWorkspaceModel({
    assistant,
    availableSkills: [],
    availableHooks: [],
    pendingSkills: [],
    selectedSkills: assistant.enabledSkills || [],
    selectedHooks: assistant.enabledHooks || [],
  });

  return <Navigate to={`/agents/${assistant.id}/${model.defaultTab || 'skills'}`} replace />;
};

type AgentDetailRouteProps = {
  assistants: ReturnType<typeof useAssistantList>['assistants'];
  activeAssistant: ReturnType<typeof useAssistantList>['activeAssistant'];
  editor: ReturnType<typeof useAssistantEditor>;
  localeKey: string;
  editAvatarImage?: string;
};

const AgentDetailRoute: React.FC<AgentDetailRouteProps> = ({
  assistants,
  activeAssistant,
  editor,
  localeKey,
  editAvatarImage,
}) => {
  const { assistantId, tabId } = useParams<{ assistantId: string; tabId: string }>();

  if (!assistantId || !tabId) {
    return <Navigate to='/agents' replace />;
  }

  const assistant = assistants.find((item) => item.id === assistantId);
  if (!assistant) {
    return <Navigate to='/agents' replace />;
  }

  const model = buildAssistantWorkspaceModel({
    assistant,
    availableSkills: activeAssistant?.id === assistant.id ? editor.availableSkills : [],
    availableHooks: activeAssistant?.id === assistant.id ? editor.availableHooks : [],
    pendingSkills: activeAssistant?.id === assistant.id ? editor.pendingSkills : [],
    selectedSkills: activeAssistant?.id === assistant.id ? editor.selectedSkills : assistant.enabledSkills || [],
    selectedHooks: activeAssistant?.id === assistant.id ? editor.selectedHooks : assistant.enabledHooks || [],
  });

  const visibleTabs = getVisibleAgentWorkspaceTabs(model);

  if (!visibleTabs.includes(tabId as (typeof visibleTabs)[number])) {
    return <Navigate to={`/agents/${assistant.id}/${model.defaultTab || 'skills'}`} replace />;
  }

  return (
    <AgentDetailPage
      assistant={assistant}
      model={model}
      tabId={tabId}
      localeKey={localeKey}
      editAvatarImage={editAvatarImage}
      editor={editor}
      onInitializeAssistant={(targetAssistant) => editor.handleEdit(targetAssistant, { openEditor: false })}
    />
  );
};

export default AgentWorkspace;
