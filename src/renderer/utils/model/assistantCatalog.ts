import type { AcpBackendConfig } from '@/common/types/acpTypes';
import { buildBuiltinAssistants } from '@/common/config/presets/builtinAssistantDefaults';

export function mergeAssistantsWithBuiltinFallback(
  assistants: AcpBackendConfig[] | null | undefined
): AcpBackendConfig[] {
  const currentAssistants = Array.isArray(assistants) ? assistants : [];
  const mergedAssistants = [...currentAssistants];
  const existingIds = new Set(currentAssistants.map((assistant) => assistant.id));

  for (const builtinAssistant of buildBuiltinAssistants()) {
    if (existingIds.has(builtinAssistant.id)) {
      continue;
    }
    mergedAssistants.push(builtinAssistant);
  }

  return mergedAssistants;
}
