import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const connectClientSource = readFileSync('apps/web/src/app/[lang]/connect/ConnectClient.tsx', 'utf8');

describe('ConnectClient source', () => {
  it('keeps the connector story block wired into the page', () => {
    expect(connectClientSource).toContain('dict.connect.connector_story_label');
    expect(connectClientSource).toContain('dict.connect.connector_story_title');
    expect(connectClientSource).toContain('dict.connect.connector_story_body');
  });

  it('does not reference the deprecated connectors overview image asset', () => {
    expect(connectClientSource).not.toContain('/site/connectors-overview.png');
  });
});
