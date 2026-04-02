/**
 * Vitest Test Setup
 * Global configuration for extension system tests
 */

// Register NodePlatformServices so modules that call getPlatformServices() work in tests.
import { registerPlatformServices } from '../src/common/platform';
import { NodePlatformServices } from '../src/common/platform/NodePlatformServices';
registerPlatformServices(new NodePlatformServices());

// Make this a module

// Extend global types for testing
declare global {
  // eslint-disable-next-line no-var
  var electronAPI: any;
}

const noop = () => Promise.resolve();

const sqliteExperimentalWarningPattern = /SQLite is an experimental feature/i;
const originalEmitWarning = process.emitWarning.bind(process);

process.emitWarning = ((warning: string | Error, ...args: unknown[]) => {
  const warningText = typeof warning === 'string' ? warning : warning.message;
  const warningType = typeof args[0] === 'string' ? args[0] : undefined;

  if (warningType === 'ExperimentalWarning' && sqliteExperimentalWarningPattern.test(warningText)) {
    return;
  }

  return originalEmitWarning(warning as never, ...(args as []));
}) as typeof process.emitWarning;

// Mock Electron APIs for testing
const windowControlsMock = {
  minimize: noop,
  maximize: noop,
  unmaximize: noop,
  close: noop,
  isMaximized: () => Promise.resolve(false),
  onMaximizedChange: (): (() => void) => () => void 0,
};

(global as any).electronAPI = {
  emit: noop,
  on: () => {},
  windowControls: windowControlsMock,
};

if (typeof window !== 'undefined') {
  (window as any).electronAPI = (global as any).electronAPI;
}
