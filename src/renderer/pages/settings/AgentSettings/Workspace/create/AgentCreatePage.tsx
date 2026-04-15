import type { AssistantListItem } from '@/renderer/pages/settings/AgentSettings/AssistantManagement/types';
import type { useAssistantEditor } from '@/renderer/hooks/assistant';
import { ipcBridge } from '@/common';
import { PRODUCT_VISIBLE_PRESET_AGENT_TYPES } from '@/renderer/utils/model/availableAgents';
import { applyDefaultConversationName } from '@/renderer/pages/conversation/utils/newConversationName';
import { buildPresetAssistantParams } from '@/renderer/pages/conversation/utils/createConversationParams';
import EmojiPicker from '@/renderer/components/chat/EmojiPicker';
import MarkdownView from '@/renderer/components/Markdown';
import { Avatar, Button, Input, Select, Tag } from '@arco-design/web-react';
import { Robot } from '@icon-park/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import React from 'react';
import { useTranslation } from 'react-i18next';
import AgentCreateStatusFlow from './AgentCreateStatusFlow';
import {
  buildCapabilityRecommendation,
  buildCreateFlowSummary,
  type AgentCreateIntentDraft,
  type AgentCreateStepId,
} from './createFlow';
import styles from '../AssistantWorkspace.module.css';

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

const STEP_ORDER: AgentCreateStepId[] = ['define-work', 'capability-stack', 'runtime-automation', 'review', 'done'];

const buildStepIndex = (stepId: AgentCreateStepId): number => STEP_ORDER.indexOf(stepId);

const AgentCreatePage: React.FC<AgentCreatePageProps> = ({
  activeAssistant,
  isReadonlyAssistant,
  availableBackends,
  extensionAcpAdapters,
  editAvatarImage,
  editor,
  onInitializeCreate,
}) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const initializedRef = useRef(false);
  const lastAppliedRecommendationRef = useRef<string | null>(null);
  const [currentStep, setCurrentStep] = useState<AgentCreateStepId>('define-work');
  const [showProfessionalView, setShowProfessionalView] = useState(false);
  const [createdAssistantId, setCreatedAssistantId] = useState<string | null>(null);
  const [intentDraft, setIntentDraft] = useState<AgentCreateIntentDraft>({
    workDescription: '',
    audience: '',
    output: '',
    workStyle: 'analyze',
    recurrence: 'frequent',
  });

  useEffect(() => {
    if (initializedRef.current) {
      return;
    }

    initializedRef.current = true;
    void onInitializeCreate();
  }, [onInitializeCreate]);

  const recommendation = useMemo(() => buildCapabilityRecommendation(intentDraft), [intentDraft]);
  const reviewSummary = useMemo(
    () =>
      buildCreateFlowSummary({
        recommendation,
        editName: editor.editName,
        editDescription: editor.editDescription,
        workDescription: intentDraft.workDescription,
        workStyle: intentDraft.workStyle,
        recurrence: intentDraft.recurrence,
      }),
    [
      editor.editDescription,
      editor.editName,
      intentDraft.recurrence,
      intentDraft.workDescription,
      intentDraft.workStyle,
      recommendation,
    ]
  );

  useEffect(() => {
    if (!recommendation.linkedPackagePresetId) {
      return;
    }

    if (lastAppliedRecommendationRef.current === recommendation.linkedPackagePresetId) {
      return;
    }

    lastAppliedRecommendationRef.current = recommendation.linkedPackagePresetId;

    if (!editor.editName.trim()) {
      editor.setEditName(recommendation.packageLabel);
    }
    if (!editor.editDescription.trim()) {
      editor.setEditDescription(recommendation.packageDescription);
    }

    editor.setEditAgent(recommendation.runtime);
    editor.setSelectedSkills?.(recommendation.defaultSkills);
    editor.setSelectedHooks?.(recommendation.defaultHooks);
  }, [editor, recommendation]);

  const canAdvanceFromDefineWork = Boolean(intentDraft.workDescription.trim());
  const canAdvanceFromRuntime = Boolean(editor.editAgent);
  const canReview = canAdvanceFromDefineWork && canAdvanceFromRuntime;

  const statusSteps = [
    {
      id: 'define-work' as const,
      label: t('settings.agentCreateFlowDefineWork', { defaultValue: 'Define Work' }),
    },
    {
      id: 'capability-stack' as const,
      label: t('settings.agentCreateFlowCapabilityStack', { defaultValue: 'Build Capability Stack' }),
    },
    {
      id: 'runtime-automation' as const,
      label: t('settings.agentCreateFlowRuntimeAutomation', { defaultValue: 'Runtime & Automation' }),
    },
    {
      id: 'review' as const,
      label: t('settings.agentCreateFlowReview', { defaultValue: 'Review' }),
    },
    {
      id: 'done' as const,
      label: t('settings.agentCreateFlowDone', { defaultValue: 'Done' }),
    },
  ];

  const updateIntentDraft = <K extends keyof AgentCreateIntentDraft>(key: K, value: AgentCreateIntentDraft[K]) => {
    setIntentDraft((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const goToStep = (nextStep: AgentCreateStepId) => {
    if (nextStep === 'capability-stack' && !canAdvanceFromDefineWork) {
      return;
    }
    if (nextStep === 'runtime-automation' && !canAdvanceFromDefineWork) {
      return;
    }
    if (nextStep === 'review' && !canReview) {
      return;
    }
    if (nextStep === 'done' && !createdAssistantId) {
      return;
    }

    setCurrentStep(nextStep);
  };

  const handleNext = () => {
    if (currentStep === 'define-work') {
      goToStep('capability-stack');
      return;
    }
    if (currentStep === 'capability-stack') {
      goToStep('runtime-automation');
      return;
    }
    if (currentStep === 'runtime-automation') {
      goToStep('review');
    }
  };

  const handleBack = () => {
    const currentIndex = buildStepIndex(currentStep);
    if (currentIndex <= 0) {
      navigate('/agents');
      return;
    }

    setCurrentStep(STEP_ORDER[currentIndex - 1]);
  };

  const handleCreate = async () => {
    const assistantId = await editor.handleSave({
      closeAfterSave: false,
      linkedPackagePresetId: recommendation.linkedPackagePresetId ?? undefined,
    });

    if (!assistantId) {
      return;
    }

    setCreatedAssistantId(assistantId);
    setCurrentStep('done');
  };

  const handleStartChat = async () => {
    if (!createdAssistantId) {
      return;
    }

    const params = await buildPresetAssistantParams(
      {
        backend: 'custom',
        customAgentId: createdAssistantId,
        isPreset: true,
        name: editor.editName || reviewSummary.title,
        presetAgentType: editor.editAgent,
      },
      '',
      i18n.language
    );

    const conversation = await ipcBridge.conversation.create.invoke(
      applyDefaultConversationName(
        params,
        t('conversation.welcome.newConversation', { defaultValue: 'New Conversation' })
      )
    );

    if (conversation?.id) {
      navigate(`/conversation/${conversation.id}`);
    }
  };

  const renderRecommendationCards = () => {
    return (
      <div className={styles.createCardGrid}>
        <div className={styles.contentCard}>
          <div className={styles.sectionTitle}>
            {t('settings.agentCreateFlowIdentityRulesCard', { defaultValue: 'Identity & Rules' })}
          </div>
          <div className={styles.sectionText}>
            {t('settings.agentCreateFlowIdentityRulesCardDescription', {
              defaultValue: 'Shape the agent identity and package-backed rule posture before orchestration.',
            })}
          </div>
          <div className={styles.chipRow}>
            <span className={styles.chip}>{reviewSummary.title}</span>
            <span className={styles.chip}>{recommendation.packageLabel}</span>
          </div>
        </div>
        <div className={styles.contentCard}>
          <div className={styles.sectionTitle}>
            {t('settings.agentCreateFlowCoreSkillsCard', { defaultValue: 'Core Skills' })}
          </div>
          <div className={styles.sectionText}>
            {t('settings.agentCreateFlowCoreSkillsCardDescription', {
              defaultValue: 'Recommended packaged skills for this work profile.',
            })}
          </div>
          <div className={styles.chipRow}>
            {recommendation.defaultSkills.map((skillName) => (
              <span key={skillName} className={styles.chip}>
                {skillName}
              </span>
            ))}
          </div>
        </div>
        <div className={styles.contentCard}>
          <div className={styles.sectionTitle}>
            {t('settings.agentCreateFlowAutomationCard', { defaultValue: 'Automation' })}
          </div>
          <div className={styles.sectionText}>
            {t('settings.agentCreateFlowAutomationCardDescription', {
              defaultValue: 'Reactive hooks and ongoing schedules recommended for this workflow.',
            })}
          </div>
          <div className={styles.metaGrid}>
            <div className={styles.metaCard}>
              <div className={styles.metaLabel}>
                {t('settings.agentCreateFlowHooksLabel', { defaultValue: 'Hooks' })}
              </div>
              <div className={styles.metaValue}>{recommendation.defaultHooks.length}</div>
            </div>
            <div className={styles.metaCard}>
              <div className={styles.metaLabel}>
                {t('settings.agentCreateFlowSchedulesLabel', { defaultValue: 'Schedules' })}
              </div>
              <div className={styles.metaValue}>{recommendation.scheduleCount}</div>
            </div>
            <div className={styles.metaCard}>
              <div className={styles.metaLabel}>
                {t('settings.agentCreateFlowCommandsLabel', { defaultValue: 'Commands' })}
              </div>
              <div className={styles.metaValue}>{recommendation.commandCount}</div>
            </div>
          </div>
        </div>
        <div className={styles.contentCard}>
          <div className={styles.sectionTitle}>
            {t('settings.agentCreateFlowRuntimeCard', { defaultValue: 'Runtime' })}
          </div>
          <div className={styles.sectionText}>
            {t('settings.agentCreateFlowRuntimeCardDescription', {
              defaultValue: 'Recommended execution runtime and package source.',
            })}
          </div>
          <div className={styles.chipRow}>
            <span className={styles.chip}>{recommendation.runtime}</span>
            {recommendation.linkedPackagePresetId ? (
              <span className={styles.chip}>{recommendation.linkedPackagePresetId}</span>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'define-work':
        return (
          <div className='grid gap-16px xl:grid-cols-[minmax(0,1fr)_320px]'>
            <div className={styles.contentStack}>
              <div className={styles.contentCard}>
                <div className={styles.sectionTitle}>
                  {t('settings.agentCreateFlowIntentTitle', {
                    defaultValue: 'What work should this Agent take responsibility for?',
                  })}
                </div>
                <Input.TextArea
                  value={intentDraft.workDescription}
                  onChange={(value) => updateIntentDraft('workDescription', value)}
                  placeholder={t('settings.agentCreateFlowIntentPlaceholder', {
                    defaultValue: 'What work should this Agent take responsibility for?',
                  })}
                  autoSize={false}
                  className='h-[180px]'
                />
              </div>
              <div className={styles.createCardGrid}>
                <div className={styles.contentCard}>
                  <div className={styles.sectionTitle}>
                    {t('settings.agentCreateFlowAudience', { defaultValue: 'Audience' })}
                  </div>
                  <Input
                    value={intentDraft.audience}
                    onChange={(value) => updateIntentDraft('audience', value)}
                    placeholder={t('settings.agentCreateFlowAudiencePlaceholder', {
                      defaultValue: 'Who is this Agent mainly serving?',
                    })}
                  />
                </div>
                <div className={styles.contentCard}>
                  <div className={styles.sectionTitle}>
                    {t('settings.agentCreateFlowOutput', { defaultValue: 'Output' })}
                  </div>
                  <Input
                    value={intentDraft.output}
                    onChange={(value) => updateIntentDraft('output', value)}
                    placeholder={t('settings.agentCreateFlowOutputPlaceholder', {
                      defaultValue: 'What should it produce?',
                    })}
                  />
                </div>
                <div className={styles.contentCard}>
                  <div className={styles.sectionTitle}>
                    {t('settings.agentCreateFlowWorkStyle', { defaultValue: 'Work Style' })}
                  </div>
                  <Select
                    value={intentDraft.workStyle}
                    onChange={(value) => updateIntentDraft('workStyle', value as AgentCreateIntentDraft['workStyle'])}
                  >
                    <Select.Option value='analyze'>
                      {t('settings.agentCreateFlowWorkStyleAnalyze', { defaultValue: 'Analyze' })}
                    </Select.Option>
                    <Select.Option value='create'>
                      {t('settings.agentCreateFlowWorkStyleCreate', { defaultValue: 'Create' })}
                    </Select.Option>
                    <Select.Option value='execute'>
                      {t('settings.agentCreateFlowWorkStyleExecute', { defaultValue: 'Execute' })}
                    </Select.Option>
                    <Select.Option value='maintain'>
                      {t('settings.agentCreateFlowWorkStyleMaintain', { defaultValue: 'Maintain' })}
                    </Select.Option>
                  </Select>
                </div>
                <div className={styles.contentCard}>
                  <div className={styles.sectionTitle}>
                    {t('settings.agentCreateFlowRecurrence', { defaultValue: 'Recurrence' })}
                  </div>
                  <Select
                    value={intentDraft.recurrence}
                    onChange={(value) => updateIntentDraft('recurrence', value as AgentCreateIntentDraft['recurrence'])}
                  >
                    <Select.Option value='one-off'>
                      {t('settings.agentCreateFlowRecurrenceOneOff', { defaultValue: 'One-off' })}
                    </Select.Option>
                    <Select.Option value='frequent'>
                      {t('settings.agentCreateFlowRecurrenceFrequent', { defaultValue: 'Frequent' })}
                    </Select.Option>
                    <Select.Option value='continuous'>
                      {t('settings.agentCreateFlowRecurrenceContinuous', { defaultValue: 'Continuous' })}
                    </Select.Option>
                  </Select>
                </div>
              </div>
            </div>
            <div className={styles.contentStack}>
              <div className={styles.contentCard}>
                <div className={styles.sectionTitle}>
                  {t('settings.agentCreateFlowLiveSummary', { defaultValue: 'Live Summary' })}
                </div>
                <div className={styles.sectionText}>{reviewSummary.workSummary}</div>
                <div className={styles.chipRow}>
                  <span className={styles.chip}>{recommendation.packageLabel}</span>
                  <span className={styles.chip}>{recommendation.runtime}</span>
                </div>
              </div>
            </div>
          </div>
        );
      case 'capability-stack':
        return (
          <div className={styles.contentStack}>
            {renderRecommendationCards()}
            <div className={styles.contentCard}>
              <div className='flex items-center justify-between gap-12px'>
                <div>
                  <div className={styles.sectionTitle}>
                    {t('settings.agentCreateFlowProfessionalView', { defaultValue: 'Professional Composition View' })}
                  </div>
                  <div className={styles.sectionText}>
                    {t('settings.agentCreateFlowProfessionalViewDescription', {
                      defaultValue:
                        'Inspect the package-backed stack without making package selection the first action.',
                    })}
                  </div>
                </div>
                <Button type='outline' onClick={() => setShowProfessionalView((current) => !current)}>
                  {showProfessionalView
                    ? t('settings.agentCreateFlowHideProfessionalView', { defaultValue: 'Hide Pro View' })
                    : t('settings.agentCreateFlowShowProfessionalView', { defaultValue: 'Show Pro View' })}
                </Button>
              </div>
              {showProfessionalView ? (
                <div className={styles.sectionText}>
                  {`${intentDraft.workDescription || t('settings.agentCreateFlowWorkLabel', { defaultValue: 'Work Intent' })} -> ${recommendation.packageLabel} -> ${recommendation.defaultSkills.length} skills -> ${recommendation.defaultHooks.length} hooks -> ${recommendation.scheduleCount} schedules -> ${recommendation.commandCount} commands -> ${recommendation.runtime}`}
                </div>
              ) : null}
            </div>
          </div>
        );
      case 'runtime-automation':
        return (
          <div className='grid gap-16px xl:grid-cols-[minmax(0,1fr)_320px]'>
            <div className={styles.contentStack}>
              <div className={styles.contentCard}>
                <div className={styles.sectionTitle}>
                  {t('settings.agentCreateFlowNameAvatar', { defaultValue: 'Name & Avatar' })}
                </div>
                <div className='mt-12px flex items-center gap-12px'>
                  {activeAssistant?.isBuiltin || isReadonlyAssistant ? (
                    <Avatar shape='square' size={48} className='bg-bg-1 rounded-8px'>
                      {editAvatarImage ? (
                        <img src={editAvatarImage} alt='' width={28} height={28} style={{ objectFit: 'contain' }} />
                      ) : editor.editAvatar ? (
                        <span className='text-24px'>{editor.editAvatar}</span>
                      ) : (
                        <Robot theme='outline' size={20} />
                      )}
                    </Avatar>
                  ) : (
                    <EmojiPicker
                      value={editor.editAvatar}
                      onChange={(emoji) => editor.setEditAvatar(emoji)}
                      placement='br'
                    >
                      <div className='cursor-pointer'>
                        <Avatar shape='square' size={48} className='bg-bg-1 rounded-8px'>
                          {editAvatarImage ? (
                            <img src={editAvatarImage} alt='' width={28} height={28} style={{ objectFit: 'contain' }} />
                          ) : editor.editAvatar ? (
                            <span className='text-24px'>{editor.editAvatar}</span>
                          ) : (
                            <Robot theme='outline' size={20} />
                          )}
                        </Avatar>
                      </div>
                    </EmojiPicker>
                  )}
                  <Input
                    value={editor.editName}
                    onChange={editor.setEditName}
                    placeholder={t('settings.agentNamePlaceholder', { defaultValue: 'Enter a name for this agent' })}
                  />
                </div>
                <Input
                  className='mt-12px'
                  value={editor.editDescription}
                  onChange={editor.setEditDescription}
                  placeholder={t('settings.assistantDescriptionPlaceholder', {
                    defaultValue: 'What can this assistant help with?',
                  })}
                />
              </div>
              <div className={styles.contentCard}>
                <div className={styles.sectionTitle}>
                  {t('settings.agentCreateFlowRuntimeCard', { defaultValue: 'Runtime' })}
                </div>
                <Select
                  className='mt-12px w-full'
                  value={editor.editAgent}
                  onChange={(value) => editor.setEditAgent(value as string)}
                >
                  {[
                    { value: 'gemini', label: 'Gemini CLI' },
                    { value: 'claude', label: 'Claude Code' },
                    { value: 'codex', label: 'Codex' },
                    { value: 'opencode', label: 'OpenCode' },
                  ]
                    .filter((option) =>
                      PRODUCT_VISIBLE_PRESET_AGENT_TYPES.includes(
                        option.value as (typeof PRODUCT_VISIBLE_PRESET_AGENT_TYPES)[number]
                      )
                    )
                    .filter((option) => availableBackends.has(option.value))
                    .map((option) => (
                      <Select.Option key={option.value} value={option.value}>
                        {option.label}
                      </Select.Option>
                    ))}
                  {extensionAcpAdapters?.map((adapter) => {
                    const id = adapter.id as string;
                    const name = (adapter.name as string) || id;
                    return (
                      <Select.Option key={id} value={id}>
                        <span className='flex items-center gap-6px'>
                          {name}
                          <Tag size='small' color='arcoblue'>
                            ext
                          </Tag>
                        </span>
                      </Select.Option>
                    );
                  })}
                </Select>
              </div>
              <div className={styles.contentCard}>
                <div className={styles.sectionTitle}>{t('settings.assistantRules', { defaultValue: 'Rules' })}</div>
                <Input.TextArea
                  value={editor.editContext}
                  onChange={editor.setEditContext}
                  placeholder={t('settings.assistantRulesPlaceholder', {
                    defaultValue: 'Enter rules in Markdown format...',
                  })}
                  autoSize={false}
                  className='h-[220px]'
                />
              </div>
            </div>
            <div className={styles.contentStack}>
              <div className={styles.contentCard}>
                <div className={styles.sectionTitle}>
                  {t('settings.agentCreateFlowAutomationCard', { defaultValue: 'Automation' })}
                </div>
                <div className={styles.sectionText}>
                  {t('settings.agentCreateFlowAutomationSidebarDescription', {
                    defaultValue:
                      'Hooks, schedules, and commands stay visible here so the Agent feels like a working system, not just a prompt.',
                  })}
                </div>
                <div className={styles.chipRow}>
                  {recommendation.defaultHooks.map((hookName) => (
                    <span key={hookName} className={styles.chip}>
                      {hookName}
                    </span>
                  ))}
                </div>
                <div className={styles.metaGrid}>
                  <div className={styles.metaCard}>
                    <div className={styles.metaLabel}>
                      {t('settings.agentCreateFlowCommandsLabel', { defaultValue: 'Commands' })}
                    </div>
                    <div className={styles.metaValue}>{recommendation.commandCount}</div>
                  </div>
                  <div className={styles.metaCard}>
                    <div className={styles.metaLabel}>
                      {t('settings.agentCreateFlowSchedulesLabel', { defaultValue: 'Schedules' })}
                    </div>
                    <div className={styles.metaValue}>{recommendation.scheduleCount}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 'review':
        return (
          <div className='grid gap-16px xl:grid-cols-[minmax(0,1fr)_320px]'>
            <div className={styles.contentStack}>
              <div className={styles.contentCard}>
                <div className={styles.sectionTitle}>
                  {t('settings.agentCreateFlowReviewSummary', { defaultValue: 'Review Summary' })}
                </div>
                <div className={styles.metaGrid}>
                  <div className={styles.metaCard}>
                    <div className={styles.metaLabel}>
                      {t('settings.agentCreateFlowWorkLabel', { defaultValue: 'Work' })}
                    </div>
                    <div className={styles.metaValue}>{reviewSummary.workSummary}</div>
                  </div>
                  <div className={styles.metaCard}>
                    <div className={styles.metaLabel}>
                      {t('settings.agentCreateFlowRuntimeCard', { defaultValue: 'Runtime' })}
                    </div>
                    <div className={styles.metaValue}>{reviewSummary.runtimeLabel}</div>
                  </div>
                  <div className={styles.metaCard}>
                    <div className={styles.metaLabel}>
                      {t('settings.agentCreateFlowCapabilitiesLabel', { defaultValue: 'Capabilities' })}
                    </div>
                    <div className={styles.metaValue}>{reviewSummary.capabilityCountLabel}</div>
                  </div>
                  <div className={styles.metaCard}>
                    <div className={styles.metaLabel}>
                      {t('settings.agentCreateFlowAutomationLabel', { defaultValue: 'Automation' })}
                    </div>
                    <div className={styles.metaValue}>{reviewSummary.automationLabel}</div>
                  </div>
                </div>
              </div>
            </div>
            <div className={styles.contentStack}>
              <div className={styles.contentCard}>
                <div className={styles.sectionTitle}>{reviewSummary.title}</div>
                <div className={styles.sectionText}>{reviewSummary.description}</div>
                <div className={styles.chipRow}>
                  <span className={styles.chip}>{recommendation.packageLabel}</span>
                  <span className={styles.chip}>{recommendation.runtime}</span>
                </div>
              </div>
            </div>
          </div>
        );
      case 'done':
        return (
          <div className='grid gap-16px xl:grid-cols-[minmax(0,1fr)_320px]'>
            <div className={styles.contentStack}>
              <div className={styles.contentCard}>
                <div className={styles.sectionTitle}>
                  {t('settings.agentCreateFlowDoneTitle', { defaultValue: 'Agent created' })}
                </div>
                <div className={styles.sectionText}>
                  {t('settings.agentCreateFlowDoneDescription', {
                    defaultValue:
                      'The Agent is now created with its recommended capability stack and is ready for either immediate use or deeper orchestration.',
                  })}
                </div>
                <div className={styles.chipRow}>
                  <span className={styles.chip}>{reviewSummary.title}</span>
                  <span className={styles.chip}>{recommendation.packageLabel}</span>
                </div>
              </div>
            </div>
            <div className={styles.contentStack}>
              <div className={styles.markdownReader}>
                <MarkdownView
                  hiddenCodeCopyButton
                >{`- ${reviewSummary.capabilityCountLabel}\n- ${reviewSummary.automationLabel}`}</MarkdownView>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const renderFooter = () => {
    if (currentStep === 'review') {
      return (
        <div className={styles.createFooter}>
          <Button onClick={handleBack}>{t('common.back', { defaultValue: 'Back' })}</Button>
          <div className={styles.actionRow}>
            <Button type='outline' onClick={() => void handleCreate()}>
              {t('settings.agentCreateFlowCreateAndStart', { defaultValue: 'Create and Start' })}
            </Button>
            <Button type='primary' onClick={() => void handleCreate()}>
              {t('settings.agentCreateFlowCreateAndContinue', { defaultValue: 'Create and Continue Orchestration' })}
            </Button>
          </div>
        </div>
      );
    }

    if (currentStep === 'done') {
      return (
        <div className={styles.createFooter}>
          <Button onClick={() => setCurrentStep('review')}>
            {t('settings.agentCreateFlowViewCapabilityStack', { defaultValue: 'View Capability Stack' })}
          </Button>
          <div className={styles.actionRow}>
            <Button type='outline' onClick={() => void handleStartChat()}>
              {t('settings.agentCreateFlowStartChat', { defaultValue: 'Start Chat' })}
            </Button>
            <Button
              type='primary'
              onClick={() => {
                if (createdAssistantId) {
                  navigate(`/agents/${createdAssistantId}`);
                }
              }}
            >
              {t('settings.agentCreateFlowContinueOrchestration', { defaultValue: 'Continue Orchestration' })}
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className={styles.createFooter}>
        <Button onClick={handleBack}>{t('common.back', { defaultValue: 'Back' })}</Button>
        <Button
          type='primary'
          onClick={handleNext}
          disabled={
            (currentStep === 'define-work' && !canAdvanceFromDefineWork) ||
            (currentStep === 'runtime-automation' && !canReview)
          }
        >
          {t('settings.agentCreateFlowNext', { defaultValue: 'Next' })}
        </Button>
      </div>
    );
  };

  return (
    <div className={`${styles.surface} ${styles.surfaceFill}`}>
      <div className={styles.detailHeader}>
        <div className={styles.pageHeaderMeta}>
          <h2 className={styles.pageTitle}>
            {t('settings.agentWorkspaceCreateTitle', { defaultValue: 'Create Agent' })}
          </h2>
          <p className={styles.pageDescription}>
            {t('settings.agentCreateFlowDescription', {
              defaultValue:
                'Define the work first, let ContextGo map the capability stack, then confirm runtime and automation before creating the Agent.',
            })}
          </p>
        </div>
        <AgentCreateStatusFlow
          currentStep={currentStep}
          steps={statusSteps}
          onSelectStep={(stepId) => goToStep(stepId)}
          highestUnlockedStep={
            createdAssistantId
              ? 'done'
              : canReview
                ? 'review'
                : canAdvanceFromDefineWork
                  ? 'runtime-automation'
                  : 'define-work'
          }
        />
      </div>

      <div className={styles.detailPane}>{renderStepContent()}</div>
      {renderFooter()}
    </div>
  );
};

export default AgentCreatePage;
