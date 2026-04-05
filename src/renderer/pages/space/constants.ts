import type { SpaceShellView } from './types';

export const DEFAULT_SPACE_SHELL_VIEW: SpaceShellView = 'canvas';

export const SPACE_SHELL_VIEW_KEYS = [
  'overview',
  'docs',
  'canvas',
  'context',
  'runs',
  'members',
  'settings',
] as const satisfies readonly SpaceShellView[];

export const SPACE_SHELL_VIEWS: ReadonlyArray<{
  key: SpaceShellView;
  labelKey: `space.views.${SpaceShellView}`;
}> = SPACE_SHELL_VIEW_KEYS.map((key) => ({
  key,
  labelKey: `space.views.${key}`,
}));

export const resolveSpaceShellView = (value?: string | null): SpaceShellView => {
  if (value && SPACE_SHELL_VIEW_KEYS.includes(value as SpaceShellView)) {
    return value as SpaceShellView;
  }

  return DEFAULT_SPACE_SHELL_VIEW;
};
