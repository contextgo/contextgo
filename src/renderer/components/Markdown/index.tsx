/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import ReactMarkdown from 'react-markdown';

import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

// Import KaTeX CSS to make it available in the document
import 'katex/dist/katex.min.css';

import { openExternalUrl } from '@/renderer/utils/platform';
import classNames from 'classnames';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { convertLatexDelimiters } from '@renderer/utils/chat/latexDelimiters';
import LocalImageView from '@renderer/components/media/LocalImageView';
import CodeBlock, { type CodeBlockVariant } from './CodeBlock';
import ShadowView from './ShadowView';

type MarkdownViewProps = {
  children: string;
  hiddenCodeCopyButton?: boolean;
  codeStyle?: React.CSSProperties;
  className?: string;
  onRef?: (el?: HTMLDivElement | null) => void;
  codeVariant?: CodeBlockVariant;
  /** Enable raw HTML rendering in markdown content. Use with caution — only for trusted sources. */
  allowHtml?: boolean;
};

const LOCAL_IMAGE_EXT_PATTERN = /\.(?:avif|bmp|gif|ico|jpe?g|png|svg|tiff?|webp)(?:[?#].*)?$/i;

const hasLocalImagePathPrefix = (value: string): boolean =>
  value.startsWith('/') ||
  value.startsWith('./') ||
  value.startsWith('../') ||
  value.startsWith('~/') ||
  value.startsWith('file://') ||
  /^[A-Za-z]:[\\/]/.test(value) ||
  /^[^:]+\//.test(value) ||
  /^[^:]+\\/.test(value);

const unwrapStandalonePath = (value: string): string => {
  const wrappers: Array<[string, string]> = [
    ['`', '`'],
    ['"', '"'],
    ["'", "'"],
  ];

  for (const [start, end] of wrappers) {
    if (value.startsWith(start) && value.endsWith(end) && value.length > start.length + end.length) {
      return value.slice(start.length, -end.length).trim();
    }
  }

  return value;
};

const extractStandaloneLocalImagePath = (line: string): { imagePath: string; suffix: string } | null => {
  const value = unwrapStandalonePath(line.trim());
  if (!value || value.startsWith('![') || /^(?:https?:|data:|blob:)/i.test(value)) {
    return null;
  }

  if (hasLocalImagePathPrefix(value) && LOCAL_IMAGE_EXT_PATTERN.test(value)) {
    return { imagePath: value, suffix: '' };
  }

  const leadingPathMatch = /^(.+?\.(?:avif|bmp|gif|ico|jpe?g|png|svg|tiff?|webp)(?:[?#][^\s:：,，;；、]*)?)([\s:：,，;；、-].*)$/i.exec(value);
  const imagePath = leadingPathMatch?.[1]?.trim();
  if (!imagePath || /\s/.test(imagePath) || !hasLocalImagePathPrefix(imagePath)) {
    return null;
  }

  return {
    imagePath,
    suffix: leadingPathMatch?.[2]?.trimStart() ?? '',
  };
};

const escapeMarkdownAlt = (value: string): string => value.replace(/[[\]\\]/g, '');

const getImageAltFromPath = (value: string): string => {
  const pathWithoutQuery = value.split(/[?#]/, 1)[0] || value;
  return escapeMarkdownAlt(pathWithoutQuery.split(/[\\/]/).pop() || 'image');
};

const encodeMarkdownImageDestination = (value: string): string =>
  value.replace(/%/g, '%25').replace(/ /g, '%20').replace(/</g, '%3C').replace(/>/g, '%3E');

export const renderStandaloneLocalImagePaths = (content: string): string => {
  let inFence = false;

  return content
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (/^(```|~~~)/.test(trimmed)) {
        inFence = !inFence;
        return line;
      }

      if (inFence) {
        return line;
      }

      const match = extractStandaloneLocalImagePath(line);
      if (!match) {
        return line;
      }

      return `![${getImageAltFromPath(match.imagePath)}](<${encodeMarkdownImageDestination(match.imagePath)}>)${
        match.suffix ? `\n${match.suffix}` : ''
      }`;
    })
    .join('\n');
};

const isLocalFilePath = (src: string): boolean => {
  if (src.startsWith('http://') || src.startsWith('https://')) {
    return false;
  }
  if (src.startsWith('data:')) {
    return false;
  }
  return true;
};

const MarkdownView: React.FC<MarkdownViewProps> = ({
  hiddenCodeCopyButton,
  codeStyle,
  className,
  onRef,
  codeVariant,
  allowHtml,
  children: childrenProp,
}) => {
  const { t } = useTranslation();

  const normalizedChildren = useMemo(() => {
    if (typeof childrenProp === 'string') {
      let text = childrenProp.replace(/file:\/\//g, '');
      text = convertLatexDelimiters(text);
      text = renderStandaloneLocalImagePaths(text);
      return text;
    }
    return childrenProp;
  }, [childrenProp]);

  return (
    <div className={classNames('relative w-full', className)}>
      <ShadowView>
        <div ref={onRef} className='markdown-shadow-body'>
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]}
            rehypePlugins={allowHtml ? [rehypeRaw, rehypeKatex] : [rehypeKatex]}
            components={{
              span: ({ node: _node, className: spanClassName, children, ...props }) => {
                return (
                  <span {...props} className={spanClassName}>
                    {children}
                  </span>
                );
              },
              code: (props: Record<string, unknown>) =>
                CodeBlock({
                  ...(props as Parameters<typeof CodeBlock>[0]),
                  codeStyle,
                  hiddenCodeCopyButton,
                  codeVariant,
                }),
              a: ({ node: _node, ...props }) => (
                <a
                  {...props}
                  target='_blank'
                  rel='noreferrer'
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!props.href) return;
                    openExternalUrl(props.href).catch((error: unknown) => {
                      console.error(t('messages.openLinkFailed'), error);
                    });
                  }}
                />
              ),
              table: ({ node: _node, ...props }) => (
                <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
                  <table
                    {...props}
                    style={{
                      ...props.style,
                      borderCollapse: 'collapse',
                      border: '1px solid var(--bg-3)',
                      minWidth: '100%',
                    }}
                  />
                </div>
              ),
              td: ({ node: _node, ...props }) => (
                <td
                  {...props}
                  style={{
                    ...props.style,
                    padding: '8px',
                    border: '1px solid var(--bg-3)',
                    minWidth: '120px',
                  }}
                />
              ),
              img: ({ node: _node, ...props }) => {
                if (isLocalFilePath(props.src || '')) {
                  let src = props.src || '';
                  try {
                    src = decodeURIComponent(src);
                  } catch {
                    src = props.src || '';
                  }
                  return <LocalImageView src={src} alt={props.alt || ''} className={props.className} />;
                }
                return <img {...props} />;
              },
            }}
          >
            {normalizedChildren}
          </ReactMarkdown>
        </div>
      </ShadowView>
    </div>
  );
};

export default MarkdownView;
