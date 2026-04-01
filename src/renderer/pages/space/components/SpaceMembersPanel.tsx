import { Avatar, Button, Card, Empty, Input, List, Popconfirm, Select, Space, Tag, Typography } from '@arco-design/web-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useEffect, useMemo, useState } from 'react';
import type {
  SpaceCapability,
  SpaceMember,
  SpaceMemberRole,
  SpacePermissionsPolicy,
  SpaceProviderPermissionRole,
} from '@/common/config/storage';

const { Paragraph, Text } = Typography;

type SpaceMembersPanelProps = {
  members: readonly SpaceMember[];
  permissionsPolicy: SpacePermissionsPolicy;
  onChange: (members: readonly SpaceMember[], permissionsPolicy: SpacePermissionsPolicy) => Promise<void>;
};

const ROLE_ORDER: readonly SpaceMemberRole[] = ['owner', 'admin', 'editor', 'reviewer', 'viewer'];
const CAPABILITY_KEYS = [
  'contentEdit',
  'agentRun',
  'memoryReview',
  'memberManage',
  'viewOnly',
  'workflowReuse',
] as const;

export const DEFAULT_ROLE_CAPABILITIES: Record<SpaceMemberRole, SpaceCapability[]> = {
  owner: ['content.edit', 'agent.run', 'memory.review', 'members.manage', 'context.view', 'workflow.reuse'],
  admin: ['content.edit', 'agent.run', 'memory.review', 'members.manage', 'context.view', 'workflow.reuse'],
  editor: ['content.edit', 'agent.run', 'context.view', 'workflow.reuse'],
  reviewer: ['content.edit', 'agent.run', 'memory.review', 'context.view', 'workflow.reuse'],
  viewer: ['context.view'],
};

const DEFAULT_PROVIDER_ROLE_BINDINGS: NonNullable<SpacePermissionsPolicy['providerRoleBindings']> = {
  owner: { affine: 'owner' },
  admin: { affine: 'admin' },
  editor: { affine: 'editor' },
  reviewer: { affine: 'editor' },
  viewer: { affine: 'viewer' },
};

const PROVIDER_ROLE_OPTIONS: readonly SpaceProviderPermissionRole[] = ['owner', 'admin', 'editor', 'viewer'];

export default function SpaceMembersPanel(props: SpaceMembersPanelProps) {
  const { t } = useTranslation();
  const [draftMembers, setDraftMembers] = useState<SpaceMember[]>([...props.members]);
  const [draftPolicy, setDraftPolicy] = useState<SpacePermissionsPolicy>(props.permissionsPolicy);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberSecondary, setNewMemberSecondary] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<SpaceMemberRole>('viewer');
  const [saving, setSaving] = useState(false);

  const roleCapabilities = useMemo(() => {
    return draftPolicy.roleCapabilities ?? DEFAULT_ROLE_CAPABILITIES;
  }, [draftPolicy.roleCapabilities]);
  const providerRoleBindings = useMemo(() => {
    return draftPolicy.providerRoleBindings ?? DEFAULT_PROVIDER_ROLE_BINDINGS;
  }, [draftPolicy.providerRoleBindings]);

  useEffect(() => {
    setDraftMembers([...props.members]);
  }, [props.members]);

  useEffect(() => {
    setDraftPolicy(props.permissionsPolicy);
  }, [props.permissionsPolicy]);

  const persist = async (nextMembers: SpaceMember[], nextPolicy: SpacePermissionsPolicy) => {
    setSaving(true);
    try {
      await props.onChange(nextMembers, nextPolicy);
      setDraftMembers(nextMembers);
      setDraftPolicy(nextPolicy);
    } finally {
      setSaving(false);
    }
  };

  const handleAddMember = async () => {
    const trimmedName = newMemberName.trim();
    if (!trimmedName) {
      return;
    }

    const now = Date.now();
    const nextMembers = [
      ...draftMembers,
      {
        id: `member-${now.toString(36)}`,
        displayName: trimmedName,
        secondaryText: newMemberSecondary.trim() || undefined,
        role: newMemberRole,
        status: 'active' as const,
        createTime: now,
        modifyTime: now,
      },
    ];

    await persist(nextMembers, draftPolicy);
    setNewMemberName('');
    setNewMemberSecondary('');
    setNewMemberRole('viewer');
  };

  const handleRoleChange = async (memberId: string, role: SpaceMemberRole) => {
    const nextMembers = draftMembers.map((member) =>
      member.id === memberId ? { ...member, role, modifyTime: Date.now() } : member
    );
    await persist(nextMembers, draftPolicy);
  };

  const handleRemoveMember = async (memberId: string) => {
    const nextMembers = draftMembers.filter((member) => member.id !== memberId);
    await persist(nextMembers, draftPolicy);
  };

  const toggleCapability = async (role: SpaceMemberRole, capability: SpaceCapability) => {
    const current = new Set(roleCapabilities[role] ?? []);
    if (current.has(capability)) {
      current.delete(capability);
    } else {
      current.add(capability);
    }

    const nextPolicy: SpacePermissionsPolicy = {
      ...draftPolicy,
      roleCapabilities: {
        ...roleCapabilities,
        [role]: [...current],
      },
      providerRoleBindings,
    };
    await persist(draftMembers, nextPolicy);
  };

  const updateProviderBinding = async (role: SpaceMemberRole, providerRole: SpaceProviderPermissionRole) => {
    const nextPolicy: SpacePermissionsPolicy = {
      ...draftPolicy,
      roleCapabilities,
      providerRoleBindings: {
        ...providerRoleBindings,
        [role]: {
          affine: providerRole,
        },
      },
    };
    await persist(draftMembers, nextPolicy);
  };

  return (
    <div className='grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]'>
      <Card size='small' title={t('space.members.currentTitle')}>
        <Space direction='vertical' size='small' className='w-full'>
          <Paragraph className='mb-0 text-13px text-t-secondary'>{t('space.members.viewDescription')}</Paragraph>
          <Space wrap>
            <Input
              value={newMemberName}
              onChange={setNewMemberName}
              placeholder={t('space.members.form.displayName')}
              style={{ width: 180 }}
            />
            <Input
              value={newMemberSecondary}
              onChange={setNewMemberSecondary}
              placeholder={t('space.members.form.secondaryText')}
              style={{ width: 220 }}
            />
            <Select value={newMemberRole} onChange={(value) => setNewMemberRole(value as SpaceMemberRole)} style={{ width: 140 }}>
              {ROLE_ORDER.map((role) => (
                <Select.Option key={role} value={role}>
                  {t(`space.members.roles.${role}.label`)}
                </Select.Option>
              ))}
            </Select>
            <Button size='small' type='primary' loading={saving} onClick={() => void handleAddMember()}>
              {t('space.members.actions.invite')}
            </Button>
          </Space>
          {draftMembers.length === 0 ? (
            <Empty description={t('space.members.currentEmpty')} />
          ) : (
            <List
              dataSource={[...draftMembers]}
              render={(member) => (
                <List.Item key={member.id}>
                  <Space className='w-full justify-between'>
                    <Space align='center'>
                      <Avatar size={36}>
                        {member.avatarUrl ? <img src={member.avatarUrl} alt={member.displayName} /> : member.displayName[0]}
                      </Avatar>
                      <Space direction='vertical' size={2}>
                        <Text>{member.displayName}</Text>
                        <Text type='secondary'>{member.secondaryText}</Text>
                      </Space>
                    </Space>
                    <Space direction='vertical' size={2} align='end'>
                      <Select
                        size='mini'
                        value={member.role}
                        style={{ width: 140 }}
                        onChange={(value) => void handleRoleChange(member.id, value as SpaceMemberRole)}
                      >
                        {ROLE_ORDER.map((role) => (
                          <Select.Option key={role} value={role}>
                            {t(`space.members.roles.${role}.label`)}
                          </Select.Option>
                        ))}
                      </Select>
                      <Text type='secondary'>
                        {t('space.members.currentRole')} · {t(`space.members.status.${member.status}`)}
                      </Text>
                      <Popconfirm title={t('common.confirmDelete')} onOk={() => void handleRemoveMember(member.id)}>
                        <Button size='mini' status='danger' loading={saving}>
                          {t('common.remove')}
                        </Button>
                      </Popconfirm>
                    </Space>
                  </Space>
                </List.Item>
              )}
            />
          )}
        </Space>
      </Card>

      <div className='flex flex-col gap-4'>
        <Card size='small' title={t('space.members.roleModelTitle')}>
          <Space direction='vertical' size='small' className='w-full'>
            <Paragraph className='mb-0 text-13px text-t-secondary'>{t('space.members.roleModelDescription')}</Paragraph>
            {ROLE_ORDER.map((role) => (
              <div key={role} className='rounded-12px bg-[var(--color-fill-1)] px-12px py-10px'>
                <Text className='text-13px font-600 text-t-primary'>{t(`space.members.roles.${role}.label`)}</Text>
                <Paragraph className='mb-0 mt-4px text-12px text-t-secondary'>
                  {t(`space.members.roles.${role}.description`)}
                </Paragraph>
              </div>
            ))}
          </Space>
        </Card>

        <Card size='small' title={t('space.members.permissionsTitle')}>
          <Space direction='vertical' size='small' className='w-full'>
            {ROLE_ORDER.map((role) => (
              <div key={role} className='rounded-12px bg-[var(--color-fill-1)] px-12px py-10px'>
                <Space align='center' className='w-full justify-between'>
                  <Text className='text-13px font-600 text-t-primary'>{t(`space.members.roles.${role}.label`)}</Text>
                  <Select
                    size='mini'
                    value={providerRoleBindings[role]?.affine ?? 'viewer'}
                    style={{ width: 148 }}
                    onChange={(value) => void updateProviderBinding(role, value as SpaceProviderPermissionRole)}
                  >
                    {PROVIDER_ROLE_OPTIONS.map((providerRole) => (
                      <Select.Option key={`${role}-${providerRole}`} value={providerRole}>
                        {`Canvas · ${providerRole}`}
                      </Select.Option>
                    ))}
                  </Select>
                </Space>
                <Space wrap size={8} className='mt-8px'>
                  {CAPABILITY_KEYS.map((capability) => {
                    const enabled = (roleCapabilities[role] ?? []).includes(capability as SpaceCapability);
                    return (
                      <Tag
                        key={`${role}-${capability}`}
                        color={enabled ? 'arcoblue' : 'gray'}
                        className='cursor-pointer'
                        onClick={() => void toggleCapability(role, capability as SpaceCapability)}
                      >
                        {t(`space.members.capabilities.${capability}`)}
                      </Tag>
                    );
                  })}
                </Space>
              </div>
            ))}
          </Space>
        </Card>
      </div>
    </div>
  );
}
