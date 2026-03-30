/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ContextGo 基础组件库统一导出 / ContextGo base components unified exports
 *
 * 提供所有基础组件和类型的统一导出入口
 * Provides unified export entry for all base components and types
 */

// ==================== 组件导出 / Component Exports ====================

export { default as ContextGoModal } from './ContextGoModal';
export { default as ContextGoCollapse } from './ContextGoCollapse';
export { default as ContextGoSelect } from './ContextGoSelect';
export { default as ContextGoScrollArea } from './ContextGoScrollArea';
export { default as ContextGoSteps } from './ContextGoSteps';

// ==================== 类型导出 / Type Exports ====================

// ContextGoModal 类型 / ContextGoModal types
export type {
  ModalSize,
  ModalHeaderConfig,
  ModalFooterConfig,
  ModalContentStyleConfig,
  ContextGoModalProps,
} from './ContextGoModal';
export { MODAL_SIZES } from './ContextGoModal';

// ContextGoCollapse 类型 / ContextGoCollapse types
export type { ContextGoCollapseProps, ContextGoCollapseItemProps } from './ContextGoCollapse';

// ContextGoSelect 类型 / ContextGoSelect types
export type { ContextGoSelectProps } from './ContextGoSelect';

// ContextGoSteps 类型 / ContextGoSteps types
export type { ContextGoStepsProps } from './ContextGoSteps';
