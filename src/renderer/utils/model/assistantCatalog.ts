import type { AcpBackendConfig } from '@/common/types/acpTypes';
import {
  buildBuiltinAssistants,
  buildContextEngineSystemAssistants,
} from '@/common/config/presets/builtinAssistantDefaults';

export type ResolvedAssistantCatalog = {
  productAssistants: AcpBackendConfig[];
  systemAssistants: AcpBackendConfig[];
};

export function buildResolvedAssistantCatalog(
  assistants: AcpBackendConfig[] | null | undefined
): ResolvedAssistantCatalog {
  const currentAssistants = Array.isArray(assistants) ? assistants : [];
  const productAssistants = [...currentAssistants];
  const existingIds = new Set(currentAssistants.map((assistant) => assistant.id));

  for (const builtinAssistant of buildBuiltinAssistants()) {
    if (existingIds.has(builtinAssistant.id)) {
      continue;
    }
    productAssistants.push(builtinAssistant);
  }

  return {
    productAssistants,
    systemAssistants: buildContextEngineSystemAssistants(),
  };
}

export function mergeAssistantsWithBuiltinFallback(
  assistants: AcpBackendConfig[] | null | undefined
): AcpBackendConfig[] {
  return buildResolvedAssistantCatalog(assistants).productAssistants;
}
