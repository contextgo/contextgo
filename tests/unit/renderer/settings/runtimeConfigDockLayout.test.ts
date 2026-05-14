import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const runtimeConfigDockSource = readFileSync(
  resolve(process.cwd(), 'src/renderer/pages/settings/components/RuntimeConfigDock.tsx'),
  'utf8'
);
const settingsPageWrapperSource = readFileSync(
  resolve(process.cwd(), 'src/renderer/pages/settings/components/SettingsPageWrapper.tsx'),
  'utf8'
);
const settingsSideDockSource = readFileSync(
  resolve(process.cwd(), 'src/renderer/pages/settings/components/SettingsSideDock.tsx'),
  'utf8'
);
const textEditorSource = readFileSync(
  resolve(process.cwd(), 'src/renderer/pages/conversation/Preview/components/editors/TextEditor.tsx'),
  'utf8'
);

const settingsCss = readFileSync(resolve(process.cwd(), 'src/renderer/pages/settings/components/settings.css'), 'utf8');

describe('RuntimeConfigDock layout contract', () => {
  it('reuses a shared settings side dock shell for preview and runtime config panels', () => {
    expect(runtimeConfigDockSource).toContain("from './SettingsSideDock'");
    expect(runtimeConfigDockSource).toContain('<SettingsSideDock');
    expect(settingsPageWrapperSource).toContain("from './SettingsSideDock'");
    expect(settingsPageWrapperSource).toContain('<SettingsSideDock');

    expect(settingsCss).toMatch(/\.settings-side-dock\s*{/s);
    expect(settingsCss).toMatch(/\.settings-side-dock__panel\s*{/s);
    expect(settingsCss).toMatch(/\.settings-side-dock--preview\s*{/s);
    expect(settingsCss).toMatch(/\.settings-side-dock--runtime-config\s*{/s);
  });

  it('keeps the dock content in a dedicated height-bound slot so message context does not break scrolling', () => {
    expect(settingsSideDockSource).toContain("className='settings-side-dock__content'");
    expect(settingsCss).toMatch(/\.settings-side-dock__content\s*{[^}]*height:\s*100%;/s);
    expect(runtimeConfigDockSource).toMatch(/<>\s*\{messageContext\}\s*<SettingsSideDock/s);
  });

  it('enables json editor support for runtime config entries that are json files or json payloads', () => {
    expect(textEditorSource).toMatch(/language\?:\s*string;/);
    expect(textEditorSource).toMatch(/extensions=\{editorExtensions\}/);
    expect(runtimeConfigDockSource).toMatch(/getEditorLanguage\s*=\s*\(/);
    expect(runtimeConfigDockSource).toMatch(/looksLikeJson\s*=\s*\(/);
    expect(runtimeConfigDockSource).toMatch(/fileName\.endsWith\('\.json'\)/);
    expect(runtimeConfigDockSource).toMatch(/<TextEditor[^>]*language=\{getEditorLanguage\(draft\)\}/s);
  });

  it('wraps header actions instead of squeezing title copy into a narrow column', () => {
    expect(runtimeConfigDockSource).toContain("className='settings-runtime-config-dock__actions'");
    expect(runtimeConfigDockSource).toContain("data-testid='runtime-config-dock-actions'");
    expect(runtimeConfigDockSource).toMatch(/<Space\s+wrap>/);

    expect(settingsCss).toMatch(/\.settings-runtime-config-dock__header\s*{[^}]*flex-wrap:\s*wrap;/s);
    expect(settingsCss).toMatch(/\.settings-runtime-config-dock__title-block\s*{[^}]*flex:\s*1 1 220px;/s);
    expect(settingsCss).toMatch(/\.settings-runtime-config-dock__actions\s*{[^}]*margin-left:\s*auto;/s);
    expect(settingsCss).toMatch(/\.settings-runtime-config-dock__actions\s+\.arco-space\s*{[^}]*flex-wrap:\s*wrap;/s);
  });

  it('tightens action alignment for smaller dock widths', () => {
    expect(settingsCss).toMatch(/@media\s*\(max-width:\s*640px\)\s*{[^}]*\.settings-runtime-config-dock__header/s);
    expect(settingsCss).toMatch(
      /@media\s*\(max-width:\s*640px\)\s*{[\s\S]*\.settings-runtime-config-dock__actions\s*{[^}]*width:\s*100%;/s
    );
    expect(settingsCss).toMatch(
      /@media\s*\(max-width:\s*640px\)\s*{[\s\S]*\.settings-runtime-config-dock__actions\s+\.arco-space\s*{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/s
    );
    expect(settingsCss).toMatch(
      /@media\s*\(max-width:\s*420px\)\s*{[\s\S]*\.settings-runtime-config-dock__actions\s+\.arco-space\s*{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/s
    );
  });
});
