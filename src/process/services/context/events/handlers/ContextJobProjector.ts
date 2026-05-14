/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ContextJobOrchestrator } from '../../ContextJobOrchestrator';
import type { ContextEventBus } from '../ContextEventBus';

export function registerContextJobProjector(
  _bus: ContextEventBus,
  _orchestrator: ContextJobOrchestrator = new ContextJobOrchestrator()
): void {
  // Governance job projection is owned by ContextTriggerRouter.
}
