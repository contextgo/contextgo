/**
 * AssistantEditDrawer — Dialog for creating/editing an assistant.
 * Contains name/avatar fields, agent selector, rules editor, and skills section.
 */
import type {
  AssistantListItem,
  HookInfo,
  PendingSkill,
  RelevantAssistantHook,
  RelevantAssistantSkill,
  SkillInfo,
} from './types';
import {
  getIncompatibleHookNames,
  getRelevantAssistantHooks,
  getRelevantAssistantSkills,
  hasBuiltinSkills,
  isHookSupportedByBackend,
} from './assistantUtils';
import { HOOK_OUTPUT_TARGET_PRESENTATION } from '../hookLibraryUtils';
import HookRoutingConfigModal from '../HookRoutingConfigModal';
import { PRODUCT_VISIBLE_PRESET_AGENT_TYPES } from '@/renderer/utils/model/availableAgents';
import EmojiPicker from '@/renderer/components/chat/EmojiPicker';
import { ContextGoModal } from '@/renderer/components/base';
import MarkdownView from '@/renderer/components/Markdown';
import { ipcBridge } from '@/common';
import { Avatar, Button, Checkbox, Collapse, Input, Modal, Select, Tag, Typography } from '@arco-design/web-react';
import { Delete, FolderOpen, Plus, Refresh, Robot } from '@icon-park/react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  buildHookOutputRoutingConfig,
  canConfigureHookOutputRouting,
  createHookOutputRoutingDraft,
  type HookOutputRoutingDraft,
} from '../hookLibraryUtils';

type AssistantEditDrawerProps = {
  // Drawer visibility
  editVisible: boolean;
  setEditVisible: (v: boolean) => void;
  isCreating: boolean;

  // Identity fields
  editName: string;
  setEditName: (v: string) => void;
  editDescription: string;
  setEditDescription: (v: string) => void;
  editAvatar: string;
  setEditAvatar: (v: string) => void;
  editAvatarImage: string | undefined;
  editAgent: string;
  setEditAgent: (v: string) => void;

  // Rules / prompt
  editContext: string;
  setEditContext: (v: string) => void;
  promptViewMode: 'edit' | 'preview';
  setPromptViewMode: (v: 'edit' | 'preview') => void;

  // Skills state
  availableSkills: SkillInfo[];
  availableHooks: HookInfo[];
  selectedSkills: string[];
  setSelectedSkills: (v: string[]) => void;
  selectedHooks: string[];
  setSelectedHooks: (v: string[]) => void;
  hooksLoading: boolean;
  hooksDir: string;
  handleRefreshHooks: () => Promise<HookInfo[]>;
  handleImportHook: () => Promise<void>;
  handleOpenHooksDir: () => Promise<void>;
  deleteHookName: string | null;
  setDeleteHookName: (v: string | null) => void;
  handleDeleteHookConfirm: () => Promise<void>;
  pendingSkills: PendingSkill[];
  customSkills: string[];
  setDeletePendingSkillName: (v: string | null) => void;
  setDeleteCustomSkillName: (v: string | null) => void;
  setSkillsModalVisible: (v: boolean) => void;

  // Active assistant info
  activeAssistant: AssistantListItem | null;
  activeAssistantId: string | null;
  isReadonlyAssistant: boolean;
  isExtensionAssistant: (assistant: AssistantListItem | null | undefined) => boolean;

  // Agent backend options
  availableBackends: Set<string>;
  extensionAcpAdapters: Record<string, unknown>[] | undefined;

  // Handlers
  handleSave: () => void;
  handleDeleteClick: () => void;
};

const HOOK_CATEGORY_COLORS: Record<string, 'arcoblue' | 'green' | 'red' | 'purple' | 'gray'> = {
  clarity: 'arcoblue',
  quality: 'green',
  safety: 'red',
  continuity: 'purple',
  operations: 'gray',
};

type SkillPreviewDocument = {
  title: string;
  description: string;
  body: string;
};

type SkillPreviewSection = {
  heading: string | null;
  level: number | null;
  lines: string[];
};

const SKILL_PREVIEW_EXCLUDED_SECTION_PATTERNS = [
  /\btroubleshooting\b/i,
  /\bdebug(?:ging)?\b/i,
  /\bexample(?:s)?\b/i,
  /\bcommands?\b/i,
  /\binstallation\b/i,
  /\bsetup\b/i,
  /\breferences?\b/i,
  /\bresources?\b/i,
  /\bappendix\b/i,
  /\bfaq\b/i,
];

const SKILL_PREVIEW_EXCLUDED_PARAGRAPH_PATTERNS = [
  /^visual issues?$/,
  /^example(?:s)?$/,
  /^commands?$/,
  /^debug(?:ging)?$/,
  /^fix$/,
  /^expected$/,
];

const normalizeSkillPreviewLabel = (value: string) => {
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/, '')
    .replace(/^\d+\.\s*/, '')
    .replace(/[*_`~]/g, '')
    .replace(/[^a-z0-9\u4e00-\u9fff\s-]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
};

const stripSkillPreviewCodeFences = (markdown: string) => {
  return markdown.replace(/```[\s\S]*?```/g, '\n').replace(/~~~[\s\S]*?~~~/g, '\n');
};

const cleanupSkillPreviewMarkdown = (markdown: string) => {
  return markdown
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => {
      if (!paragraph) {
        return false;
      }

      const plainText = normalizeSkillPreviewLabel(
        paragraph
          .replace(/^\s*[-*+]\s+/gm, '')
          .replace(/^\s*\d+\.\s+/gm, '')
          .replace(/`([^`]+)`/g, '$1')
      );

      if (!plainText) {
        return false;
      }

      const lineCount = paragraph.split('\n').filter((line) => line.trim()).length;
      if (lineCount === 1 && SKILL_PREVIEW_EXCLUDED_PARAGRAPH_PATTERNS.some((pattern) => pattern.test(plainText))) {
        return false;
      }

      return true;
    })
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const buildSkillPreviewBody = ({ body }: { body: string }) => {
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const sections: SkillPreviewSection[] = [];
  let currentSection: SkillPreviewSection = {
    heading: null,
    level: null,
    lines: [],
  };

  lines.forEach((line) => {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      if (currentSection.lines.some((item) => item.trim())) {
        sections.push(currentSection);
      }

      currentSection = {
        heading: headingMatch[2].trim(),
        level: headingMatch[1].length,
        lines: [line],
      };
      return;
    }

    currentSection.lines.push(line);
  });

  if (currentSection.lines.some((line) => line.trim())) {
    sections.push(currentSection);
  }

  const distilledSections: string[] = [];
  let excludedParentLevel: number | null = null;

  sections.forEach((section) => {
    if (excludedParentLevel !== null) {
      if (section.level !== null && section.level <= excludedParentLevel) {
        excludedParentLevel = null;
      } else {
        return;
      }
    }

    const normalizedHeading = section.heading ? normalizeSkillPreviewLabel(section.heading) : '';
    if (
      normalizedHeading &&
      SKILL_PREVIEW_EXCLUDED_SECTION_PATTERNS.some((pattern) => pattern.test(normalizedHeading))
    ) {
      excludedParentLevel = section.level;
      return;
    }

    const sectionLines = section.level === 1 ? section.lines.slice(1) : section.lines;
    const cleanedSection = cleanupSkillPreviewMarkdown(stripSkillPreviewCodeFences(sectionLines.join('\n')));
    if (!cleanedSection) {
      return;
    }

    distilledSections.push(cleanedSection);
  });

  const distilledBody = distilledSections.join('\n\n').trim();
  if (distilledBody) {
    return distilledBody;
  }

  return cleanupSkillPreviewMarkdown(stripSkillPreviewCodeFences(body));
};

const parseSkillPreviewDocument = ({
  content,
  fallbackName,
  fallbackDescription,
}: {
  content: string;
  fallbackName: string;
  fallbackDescription: string;
}): SkillPreviewDocument => {
  const trimmedContent = content.trim();
  const frontmatterMatch = trimmedContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);

  if (!frontmatterMatch) {
    return {
      title: fallbackName,
      description: fallbackDescription,
      body: buildSkillPreviewBody({ body: trimmedContent }),
    };
  }

  let title = fallbackName;
  let description = fallbackDescription;
  const frontmatter = frontmatterMatch[1];
  const body = frontmatterMatch[2].trim();

  frontmatter.split(/\r?\n/).forEach((line) => {
    const separatorIndex = line.indexOf(':');
    if (separatorIndex <= 0) {
      return;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '');

    if (key === 'name' && value) {
      title = value;
    }

    if (key === 'description' && value) {
      description = value;
    }
  });

  return {
    title,
    description,
    body: buildSkillPreviewBody({ body }),
  };
};

const AssistantEditDrawer: React.FC<AssistantEditDrawerProps> = ({
  editVisible,
  setEditVisible,
  isCreating,
  editName,
  setEditName,
  editDescription,
  setEditDescription,
  editAvatar,
  setEditAvatar,
  editAvatarImage,
  editAgent,
  setEditAgent,
  editContext,
  setEditContext,
  promptViewMode,
  setPromptViewMode,
  availableSkills,
  availableHooks,
  selectedSkills,
  setSelectedSkills,
  selectedHooks,
  setSelectedHooks,
  hooksLoading,
  hooksDir,
  handleRefreshHooks,
  handleImportHook,
  handleOpenHooksDir,
  deleteHookName,
  setDeleteHookName,
  handleDeleteHookConfirm,
  pendingSkills,
  customSkills: _customSkills,
  setDeletePendingSkillName,
  setDeleteCustomSkillName,
  setSkillsModalVisible,
  activeAssistant,
  activeAssistantId,
  isReadonlyAssistant,
  isExtensionAssistant,
  availableBackends,
  extensionAcpAdapters,
  handleSave,
  handleDeleteClick,
}) => {
  const { t } = useTranslation();
  const textareaWrapperRef = useRef<HTMLDivElement>(null);
  const [configuringHook, setConfiguringHook] = useState<HookInfo | null>(null);
  const [routingDraft, setRoutingDraft] = useState<HookOutputRoutingDraft | null>(null);
  const [savingHookRouting, setSavingHookRouting] = useState(false);
  const [hookLibraryVisible, setHookLibraryVisible] = useState(false);
  const [previewingSkill, setPreviewingSkill] = useState<RelevantAssistantSkill | null>(null);
  const [skillPreviewContent, setSkillPreviewContent] = useState('');
  const [skillPreviewLoading, setSkillPreviewLoading] = useState(false);

  // Auto focus textarea when drawer opens in edit mode
  useEffect(() => {
    if (editVisible && promptViewMode === 'edit') {
      const timer = setTimeout(() => {
        const textarea = textareaWrapperRef.current?.querySelector('textarea');
        textarea?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [editVisible, promptViewMode]);

  // Whether skills section should be visible
  const showSkills =
    isCreating ||
    (activeAssistantId !== null && hasBuiltinSkills(activeAssistantId)) ||
    (activeAssistant !== null && !activeAssistant.isBuiltin && !isExtensionAssistant(activeAssistant));
  const relevantSkills = getRelevantAssistantSkills({
    availableSkills,
    selectedSkills,
    pendingSkills,
  });
  const relevantHooks = getRelevantAssistantHooks({
    availableHooks,
    selectedHooks,
  });
  const incompatibleHookNameSet = new Set(getIncompatibleHookNames(availableHooks, selectedHooks, editAgent));
  const attachedSkillCount = relevantSkills.length;
  const attachedHookCount = relevantHooks.length;
  const assistantKindLabel = activeAssistant?.isBuiltin
    ? t('settings.assistantTypeBuiltin', { defaultValue: 'Built-in' })
    : activeAssistant && isExtensionAssistant(activeAssistant)
      ? t('settings.assistantTypeExtension', { defaultValue: 'Extension' })
      : t('settings.assistantTypeCustom', { defaultValue: 'Custom' });
  const assistantModeLabel = isCreating
    ? t('settings.assistantModeCreate', { defaultValue: 'Creating new assistant' })
    : isReadonlyAssistant
      ? t('settings.assistantModeReadonly', { defaultValue: 'Read-only details' })
      : t('settings.assistantModeEditable', { defaultValue: 'Editable details' });
  const previewDocument = useMemo(() => {
    if (!previewingSkill) {
      return null;
    }

    return parseSkillPreviewDocument({
      content: skillPreviewContent,
      fallbackName: previewingSkill.name,
      fallbackDescription: previewingSkill.description || '',
    });
  }, [previewingSkill, skillPreviewContent]);

  const renderSkillDependencyTags = (skill: RelevantAssistantSkill) => {
    const visibleHints = (skill.dependencyHints || []).filter(
      (hint) => hint.source !== 'openai' || editAgent === 'codex'
    );
    if (visibleHints.length === 0) {
      return null;
    }

    return (
      <div className='mt-6px flex flex-wrap gap-6px'>
        {visibleHints.map((hint) => {
          const color =
            hint.status === 'ready'
              ? 'green'
              : hint.status === 'missing'
                ? 'red'
                : hint.kind === 'mcp'
                  ? 'arcoblue'
                  : 'gray';
          const labelPrefix =
            hint.kind === 'env'
              ? hint.status === 'missing'
                ? t('settings.skillDependencyEnvMissing', { defaultValue: 'Env Missing' })
                : t('settings.skillDependencyEnvReady', { defaultValue: 'Env Ready' })
              : hint.kind === 'command'
                ? hint.status === 'missing'
                  ? t('settings.skillDependencyCommandMissing', { defaultValue: 'Command Missing' })
                  : t('settings.skillDependencyCommandReady', { defaultValue: 'Command Ready' })
                : hint.kind === 'mcp'
                  ? t('settings.skillDependencyCodexTool', { defaultValue: 'Codex Tool' })
                  : t('settings.skillDependencyCompatibility', { defaultValue: 'Compatibility' });

          return (
            <Tag key={`${hint.source}:${hint.kind}:${hint.label}`} size='small' color={color}>
              {`${labelPrefix}: ${hint.label}`}
            </Tag>
          );
        })}
      </div>
    );
  };

  const renderSkillCompatibilityNotes = (skill: RelevantAssistantSkill) => {
    if (!skill.compatibility || skill.compatibility.length === 0) {
      return null;
    }

    return (
      <div className='mt-6px flex flex-col gap-4px'>
        {skill.compatibility.slice(0, 2).map((note) => (
          <div key={note} className='text-11px leading-relaxed text-t-tertiary'>
            {note}
          </div>
        ))}
      </div>
    );
  };

  const handleCloseSkillPreview = () => {
    if (skillPreviewLoading) {
      return;
    }

    setPreviewingSkill(null);
    setSkillPreviewContent('');
  };

  const handleOpenSkillPreview = async (skill: RelevantAssistantSkill) => {
    if (skill.isPending || !skill.location) {
      return;
    }

    setPreviewingSkill(skill);
    setSkillPreviewContent('');
    setSkillPreviewLoading(true);

    try {
      const result = await ipcBridge.fs.readSkillContent.invoke({ skillPath: skill.location });
      if (!result.success || !result.data?.content) {
        setPreviewingSkill(null);
        Modal.error({
          title:
            result.msg || t('settings.assistantSkillPreviewFailed', { defaultValue: 'Failed to load skill content.' }),
        });
        return;
      }

      setSkillPreviewContent(result.data.content);
    } catch (error) {
      console.error('Failed to preview skill content:', error);
      setPreviewingSkill(null);
      Modal.error({
        title: t('settings.assistantSkillPreviewFailed', { defaultValue: 'Failed to load skill content.' }),
      });
    } finally {
      setSkillPreviewLoading(false);
    }
  };

  const renderRelevantSkillItem = (skill: RelevantAssistantSkill) => {
    return (
      <div key={skill.name} className='flex items-start gap-8px rounded-4px p-8px hover:bg-fill-1'>
        <Checkbox
          checked={selectedSkills.includes(skill.name)}
          className='mt-2px cursor-pointer'
          onChange={() => {
            if (selectedSkills.includes(skill.name)) {
              setSelectedSkills(selectedSkills.filter((s) => s !== skill.name));
            } else {
              setSelectedSkills([...selectedSkills, skill.name]);
            }
          }}
        />
        <div className='flex-1 min-w-0'>
          <div className='flex items-center gap-6px flex-wrap'>
            <div className='text-13px font-medium text-t-primary'>{skill.name}</div>
            {skill.hiddenFromSkillsLibrary ? (
              <Tag size='small' color='arcoblue'>
                {t('settings.assistantSkillPackageTag', { defaultValue: 'Packaged' })}
              </Tag>
            ) : null}
            {skill.isPending ? (
              <span className='bg-[rgba(var(--primary-6),0.08)] text-primary-6 border border-[rgba(var(--primary-6),0.2)] text-10px px-4px py-1px rd-4px font-medium uppercase'>
                Pending
              </span>
            ) : null}
            {skill.isCustom && !skill.isPending ? (
              <span className='bg-[rgba(242,156,27,0.08)] text-[rgb(242,156,27)] border border-[rgba(242,156,27,0.2)] text-10px px-4px py-1px rd-4px font-medium uppercase'>
                {t('settings.skillsHub.custom', { defaultValue: 'Custom' })}
              </span>
            ) : null}
          </div>
          {skill.description ? (
            <div className='text-12px text-t-secondary mt-2px line-clamp-2'>{skill.description}</div>
          ) : null}
          {skill.hiddenFromSkillsLibrary ? (
            <div className='mt-6px text-11px text-t-tertiary'>
              {t('settings.assistantSkillPackHint', {
                defaultValue:
                  'This skill is bundled into the built-in harness pack and is not exposed as a standalone library item.',
              })}
            </div>
          ) : null}
          {skill.isPending ? (
            <div className='mt-6px text-11px text-t-tertiary'>
              {t('settings.assistantSkillPreviewUnavailableHint', {
                defaultValue: 'This skill is not available in the local library yet.',
              })}
            </div>
          ) : null}
          {renderSkillDependencyTags(skill)}
          {renderSkillCompatibilityNotes(skill)}
        </div>
        {!skill.isPending && skill.location ? (
          <Button
            type='text'
            size='mini'
            onClick={(event) => {
              event.stopPropagation();
              void handleOpenSkillPreview(skill);
            }}
          >
            {t('settings.assistantSkillPreview', { defaultValue: 'Preview' })}
          </Button>
        ) : null}
      </div>
    );
  };

  const renderRelevantHookItem = (relevantHook: RelevantAssistantHook) => {
    const hook = relevantHook.hook;
    const isSupportedByCurrentAgent = hook ? isHookSupportedByBackend(hook, editAgent) : true;
    const isSelectedButIncompatible = incompatibleHookNameSet.has(relevantHook.name);

    return (
      <div key={relevantHook.name} className='flex items-start gap-8px rounded-4px p-8px hover:bg-fill-1'>
        <Checkbox
          checked={selectedHooks.includes(relevantHook.name)}
          className='mt-2px cursor-pointer'
          onChange={() => {
            if (selectedHooks.includes(relevantHook.name)) {
              setSelectedHooks(selectedHooks.filter((item) => item !== relevantHook.name));
            } else {
              setSelectedHooks([...selectedHooks, relevantHook.name]);
            }
          }}
        />
        <div className='flex-1 min-w-0'>
          <div className='flex items-center gap-6px flex-wrap'>
            <div className='text-13px font-medium text-t-primary'>{relevantHook.name}</div>
            {hook?.isCustom ? (
              <Tag size='small' color='orange'>
                {t('settings.skillsHub.custom', { defaultValue: 'Custom' })}
              </Tag>
            ) : null}
            {hook?.executionType ? (
              <Tag size='small' color='arcoblue'>
                {hook.executionType}
              </Tag>
            ) : null}
            {hook?.category ? (
              <Tag size='small' color={HOOK_CATEGORY_COLORS[hook.category] || 'gray'}>
                {t(`settings.hookCategories.${hook.category}`, {
                  defaultValue: hook.category,
                })}
              </Tag>
            ) : null}
            {hook ? (
              (hook.runnableEvents || []).length > 0 ? (
                <Tag size='small' color='green'>
                  {t('settings.hookReadyNow', { defaultValue: 'Ready Now' })}
                </Tag>
              ) : (
                <Tag size='small' color='gray'>
                  {t('settings.hookStoredOnly', { defaultValue: 'Stored Only' })}
                </Tag>
              )
            ) : null}
            {hook?.version ? (
              <Tag size='small' color='gray'>
                v{hook.version}
              </Tag>
            ) : null}
            {!isSupportedByCurrentAgent ? (
              <Tag size='small' color='red'>
                {t('settings.hookUnsupportedTag', { defaultValue: 'Unsupported' })}
              </Tag>
            ) : null}
          </div>
          {relevantHook.description ? (
            <div className='mt-2px line-clamp-2 text-12px text-t-secondary'>{relevantHook.description}</div>
          ) : null}
          {!hook ? (
            <div className='mt-6px text-11px text-t-tertiary'>
              {t('settings.assistantHookMissing', {
                defaultValue: 'This hook is selected but is not available in the local hook library.',
              })}
            </div>
          ) : null}
          {!isSupportedByCurrentAgent ? (
            <div className='mt-6px text-11px text-danger-6'>
              {isSelectedButIncompatible
                ? t('settings.hookSelectedButUnsupported', {
                    defaultValue:
                      'This hook is selected but will not run for the current agent. Remove it before saving.',
                  })
                : t('settings.hookUnsupportedHint', {
                    defaultValue: 'This hook does not support the current agent.',
                  })}
            </div>
          ) : null}
          {hook?.location ? (
            <div className='mt-6px break-all text-11px text-t-tertiary'>
              {t('settings.hookLocation', { defaultValue: 'Location' })}: {hook.location}
            </div>
          ) : null}
          {hook?.supportedBackends && hook.supportedBackends.length > 0 ? (
            <div className='mt-6px flex flex-wrap gap-4px'>
              <span className='text-11px text-t-tertiary'>
                {t('settings.hookSupportedBackends', {
                  defaultValue: 'Supported backends',
                })}
                :
              </span>
              {hook.supportedBackends.map((backend) => (
                <Tag key={`${hook.name}-${backend}`} size='small' color='purple'>
                  {backend}
                </Tag>
              ))}
            </div>
          ) : null}
          {hook?.outputTargets && hook.outputTargets.length > 0 ? (
            <div className='mt-6px flex flex-wrap gap-4px'>
              <span className='text-11px text-t-tertiary'>
                {t('settings.hookRoutesTo', { defaultValue: 'Routes To' })}:
              </span>
              {hook.outputTargets.map((target) => {
                const presentation = HOOK_OUTPUT_TARGET_PRESENTATION[target];
                return (
                  <Tag key={`${hook.name}-output-${target}`} size='small' color={presentation.color}>
                    {t(presentation.i18nKey, { defaultValue: presentation.defaultLabel })}
                  </Tag>
                );
              })}
            </div>
          ) : null}
          {hook?.events && hook.events.length > 0 ? (
            <div className='mt-6px flex flex-wrap gap-4px'>
              {hook.events.map((eventName) => (
                <Tag key={`${hook.name}-${eventName}`} size='small' color='green'>
                  {eventName}
                </Tag>
              ))}
            </div>
          ) : null}
        </div>
        {hook?.isCustom ? (
          <div className='flex items-center gap-4px'>
            {canConfigureHookOutputRouting(hook) ? (
              <Button
                type='outline'
                size='mini'
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenHookRouting(hook);
                }}
              >
                {t('settings.hookConfigure', { defaultValue: 'Configure' })}
              </Button>
            ) : null}
            <Button
              type='text'
              size='mini'
              icon={<Delete size={16} fill='var(--color-text-3)' />}
              onClick={(e) => {
                e.stopPropagation();
                setDeleteHookName(hook.name);
              }}
            />
          </div>
        ) : null}
      </div>
    );
  };

  const renderHookLibraryItem = (hook: HookInfo) => {
    const isSupportedByCurrentAgent = isHookSupportedByBackend(hook, editAgent);
    const isSelected = selectedHooks.includes(hook.name);
    const isSelectedButIncompatible = incompatibleHookNameSet.has(hook.name);

    return (
      <div key={hook.name} className='flex items-start gap-8px rounded-4px p-8px hover:bg-fill-1'>
        <Checkbox
          checked={isSelected}
          disabled={!isSupportedByCurrentAgent && !isSelected}
          className='mt-2px cursor-pointer'
          onChange={() => {
            if (isSelected) {
              setSelectedHooks(selectedHooks.filter((item) => item !== hook.name));
            } else {
              setSelectedHooks([...selectedHooks, hook.name]);
            }
          }}
        />
        <div className='flex-1 min-w-0'>
          <div className='flex items-center gap-6px flex-wrap'>
            <div className='text-13px font-medium text-t-primary'>{hook.name}</div>
            {hook.isCustom ? (
              <Tag size='small' color='orange'>
                {t('settings.skillsHub.custom', { defaultValue: 'Custom' })}
              </Tag>
            ) : null}
            {hook.executionType ? (
              <Tag size='small' color='arcoblue'>
                {hook.executionType}
              </Tag>
            ) : null}
            {hook.category ? (
              <Tag size='small' color={HOOK_CATEGORY_COLORS[hook.category] || 'gray'}>
                {t(`settings.hookCategories.${hook.category}`, {
                  defaultValue: hook.category,
                })}
              </Tag>
            ) : null}
            {(hook.runnableEvents || []).length > 0 ? (
              <Tag size='small' color='green'>
                {t('settings.hookReadyNow', { defaultValue: 'Ready Now' })}
              </Tag>
            ) : (
              <Tag size='small' color='gray'>
                {t('settings.hookStoredOnly', { defaultValue: 'Stored Only' })}
              </Tag>
            )}
            {hook.version ? (
              <Tag size='small' color='gray'>
                v{hook.version}
              </Tag>
            ) : null}
            {!isSupportedByCurrentAgent ? (
              <Tag size='small' color='red'>
                {t('settings.hookUnsupportedTag', { defaultValue: 'Unsupported' })}
              </Tag>
            ) : null}
          </div>
          {hook.description ? (
            <div className='mt-2px line-clamp-2 text-12px text-t-secondary'>{hook.description}</div>
          ) : null}
          {!isSupportedByCurrentAgent ? (
            <div className='mt-6px text-11px text-danger-6'>
              {isSelectedButIncompatible
                ? t('settings.hookSelectedButUnsupported', {
                    defaultValue:
                      'This hook is selected but will not run for the current agent. Remove it before saving.',
                  })
                : t('settings.hookUnsupportedHint', {
                    defaultValue: 'This hook does not support the current agent.',
                  })}
            </div>
          ) : null}
          <div className='mt-6px break-all text-11px text-t-tertiary'>
            {t('settings.hookLocation', { defaultValue: 'Location' })}: {hook.location}
          </div>
          {hook.tags && hook.tags.length > 0 ? (
            <div className='mt-6px flex flex-wrap gap-4px'>
              <span className='text-11px text-t-tertiary'>{t('settings.hookTags', { defaultValue: 'Tags' })}:</span>
              {hook.tags.map((tag) => (
                <Tag key={`${hook.name}-tag-${tag}`} size='small' color='gray'>
                  {tag}
                </Tag>
              ))}
            </div>
          ) : null}
          {hook.supportedBackends && hook.supportedBackends.length > 0 ? (
            <div className='mt-6px flex flex-wrap gap-4px'>
              <span className='text-11px text-t-tertiary'>
                {t('settings.hookSupportedBackends', {
                  defaultValue: 'Supported backends',
                })}
                :
              </span>
              {hook.supportedBackends.map((backend) => (
                <Tag key={`${hook.name}-${backend}`} size='small' color='purple'>
                  {backend}
                </Tag>
              ))}
            </div>
          ) : null}
        </div>
        {hook.isCustom ? (
          <div className='flex items-center gap-4px'>
            {canConfigureHookOutputRouting(hook) ? (
              <Button
                type='outline'
                size='mini'
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenHookRouting(hook);
                }}
              >
                {t('settings.hookConfigure', { defaultValue: 'Configure' })}
              </Button>
            ) : null}
            <Button
              type='text'
              size='mini'
              icon={<Delete size={16} fill='var(--color-text-3)' />}
              onClick={(e) => {
                e.stopPropagation();
                setDeleteHookName(hook.name);
              }}
            />
          </div>
        ) : null}
      </div>
    );
  };

  const handleOpenHookRouting = (hook: HookInfo) => {
    setConfiguringHook(hook);
    setRoutingDraft(createHookOutputRoutingDraft(hook));
  };

  const handleCloseHookRouting = () => {
    if (savingHookRouting) {
      return;
    }

    setConfiguringHook(null);
    setRoutingDraft(null);
  };

  const handleSaveHookRouting = async () => {
    if (!configuringHook || !routingDraft) {
      return;
    }

    if (routingDraft.outputTargets.length === 0) {
      Modal.error({
        title: t('settings.hookRoutingTargetsRequired', { defaultValue: 'Select at least one output target.' }),
      });
      return;
    }

    setSavingHookRouting(true);
    try {
      const result = await ipcBridge.fs.updateHookManifest.invoke({
        hookName: configuringHook.name,
        config: buildHookOutputRoutingConfig(routingDraft),
      });

      if (!result.success) {
        Modal.error({
          title: result.msg || t('settings.hookRoutingSaveFailed', { defaultValue: 'Failed to save hook routing.' }),
        });
        return;
      }

      await handleRefreshHooks();
      setConfiguringHook(null);
      setRoutingDraft(null);
    } catch (error) {
      console.error('Failed to update hook routing:', error);
      Modal.error({
        title: t('settings.hookRoutingSaveFailed', { defaultValue: 'Failed to save hook routing.' }),
      });
    } finally {
      setSavingHookRouting(false);
    }
  };

  const renderDialogHeader = () => (
    <div className='flex min-w-0 items-center justify-between gap-16px'>
      <div className='min-w-0'>
        <div className='text-18px font-600 text-t-primary'>
          {isCreating
            ? t('settings.createAssistant', { defaultValue: 'Create Assistant' })
            : t('settings.editAssistant', { defaultValue: 'Assistant Details' })}
        </div>
        <div className='mt-4px text-12px text-t-secondary'>
          {t('settings.assistantDetailsDialogHint', {
            defaultValue: 'Review identity, rules, skills, and hooks in one focused workspace dialog.',
          })}
        </div>
      </div>
      <div className='flex flex-wrap items-center justify-end gap-6px'>
        <Tag size='small' color='arcoblue'>
          {assistantKindLabel}
        </Tag>
        <Tag size='small' color={isReadonlyAssistant ? 'gold' : 'green'}>
          {assistantModeLabel}
        </Tag>
      </div>
    </div>
  );

  const renderSummaryCard = () => (
    <div className='flex h-full flex-col gap-16px bg-[color:color-mix(in_srgb,var(--color-bg-1)_92%,transparent)] p-20px'>
      <div className='rounded-16px border border-border-2 bg-bg-1 p-16px'>
        <div className='flex items-center gap-12px'>
          <Avatar shape='square' size={52} className='rounded-8px bg-fill-2'>
            {editAvatarImage ? (
              <img src={editAvatarImage} alt='' width={30} height={30} style={{ objectFit: 'contain' }} />
            ) : editAvatar ? (
              <span className='text-28px'>{editAvatar}</span>
            ) : (
              <Robot theme='outline' size={24} />
            )}
          </Avatar>
          <div className='min-w-0 flex-1'>
            <div className='truncate text-16px font-600 text-t-primary'>
              {editName || t('settings.assistantUntitled', { defaultValue: 'Untitled assistant' })}
            </div>
            <div className='mt-4px text-12px text-t-secondary'>
              {editDescription ||
                t('settings.assistantDescriptionPlaceholder', {
                  defaultValue: 'What can this assistant help with?',
                })}
            </div>
          </div>
        </div>
      </div>

      <div className='grid grid-cols-2 gap-10px'>
        <div className='rounded-14px border border-border-2 bg-bg-1 p-14px'>
          <div className='text-11px uppercase tracking-[0.08em] text-t-tertiary'>
            {t('settings.assistantMainAgent', { defaultValue: 'Main Agent' })}
          </div>
          <div className='mt-6px text-14px font-600 text-t-primary'>{editAgent || '--'}</div>
        </div>
        <div className='rounded-14px border border-border-2 bg-bg-1 p-14px'>
          <div className='text-11px uppercase tracking-[0.08em] text-t-tertiary'>
            {t('settings.assistantPromptMode', { defaultValue: 'Rules Mode' })}
          </div>
          <div className='mt-6px text-14px font-600 text-t-primary'>
            {promptViewMode === 'edit'
              ? t('settings.promptEdit', { defaultValue: 'Edit' })
              : t('settings.promptPreview', { defaultValue: 'Preview' })}
          </div>
        </div>
        <div className='rounded-14px border border-border-2 bg-bg-1 p-14px'>
          <div className='text-11px uppercase tracking-[0.08em] text-t-tertiary'>
            {t('settings.assistantSkills', { defaultValue: 'Skills' })}
          </div>
          <div className='mt-6px text-14px font-600 text-t-primary'>{attachedSkillCount}</div>
        </div>
        <div className='rounded-14px border border-border-2 bg-bg-1 p-14px'>
          <div className='text-11px uppercase tracking-[0.08em] text-t-tertiary'>
            {t('settings.assistantHooks', { defaultValue: 'Hooks' })}
          </div>
          <div className='mt-6px text-14px font-600 text-t-primary'>{attachedHookCount}</div>
        </div>
      </div>

      <div className='rounded-16px border border-border-2 bg-bg-1 p-16px'>
        <div className='text-13px font-600 text-t-primary'>
          {t('settings.assistantEditingGuideTitle', { defaultValue: 'What to review here' })}
        </div>
        <div className='mt-10px space-y-8px text-12px leading-relaxed text-t-secondary'>
          <div>
            {t('settings.assistantEditingGuideIdentity', {
              defaultValue: 'Identity: confirm the name, avatar, runtime, and read-only constraints first.',
            })}
          </div>
          <div>
            {t('settings.assistantEditingGuideRules', {
              defaultValue: 'Rules: edit or preview the prompt in place before changing capabilities.',
            })}
          </div>
          <div>
            {t('settings.assistantEditingGuideSkills', {
              defaultValue:
                'Skills and hooks: inspect attached capabilities here, then open previews or nested dialogs without leaving this modal.',
            })}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <ContextGoModal
      visible={editVisible}
      onCancel={() => setEditVisible(false)}
      header={{
        render: renderDialogHeader,
        showClose: true,
        className: 'px-24px pt-20px',
      }}
      footer={{
        className: 'px-24px pb-20px',
        render: () => (
          <div className='flex items-center justify-between gap-16px'>
            <div className='text-12px text-t-secondary'>
              {t('settings.assistantDialogFooterHint', {
                defaultValue: 'All assistant details, capability previews, and nested editors stay inside this dialog.',
              })}
            </div>
            <div className='flex items-center gap-8px'>
              {!isCreating && !activeAssistant?.isBuiltin && !isExtensionAssistant(activeAssistant) ? (
                <Button
                  status='danger'
                  onClick={handleDeleteClick}
                  className='rounded-[100px]'
                  style={{ backgroundColor: 'rgb(var(--danger-1))' }}
                >
                  {t('common.delete', { defaultValue: 'Delete' })}
                </Button>
              ) : null}
              <Button onClick={() => setEditVisible(false)} className='w-[100px] rounded-[100px] bg-fill-2'>
                {t('common.cancel', { defaultValue: 'Cancel' })}
              </Button>
              <Button
                type='primary'
                onClick={handleSave}
                disabled={!isCreating && isReadonlyAssistant}
                className='w-[100px] rounded-[100px]'
              >
                {isCreating
                  ? t('common.create', { defaultValue: 'Create' })
                  : t('common.save', { defaultValue: 'Save' })}
              </Button>
            </div>
          </div>
        ),
      }}
      style={{ width: 'min(1180px, calc(100vw - 32px))' }}
      contentStyle={{ padding: 0, overflow: 'hidden', maxHeight: 'calc(100vh - 96px)' }}
    >
      <div className='flex h-[min(82vh,860px)] min-h-[560px] overflow-hidden bg-fill-2'>
        <div className='hidden w-[320px] shrink-0 border-r border-border-2 xl:block'>{renderSummaryCard()}</div>
        <div className='flex min-w-0 flex-1 flex-col overflow-hidden'>
          <div className='border-b border-border-2 bg-bg-1 px-20px py-16px xl:hidden'>{renderSummaryCard()}</div>
          <div className='flex flex-1 flex-col gap-16px overflow-y-auto p-20px'>
            {/* Name & Avatar */}
            <div className='flex-shrink-0'>
              <Typography.Text bold>
                <span className='text-red-500'>*</span>{' '}
                {t('settings.assistantNameAvatar', { defaultValue: 'Name & Avatar' })}
              </Typography.Text>
              <div className='mt-10px flex items-center gap-12px'>
                {activeAssistant?.isBuiltin || isReadonlyAssistant ? (
                  <Avatar shape='square' size={40} className='bg-bg-1 rounded-4px'>
                    {editAvatarImage ? (
                      <img src={editAvatarImage} alt='' width={24} height={24} style={{ objectFit: 'contain' }} />
                    ) : editAvatar ? (
                      <span className='text-24px'>{editAvatar}</span>
                    ) : (
                      <Robot theme='outline' size={20} />
                    )}
                  </Avatar>
                ) : (
                  <EmojiPicker value={editAvatar} onChange={(emoji) => setEditAvatar(emoji)} placement='br'>
                    <div className='cursor-pointer'>
                      <Avatar
                        shape='square'
                        size={40}
                        className='bg-bg-1 rounded-4px hover:bg-fill-2 transition-colors'
                      >
                        {editAvatarImage ? (
                          <img src={editAvatarImage} alt='' width={24} height={24} style={{ objectFit: 'contain' }} />
                        ) : editAvatar ? (
                          <span className='text-24px'>{editAvatar}</span>
                        ) : (
                          <Robot theme='outline' size={20} />
                        )}
                      </Avatar>
                    </div>
                  </EmojiPicker>
                )}
                <Input
                  value={editName}
                  onChange={(value) => setEditName(value)}
                  disabled={activeAssistant?.isBuiltin || isReadonlyAssistant}
                  placeholder={t('settings.agentNamePlaceholder', { defaultValue: 'Enter a name for this agent' })}
                  className='flex-1 rounded-4px bg-bg-1'
                />
              </div>
            </div>

            {/* Description */}
            <div className='flex-shrink-0'>
              <Typography.Text bold>
                {t('settings.assistantDescription', { defaultValue: 'Assistant Description' })}
              </Typography.Text>
              <Input
                className='mt-10px rounded-4px bg-bg-1'
                value={editDescription}
                onChange={(value) => setEditDescription(value)}
                disabled={activeAssistant?.isBuiltin || isReadonlyAssistant}
                placeholder={t('settings.assistantDescriptionPlaceholder', {
                  defaultValue: 'What can this assistant help with?',
                })}
              />
            </div>

            {/* Main Agent selector */}
            <div className='flex-shrink-0'>
              <Typography.Text bold>{t('settings.assistantMainAgent', { defaultValue: 'Main Agent' })}</Typography.Text>
              <Select
                className='mt-10px w-full rounded-4px'
                value={editAgent}
                onChange={(value) => setEditAgent(value as string)}
                disabled={isReadonlyAssistant}
              >
                {[
                  { value: 'gemini', label: 'Gemini CLI' },
                  { value: 'claude', label: 'Claude Code' },
                  { value: 'codex', label: 'Codex' },
                  { value: 'opencode', label: 'OpenCode' },
                ]
                  .filter((opt) =>
                    PRODUCT_VISIBLE_PRESET_AGENT_TYPES.includes(
                      opt.value as (typeof PRODUCT_VISIBLE_PRESET_AGENT_TYPES)[number]
                    )
                  )
                  .filter((opt) => availableBackends.has(opt.value))
                  .map((opt) => (
                    <Select.Option key={opt.value} value={opt.value}>
                      {opt.label}
                    </Select.Option>
                  ))}
                {/* Extension-contributed ACP adapters */}
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

            {/* Rules / Prompt */}
            <div className='flex-shrink-0'>
              <Typography.Text bold className='flex-shrink-0'>
                {t('settings.assistantRules', { defaultValue: 'Rules' })}
              </Typography.Text>
              <div className='mt-10px border border-border-2 overflow-hidden rounded-4px' style={{ height: '300px' }}>
                {!activeAssistant?.isBuiltin && !isReadonlyAssistant && (
                  <div className='flex items-center h-36px bg-fill-2 border-b border-border-2 flex-shrink-0'>
                    <div
                      className={`flex items-center h-full px-16px cursor-pointer transition-all text-13px font-medium ${promptViewMode === 'edit' ? 'text-primary border-b-2 border-primary bg-bg-1' : 'text-t-secondary hover:text-t-primary'}`}
                      onClick={() => setPromptViewMode('edit')}
                    >
                      {t('settings.promptEdit', { defaultValue: 'Edit' })}
                    </div>
                    <div
                      className={`flex items-center h-full px-16px cursor-pointer transition-all text-13px font-medium ${promptViewMode === 'preview' ? 'text-primary border-b-2 border-primary bg-bg-1' : 'text-t-secondary hover:text-t-primary'}`}
                      onClick={() => setPromptViewMode('preview')}
                    >
                      {t('settings.promptPreview', { defaultValue: 'Preview' })}
                    </div>
                  </div>
                )}
                <div
                  className='bg-fill-2'
                  style={{
                    height: activeAssistant?.isBuiltin || isReadonlyAssistant ? '100%' : 'calc(100% - 36px)',
                    overflow: 'auto',
                  }}
                >
                  {promptViewMode === 'edit' && !activeAssistant?.isBuiltin && !isReadonlyAssistant ? (
                    <div ref={textareaWrapperRef} className='h-full'>
                      <Input.TextArea
                        value={editContext}
                        onChange={(value) => setEditContext(value)}
                        placeholder={t('settings.assistantRulesPlaceholder', {
                          defaultValue: 'Enter rules in Markdown format...',
                        })}
                        autoSize={false}
                        className='border-none rounded-none bg-transparent h-full resize-none'
                      />
                    </div>
                  ) : (
                    <div className='p-16px'>
                      {editContext ? (
                        <MarkdownView hiddenCodeCopyButton>{editContext}</MarkdownView>
                      ) : (
                        <div className='text-t-secondary text-center py-32px'>
                          {t('settings.promptPreviewEmpty', { defaultValue: 'No content to preview' })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Skills section */}
            {showSkills && (
              <div className='flex-shrink-0 mt-16px'>
                <div className='flex items-center justify-between mb-12px'>
                  <Typography.Text bold>{t('settings.assistantSkills', { defaultValue: 'Skills' })}</Typography.Text>
                  {activeAssistant?.isBuiltin ? null : (
                    <Button
                      size='small'
                      type='outline'
                      icon={<Plus size={14} />}
                      onClick={() => setSkillsModalVisible(true)}
                      className='rounded-[100px]'
                    >
                      {t('settings.addSkills', { defaultValue: 'Add Skills' })}
                    </Button>
                  )}
                </div>

                <Collapse defaultActiveKey={['attached-skills']}>
                  <Collapse.Item
                    header={
                      <span className='text-13px font-medium'>
                        {t('settings.assistantAttachedSkills', { defaultValue: 'Attached Skills' })}
                      </span>
                    }
                    name='attached-skills'
                    className='mb-8px'
                    extra={<span className='text-12px text-t-secondary'>{relevantSkills.length}</span>}
                  >
                    {relevantSkills.length > 0 ? (
                      <div className='space-y-4px'>{relevantSkills.map((skill) => renderRelevantSkillItem(skill))}</div>
                    ) : (
                      <div className='text-center text-t-secondary text-12px py-16px'>
                        {t('settings.noAttachedSkills', { defaultValue: 'No skills attached to this assistant' })}
                      </div>
                    )}
                  </Collapse.Item>
                </Collapse>
              </div>
            )}

            {/* Hooks section */}
            <div className='flex-shrink-0 mt-16px'>
              <div className='flex items-center justify-between mb-12px'>
                <Typography.Text bold>{t('settings.assistantHooks', { defaultValue: 'Hooks' })}</Typography.Text>
                <div className='flex items-center gap-8px'>
                  <Button
                    size='mini'
                    type='outline'
                    icon={<Plus size={14} />}
                    onClick={() => setHookLibraryVisible(true)}
                  >
                    {t('settings.addHook', { defaultValue: 'Add Hook' })}
                  </Button>
                  <Button
                    size='mini'
                    type='outline'
                    icon={<Refresh size={14} className={hooksLoading ? 'animate-spin' : ''} />}
                    onClick={() => void handleRefreshHooks()}
                  >
                    {t('common.refresh', { defaultValue: 'Refresh' })}
                  </Button>
                  <Button size='mini' type='outline' icon={<Plus size={14} />} onClick={() => void handleImportHook()}>
                    {t('settings.importHook', { defaultValue: 'Import Hook' })}
                  </Button>
                  <Button
                    size='mini'
                    type='outline'
                    icon={<FolderOpen size={14} />}
                    onClick={() => void handleOpenHooksDir()}
                  >
                    {t('settings.openHookFolder', { defaultValue: 'Open Folder' })}
                  </Button>
                </div>
              </div>
              <Typography.Text type='secondary' className='block text-12px'>
                {t('settings.assistantHooksHint', {
                  defaultValue:
                    'ContextGo currently runs prompt-transform hooks on before_user_prompt. Builtin hooks also package reusable patterns for planning, safety, quality, continuity, and operator handoff.',
                })}
              </Typography.Text>
              <div className='mt-8px rounded-8px bg-bg-1 p-10px'>
                <Typography.Text type='secondary' className='text-12px'>
                  {t('settings.hookStoragePath', { defaultValue: 'Hook storage path' })}
                </Typography.Text>
                <div className='mt-4px break-all text-12px text-t-primary'>{hooksDir || '-'}</div>
              </div>

              <Collapse defaultActiveKey={['available-hooks']}>
                <Collapse.Item
                  header={
                    <span className='text-13px font-medium'>
                      {t('settings.assistantAttachedHooks', { defaultValue: 'Attached Hooks' })}
                    </span>
                  }
                  name='available-hooks'
                  extra={<span className='text-12px text-t-secondary'>{relevantHooks.length}</span>}
                >
                  {relevantHooks.length > 0 ? (
                    <div className='space-y-4px'>{relevantHooks.map((hook) => renderRelevantHookItem(hook))}</div>
                  ) : (
                    <div className='text-center text-t-secondary text-12px py-16px'>
                      {t('settings.noAttachedHooks', { defaultValue: 'No hooks attached to this assistant' })}
                    </div>
                  )}
                </Collapse.Item>
              </Collapse>
            </div>
          </div>
        </div>
      </div>
      <ContextGoModal
        visible={previewingSkill !== null}
        onCancel={handleCloseSkillPreview}
        header={{
          title: t('settings.assistantSkillPreviewTitle', { defaultValue: 'Skill Preview' }),
          showClose: true,
          className: 'px-24px pt-20px',
        }}
        footer={{
          className: 'px-24px pb-20px',
          render: () => (
            <div className='flex justify-end gap-10px pt-4px'>
              <Button onClick={handleCloseSkillPreview} className='min-w-88px px-18px' disabled={skillPreviewLoading}>
                {t('common.close', { defaultValue: 'Close' })}
              </Button>
            </div>
          ),
        }}
        style={{ width: 'min(760px, calc(100vw - 32px))' }}
        contentStyle={{ padding: '12px 24px 24px' }}
      >
        {skillPreviewLoading ? (
          <div className='py-24px text-center text-12px text-t-secondary'>
            {t('common.loading', { defaultValue: 'Please wait...' })}
          </div>
        ) : (
          <div className='space-y-12px'>
            {previewDocument ? (
              <div className='rounded-16px border border-border-2 bg-fill-1 p-16px'>
                <div className='flex items-start justify-between gap-12px'>
                  <div className='min-w-0 flex-1'>
                    <div className='break-all text-16px font-600 text-t-primary'>{previewDocument.title}</div>
                    {previewDocument.description ? (
                      <div className='mt-6px text-13px leading-relaxed text-t-secondary'>
                        {previewDocument.description}
                      </div>
                    ) : null}
                  </div>
                  <div className='flex flex-wrap justify-end gap-6px'>
                    {previewingSkill?.hiddenFromSkillsLibrary ? (
                      <Tag size='small' color='arcoblue'>
                        {t('settings.assistantSkillPackageTag', { defaultValue: 'Packaged' })}
                      </Tag>
                    ) : null}
                    {previewingSkill?.isCustom ? (
                      <Tag size='small' color='orange'>
                        {t('settings.skillsHub.custom', { defaultValue: 'Custom' })}
                      </Tag>
                    ) : null}
                  </div>
                </div>
                {previewingSkill?.location ? (
                  <div className='mt-10px break-all text-11px text-t-tertiary'>
                    {t('settings.skillLocation', { defaultValue: 'Location' })}: {previewingSkill.location}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className='rounded-16px border border-border-2 bg-bg-1 p-16px'>
              <div className='mb-10px text-11px font-600 uppercase tracking-[0.08em] text-t-tertiary'>
                {t('settings.assistantSkillPreviewBody', { defaultValue: 'Skill Body' })}
              </div>
              <div className='max-h-[min(58vh,620px)] overflow-y-auto'>
                {previewDocument?.body ? (
                  <MarkdownView hiddenCodeCopyButton>{previewDocument.body}</MarkdownView>
                ) : (
                  <div className='py-16px text-center text-12px text-t-secondary'>
                    {t('settings.promptPreviewEmpty', { defaultValue: 'No content to preview' })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </ContextGoModal>
      <ContextGoModal
        visible={deleteHookName !== null}
        onCancel={() => setDeleteHookName(null)}
        header={{
          title: t('settings.deleteHookTitle', { defaultValue: 'Delete Hook' }),
          showClose: true,
          className: 'px-24px pt-20px',
        }}
        footer={{
          className: 'px-24px pb-20px',
          render: () => (
            <div className='flex justify-end gap-10px pt-4px'>
              <Button onClick={() => setDeleteHookName(null)} className='min-w-88px px-18px'>
                {t('common.cancel', { defaultValue: 'Cancel' })}
              </Button>
              <Button
                type='primary'
                status='danger'
                onClick={() => void handleDeleteHookConfirm()}
                className='min-w-104px px-18px'
              >
                {t('common.delete', { defaultValue: 'Delete' })}
              </Button>
            </div>
          ),
        }}
        style={{ width: 'min(460px, calc(100vw - 32px))' }}
        contentStyle={{ padding: '12px 24px 24px' }}
      >
        <Typography.Text className='text-14px leading-6 text-t-secondary'>
          {t('settings.deleteHookConfirm', {
            name: deleteHookName || '',
            defaultValue: 'Are you sure you want to delete "{{name}}"? This action cannot be undone.',
          })}
        </Typography.Text>
      </ContextGoModal>
      <HookRoutingConfigModal
        visible={configuringHook !== null && routingDraft !== null}
        hook={configuringHook}
        draft={routingDraft}
        saving={savingHookRouting}
        onCancel={handleCloseHookRouting}
        onSave={() => void handleSaveHookRouting()}
        onDraftChange={setRoutingDraft}
      />
      <ContextGoModal
        visible={hookLibraryVisible}
        onCancel={() => setHookLibraryVisible(false)}
        header={{
          title: t('settings.hookLibrary', { defaultValue: 'Hook Library' }),
          showClose: true,
          className: 'px-24px pt-20px',
        }}
        footer={{
          className: 'px-24px pb-20px',
          render: () => (
            <div className='flex justify-end gap-10px pt-4px'>
              <Button onClick={() => setHookLibraryVisible(false)} className='min-w-88px px-18px'>
                {t('common.close', { defaultValue: 'Close' })}
              </Button>
            </div>
          ),
        }}
        style={{ width: 'min(760px, calc(100vw - 32px))' }}
        contentStyle={{ padding: '12px 24px 24px' }}
      >
        <Typography.Text type='secondary' className='mb-12px block text-12px'>
          {t('settings.hookLibraryHint', {
            defaultValue:
              'Choose which hooks to attach to this assistant. Unattached hooks stay in the library but stay hidden from the main assistant details.',
          })}
        </Typography.Text>
        {availableHooks.length > 0 ? (
          <div className='max-h-[60vh] space-y-4px overflow-y-auto'>
            {availableHooks.map((hook) => renderHookLibraryItem(hook))}
          </div>
        ) : (
          <div className='py-16px text-center text-12px text-t-secondary'>
            {t('settings.noAvailableHooks', { defaultValue: 'No hooks found in the hook directory' })}
          </div>
        )}
      </ContextGoModal>
    </ContextGoModal>
  );
};

export default AssistantEditDrawer;
