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

class RendererCrashBoundary extends React.Component<RendererCrashBoundaryProps, RendererCrashBoundaryState> {
  public state: RendererCrashBoundaryState = {
    hasError: false,
  };

  public static getDerivedStateFromError(): RendererCrashBoundaryState {
    return {
      hasError: true,
    };
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
