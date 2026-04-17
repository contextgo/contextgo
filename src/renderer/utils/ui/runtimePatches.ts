/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

// 集中管理 renderer 端的运行时补丁，使入口文件保持整洁
// Centralize renderer runtime patches so the entry file stays tidy

declare global {
  interface Window {
    __ContextGoSafeResizeObserver__?: boolean;
    __ContextGoResizeObserverPatched__?: boolean;
    __ContextGoNavigationDiagPatched__?: boolean;
    __ContextGoVisualDiagPatched__?: boolean;
    __ContextGoLastNavigationInteraction__?: NavigationInteractionSnapshot | null;
  }

  interface Console {
    __ContextGoResizeObserverPatched__?: boolean;
  }
}

type NavigationInteractionSnapshot = {
  type: 'click' | 'keydown';
  at: string;
  targetTag: string | null;
  targetRole: string | null;
  targetText: string | null;
  targetClassName: string | null;
  targetHref: string | null;
  pointer: { x: number; y: number; button: number | null } | null;
  key: string | null;
  modifiers: {
    metaKey: boolean;
    ctrlKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
  };
};

const NAV_DIAG_TAG = '[NavDiag]';
const VISUAL_DIAG_TAG = '[VisualDiag]';

const RESIZE_OBSERVER_PATTERNS = [
  'resizeobserver loop limit exceeded',
  'resizeobserver loop completed with undelivered notifications',
];

// Silence Arco Design Message component key warnings (internal library issue)
// 抑制 Arco Design Message 组件的 key 警告（第三方库内部问题）
const ARCO_MESSAGE_KEY_PATTERNS = [
  'each child in a list should have a unique "key" prop',
  'check the render method of `layout`',
  'check the render method of `message`',
];

// Silence React 19 ref deprecation warnings from third-party libraries
// 抑制第三方库中 React 19 ref 废弃警告（等待库更新）
const REACT_19_REF_PATTERNS = ['accessing element.ref was removed in react 19', 'ref is now a regular prop'];

const extractMessage = (value: unknown): string | undefined => {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.message;
  if (typeof value === 'object' && 'message' in value && typeof (value as any).message === 'string') {
    return (value as { message: string }).message;
  }
  return undefined;
};

const shouldSilence = (message?: string) => {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return (
    RESIZE_OBSERVER_PATTERNS.some((pattern) => normalized.includes(pattern)) ||
    ARCO_MESSAGE_KEY_PATTERNS.some((pattern) => normalized.includes(pattern)) ||
    REACT_19_REF_PATTERNS.some((pattern) => normalized.includes(pattern))
  );
};

const patchGlobalErrorListeners = () => {
  const nativeAdd = window.addEventListener.bind(window);
  const nativeRemove = window.removeEventListener.bind(window);
  const listenerMap = new WeakMap<EventListenerOrEventListenerObject, EventListenerOrEventListenerObject>();

  // Hook the top-level error listeners so we can filter ResizeObserver noise before
  // Arco overlays run (避免在 overlay 触发前就被 ResizeObserver 循环警告刷屏，同时保留真实报错).
  window.addEventListener = ((type: any, listener: any, options: any) => {
    if ((type === 'error' || type === 'unhandledrejection') && listener) {
      const wrapped: EventListenerOrEventListenerObject = (event: any) => {
        const message =
          type === 'error' ? (extractMessage(event.error) ?? event.message) : extractMessage(event.reason);
        if (shouldSilence(message)) {
          event.preventDefault?.();
          event.stopImmediatePropagation?.();
          return;
        }
        if (typeof listener === 'function') {
          return listener(event);
        }
        return listener.handleEvent?.(event);
      };
      listenerMap.set(listener, wrapped);
      return nativeAdd(type, wrapped, options);
    }
    return nativeAdd(type, listener, options);
  }) as typeof window.addEventListener;

  window.removeEventListener = ((type: any, listener: any, options: any) => {
    if ((type === 'error' || type === 'unhandledrejection') && listenerMap.has(listener)) {
      const wrapped = listenerMap.get(listener) as EventListenerOrEventListenerObject;
      listenerMap.delete(listener);
      return nativeRemove(type, wrapped, options);
    }
    return nativeRemove(type, listener, options);
  }) as typeof window.removeEventListener;
};

const patchResizeObserver = () => {
  // Wrap ResizeObserver callbacks in requestAnimationFrame to break the feedback loop that
  // browsers treat as "ResizeObserver loop" (在下一帧执行回调，可彻底规避 ResizeObserver loop limit 警告).
  if (!window.__ContextGoSafeResizeObserver__ && typeof ResizeObserver !== 'undefined') {
    const NativeResizeObserver = window.ResizeObserver;
    class SafeResizeObserver extends NativeResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        let frame = 0;
        super((entries, observer) => {
          if (frame) cancelAnimationFrame(frame);
          frame = requestAnimationFrame(() => {
            frame = 0;
            try {
              callback(entries, observer);
            } catch (error) {
              if (!shouldSilence(extractMessage(error))) {
                throw error;
              }
            }
          });
        });
      }
    }
    window.ResizeObserver = SafeResizeObserver as typeof ResizeObserver;
    window.__ContextGoSafeResizeObserver__ = true;
  }
};

const patchGlobalErrorFilters = () => {
  // Global error/rejection filter: quietly drop known RO-loop messages but keep other errors
  // (全局过滤 ResizeObserver 循环提示，只忽略白名单消息，其余错误依然向外抛出).
  if (!window.__ContextGoResizeObserverPatched__) {
    const errorHandler = (event: ErrorEvent) => {
      if (shouldSilence(extractMessage(event.error) ?? event.message)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    const rejectionHandler = (event: PromiseRejectionEvent) => {
      if (shouldSilence(extractMessage(event.reason))) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener('error', errorHandler, true);
    window.addEventListener('unhandledrejection', rejectionHandler, true);
    window.__ContextGoResizeObserverPatched__ = true;
  }
};

const patchConsole = () => {
  // Console patch mirrors the listener filters so devtools logs stay clean（控制台同样做拦截，防止被重复警告淹没）.
  if (typeof console !== 'undefined' && !console.__ContextGoResizeObserverPatched__) {
    const rawError = console.error.bind(console);
    console.error = (...args: unknown[]) => {
      if (args.some((arg) => shouldSilence(extractMessage(arg)))) {
        return;
      }
      rawError(...args);
    };
    console.__ContextGoResizeObserverPatched__ = true;
  }
};

const trimTargetText = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return null;
  }

  return normalized.slice(0, 120);
};

const describeEventTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return {
      targetTag: null,
      targetRole: null,
      targetText: null,
      targetClassName: null,
      targetHref: null,
    };
  }

  const actionable = target.closest<HTMLElement>('a,button,[role="button"],[data-route],[data-testid]');
  const resolved = actionable ?? target;
  const href = resolved instanceof HTMLAnchorElement ? resolved.href : resolved.getAttribute('href');

  return {
    targetTag: resolved.tagName.toLowerCase(),
    targetRole: resolved.getAttribute('role'),
    targetText: trimTargetText(resolved.textContent),
    targetClassName: typeof resolved.className === 'string' ? resolved.className : null,
    targetHref: href,
  };
};

const buildHistoryTarget = (url: string | URL | null | undefined): string | null => {
  if (!url) {
    return null;
  }

  try {
    return new URL(String(url), window.location.href).href;
  } catch {
    return String(url);
  }
};

const buildHistoryStack = (): string[] => {
  const stack = new Error().stack;
  if (!stack) {
    return [];
  }

  return stack
    .split('\n')
    .slice(2, 10)
    .map((entry) => entry.trim());
};

const logNavigationDiag = (scope: string, payload: Record<string, unknown>) => {
  console.log(`${NAV_DIAG_TAG}[${scope}] ${JSON.stringify(payload)}`);
};

const logVisualDiag = (scope: string, payload: Record<string, unknown>) => {
  console.log(`${VISUAL_DIAG_TAG}[${scope}] ${JSON.stringify(payload)}`);
};

const collectHeadEntries = (): string[] =>
  Array.from(document.querySelectorAll('head link[rel="stylesheet"], head style[data-vite-dev-id], head style[id]'))
    .map((node) => node.getAttribute('data-vite-dev-id') || node.getAttribute('id') || node.getAttribute('href') || '')
    .filter(Boolean)
    .slice(-12);

const collectVisualSnapshot = () => {
  const html = document.documentElement;
  const body = document.body;
  const root = document.getElementById('root');

  return {
    href: window.location.href,
    visibility: document.visibilityState,
    readyState: document.readyState,
    htmlClassName: html.className,
    htmlTheme: html.getAttribute('data-theme'),
    bodyClassName: body?.className ?? null,
    bodyArcoTheme: body?.getAttribute('arco-theme') ?? null,
    rootChildCount: root?.childElementCount ?? null,
    rootTextLength: root?.textContent?.length ?? null,
    bodyBackground: body ? window.getComputedStyle(body).backgroundColor : null,
    htmlBackground: window.getComputedStyle(html).backgroundColor,
    headEntries: collectHeadEntries(),
  };
};

const patchVisualDiagnostics = () => {
  if (window.__ContextGoVisualDiagPatched__) {
    return;
  }

  const logSnapshot = (scope: string, extra: Record<string, unknown> = {}) => {
    logVisualDiag(scope, {
      ...collectVisualSnapshot(),
      ...extra,
    });
  };

  let headMutationTimer = 0;
  let rootMutationTimer = 0;

  const scheduleHeadSnapshot = (reason: string) => {
    if (headMutationTimer) {
      window.clearTimeout(headMutationTimer);
    }
    headMutationTimer = window.setTimeout(() => {
      headMutationTimer = 0;
      logSnapshot('head', { reason });
    }, 50);
  };

  const scheduleRootSnapshot = (reason: string) => {
    if (rootMutationTimer) {
      window.clearTimeout(rootMutationTimer);
    }
    rootMutationTimer = window.setTimeout(() => {
      rootMutationTimer = 0;
      logSnapshot('root', { reason });
    }, 50);
  };

  const handleWindowEvent =
    (type: string) =>
    (event: Event): void => {
      const persisted =
        'persisted' in event && typeof (event as PageTransitionEvent).persisted === 'boolean'
          ? (event as PageTransitionEvent).persisted
          : null;
      logSnapshot(`window.${type}`, { persisted });
    };

  ['beforeunload', 'pagehide', 'pageshow', 'focus', 'blur'].forEach((type) => {
    window.addEventListener(type, handleWindowEvent(type), true);
  });

  document.addEventListener(
    'visibilitychange',
    () => {
      logSnapshot('document.visibilitychange');
    },
    true
  );
  document.addEventListener(
    'readystatechange',
    () => {
      logSnapshot('document.readystatechange');
    },
    true
  );

  const htmlObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== 'attributes') {
        continue;
      }
      logSnapshot('html-attr', {
        attributeName: mutation.attributeName,
      });
    }
  });
  htmlObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'style', 'data-theme'],
  });

  if (document.body) {
    const bodyObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type !== 'attributes') {
          continue;
        }
        logSnapshot('body-attr', {
          attributeName: mutation.attributeName,
        });
      }
    });
    bodyObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['class', 'style', 'arco-theme'],
    });
  }

  const headObserver = new MutationObserver((mutations) => {
    const addedNodes = mutations.reduce((count, mutation) => count + mutation.addedNodes.length, 0);
    const removedNodes = mutations.reduce((count, mutation) => count + mutation.removedNodes.length, 0);
    scheduleHeadSnapshot(`added:${addedNodes},removed:${removedNodes}`);
  });
  headObserver.observe(document.head, {
    childList: true,
  });

  const attachRootObserver = () => {
    const root = document.getElementById('root');
    if (!root) {
      window.setTimeout(attachRootObserver, 100);
      return;
    }

    const rootObserver = new MutationObserver((mutations) => {
      const addedNodes = mutations.reduce((count, mutation) => count + mutation.addedNodes.length, 0);
      const removedNodes = mutations.reduce((count, mutation) => count + mutation.removedNodes.length, 0);
      scheduleRootSnapshot(`added:${addedNodes},removed:${removedNodes}`);
    });
    rootObserver.observe(root, {
      childList: true,
      subtree: false,
    });

    logSnapshot('root-observer-attached');
  };

  attachRootObserver();
  logSnapshot('installed');
  window.__ContextGoVisualDiagPatched__ = true;
};

const patchNavigationDiagnostics = () => {
  if (window.__ContextGoNavigationDiagPatched__) {
    return;
  }

  const recordClick = (event: MouseEvent) => {
    window.__ContextGoLastNavigationInteraction__ = {
      type: 'click',
      at: new Date().toISOString(),
      ...describeEventTarget(event.target),
      pointer: {
        x: event.clientX,
        y: event.clientY,
        button: event.button,
      },
      key: null,
      modifiers: {
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey,
      },
    };
  };

  const recordKeyDown = (event: KeyboardEvent) => {
    window.__ContextGoLastNavigationInteraction__ = {
      type: 'keydown',
      at: new Date().toISOString(),
      ...describeEventTarget(event.target),
      pointer: null,
      key: event.key,
      modifiers: {
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey,
      },
    };
  };

  window.addEventListener('click', recordClick, true);
  window.addEventListener('keydown', recordKeyDown, true);

  const rawPushState = window.history.pushState.bind(window.history);
  const rawReplaceState = window.history.replaceState.bind(window.history);

  const wrapHistoryMethod =
    (method: 'pushState' | 'replaceState', rawMethod: typeof window.history.pushState) =>
    (data: unknown, unused: string, url?: string | URL | null) => {
      const fromHref = window.location.href;
      const toHref = buildHistoryTarget(url);
      const stack = buildHistoryStack();
      const lastInteraction = window.__ContextGoLastNavigationInteraction__ ?? null;

      logNavigationDiag(`History.${method}`, {
        fromHref,
        toHref,
        sameDocument: toHref ? new URL(toHref).pathname === window.location.pathname : true,
        lastInteraction,
        stack,
      });

      rawMethod(data, unused, url);
    };

  window.history.pushState = wrapHistoryMethod('pushState', rawPushState);
  window.history.replaceState = wrapHistoryMethod('replaceState', rawReplaceState);

  window.addEventListener(
    'popstate',
    (event) => {
      logNavigationDiag('Window.popstate', {
        href: window.location.href,
        state: event.state,
        lastInteraction: window.__ContextGoLastNavigationInteraction__ ?? null,
      });
    },
    true
  );

  window.addEventListener(
    'hashchange',
    (event) => {
      logNavigationDiag('Window.hashchange', {
        oldURL: event.oldURL,
        newURL: event.newURL,
        lastInteraction: window.__ContextGoLastNavigationInteraction__ ?? null,
      });
    },
    true
  );

  window.__ContextGoNavigationDiagPatched__ = true;
};

export const applyRuntimePatches = () => {
  if (typeof window === 'undefined') {
    return;
  }
  patchGlobalErrorListeners();
  patchResizeObserver();
  patchGlobalErrorFilters();
  patchConsole();
  patchNavigationDiagnostics();
  patchVisualDiagnostics();
};

applyRuntimePatches();
