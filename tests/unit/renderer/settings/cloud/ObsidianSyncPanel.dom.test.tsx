import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

vi.mock('@arco-design/web-react', () => ({
  Alert: ({ content }: { content?: React.ReactNode }) => <div>{content}</div>,
  Tag: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  Typography: {
    Paragraph: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  },
}));

import type { CloudObsidianVaultBinding } from '@/common/types/cloud';
import ObsidianSyncPanel from '@/renderer/components/settings/SettingsModal/contents/SystemModalContent/ObsidianSyncPanel';

describe('ObsidianSyncPanel', () => {
  it('renders obsidian vault binding with replica health and risk flags', () => {
    const binding: CloudObsidianVaultBinding = {
      vaultBindingId: 'vault_space_1',
      spaceId: 'space_1',
      riskLevel: 'external-sync-risk',
      replicas: [
        { replicaId: 'desktop_a', platform: 'desktop', healthStatus: 'ok' },
        { replicaId: 'mobile_a', platform: 'mobile', healthStatus: 'ok' },
      ],
    };

    render(<ObsidianSyncPanel binding={binding} />);

    expect(screen.getByText('vault_space_1')).toBeInTheDocument();
    expect(screen.getByText('desktop_a')).toBeInTheDocument();
    expect(screen.getByText('mobile_a')).toBeInTheDocument();
    expect(screen.getByText('external-sync-risk')).toBeInTheDocument();
  });

  it('renders android mobile replica draft readiness details', () => {
    const binding: CloudObsidianVaultBinding = {
      vaultBindingId: 'vault_space_1',
      spaceId: 'space_1',
      riskLevel: 'normal',
      replicas: [
        {
          replicaId: 'android_replica_1',
          platform: 'mobile',
          healthStatus: 'warn',
          localReadyState: 'prepared-directory',
          landingNotePath: 'Home.md',
          localDirectoryUri: 'content://root/contextgo/team-space',
        },
      ],
    };

    render(<ObsidianSyncPanel binding={binding} />);

    expect(screen.getByText('android_replica_1')).toBeInTheDocument();
    expect(screen.getByText('prepared-directory')).toBeInTheDocument();
    expect(screen.getByText('Home.md')).toBeInTheDocument();
    expect(screen.getByText('content://root/contextgo/team-space')).toBeInTheDocument();
  });
});
