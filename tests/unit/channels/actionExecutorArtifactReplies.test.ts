import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { IMessageText } from '../../../src/common/chat/chatLib';
import {
  buildChannelArtifactReply,
  extractArtifactReplyCandidateFromMessage,
} from '../../../src/process/channels/gateway/ActionExecutor';
import type { IAgentProfile } from '../../../src/process/channels/types';

const tempDirs: string[] = [];

const createTempFile = (fileName: string, content = 'doc'): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'contextgo-artifact-reply-'));
  tempDirs.push(dir);
  const filePath = path.join(dir, fileName);
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
};

const buildTextMessage = (content: string): IMessageText => ({
  id: 'msg-1',
  conversation_id: 'conv-1',
  type: 'text',
  content: { content },
});

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('ActionExecutor artifact replies', () => {
  it('extracts a local file artifact candidate from a file-written text message', () => {
    const filePath = createTempFile('report.docx');

    const candidate = extractArtifactReplyCandidateFromMessage(
      buildTextMessage(`📝 **File written:** \`${filePath}\`\n\n\`\`\`\npreview\n\`\`\``)
    );

    expect(candidate).toEqual({
      filePath,
      fileName: 'report.docx',
    });
  });

  it('builds a file outgoing reply for weixin when the profile allows file replies', () => {
    const filePath = createTempFile('proof.docx');
    const profile: IAgentProfile = {
      id: 'agent-1',
      name: 'Office Agent',
      backend: 'codex',
      channelReplyPolicy: {
        capabilities: ['text', 'file'],
        fallbackMode: 'text_path',
      },
      version: 1,
      archived: false,
      createdAt: 1,
      updatedAt: 1,
    };

    const outgoing = buildChannelArtifactReply(
      buildTextMessage(`📝 **File written:** \`${filePath}\`\n\n\`\`\`\npreview\n\`\`\``),
      'weixin',
      profile
    );

    expect(outgoing).toEqual(
      expect.objectContaining({
        type: 'file',
        fileUrl: filePath,
        fileName: 'proof.docx',
      })
    );
  });

  it('falls back to normal text handling when the platform does not support file replies yet', () => {
    const filePath = createTempFile('proof.docx');
    const profile: IAgentProfile = {
      id: 'agent-1',
      name: 'Office Agent',
      backend: 'codex',
      channelReplyPolicy: {
        capabilities: ['text', 'file'],
        fallbackMode: 'text_path',
      },
      version: 1,
      archived: false,
      createdAt: 1,
      updatedAt: 1,
    };

    const outgoing = buildChannelArtifactReply(
      buildTextMessage(`📝 **File written:** \`${filePath}\`\n\n\`\`\`\npreview\n\`\`\``),
      'telegram',
      profile
    );

    expect(outgoing).toBeNull();
  });
});
