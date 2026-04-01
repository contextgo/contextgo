/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { reportRendererBoundaryCrash } from '@renderer/utils/ui/rendererCrashReporting';

type RendererCrashBoundaryProps = React.PropsWithChildren;

type RendererCrashBoundaryState = {
  hasError: boolean;
};

let resetRendererCrashBoundaryHandler: (() => void) | null = null;

export const requestRendererCrashBoundaryReset = (): boolean => {
  if (!resetRendererCrashBoundaryHandler) {
    return false;
  }

  resetRendererCrashBoundaryHandler();
  return true;
};

class RendererCrashBoundary extends React.Component<RendererCrashBoundaryProps, RendererCrashBoundaryState> {
  public state: RendererCrashBoundaryState = {
    hasError: false,
  };

  private readonly handleReset = (): void => {
    this.setState({ hasError: false });
  };

  public static getDerivedStateFromError(): RendererCrashBoundaryState {
    return {
      hasError: true,
    };
  }

  public override componentDidMount(): void {
    resetRendererCrashBoundaryHandler = this.handleReset;
  }

  public override componentWillUnmount(): void {
    if (resetRendererCrashBoundaryHandler === this.handleReset) {
      resetRendererCrashBoundaryHandler = null;
    }
  }

  public override componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    reportRendererBoundaryCrash(error, errorInfo);
  }

  public override render(): React.ReactNode {
    if (this.state.hasError) {
      return null;
    }

    return this.props.children;
  }
}

export default RendererCrashBoundary;
