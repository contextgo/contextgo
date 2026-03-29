import { describe, expect, it } from 'vitest';
import {
  convertHtmlToSlackMrkdwn,
  SLACK_ACTION_ID_PREFIX,
  toSlackSendParams,
  toUnifiedActionMessage,
  toUnifiedIncomingMessage,
} from '@process/channels/plugins/slack/SlackAdapter';

describe('SlackAdapter', () => {
  it('converts html to Slack mrkdwn', () => {
    expect(convertHtmlToSlackMrkdwn('<b>Hello</b><br><code>world</code>')).toBe('*Hello*\n`world`');
  });

  it('normalizes incoming mention messages', () => {
    const message = toUnifiedIncomingMessage(
      {
        ts: '1740000000.123456',
        text: '<@U_BOT> hello there',
        user: 'U_USER',
        channel: 'C123',
      },
      'U_BOT'
    );

    expect(message).not.toBeNull();
    expect(message?.platform).toBe('slack');
    expect(message?.chatId).toBe('C123');
    expect(message?.content.text).toBe('hello there');
  });

  it('parses Slack interactive button payloads into actions', () => {
    const message = toUnifiedActionMessage({
      user: { id: 'U_USER', username: 'alice', name: 'Alice' },
      channel: { id: 'C123', name: 'general' },
      message: { ts: '1740000000.123456' },
      actions: [
        {
          value: JSON.stringify({
            action: 'agent.select',
            params: { agentKey: 'gemini' },
          }),
        },
      ],
      trigger_id: 'trigger-1',
    });

    expect(message).not.toBeNull();
    expect(message?.action?.name).toBe('agent.select');
    expect(message?.action?.type).toBe('system');
    expect(message?.action?.params).toEqual({ agentKey: 'gemini' });
  });

  it('serializes buttons into Slack blocks with action ids', () => {
    const params = toSlackSendParams({
      type: 'text',
      text: '<b>Hello</b>',
      buttons: [[{ label: 'Refresh', action: 'pairing.refresh' }]],
    });

    expect(params.text).toBe('*Hello*');
    expect(params.blocks).toBeDefined();
    const actionBlock = params.blocks?.find((block) => block.type === 'actions');
    expect(actionBlock).toBeDefined();
    expect(JSON.stringify(actionBlock)).toContain(SLACK_ACTION_ID_PREFIX);
    expect(JSON.stringify(actionBlock)).toContain('pairing.refresh');
  });
});
