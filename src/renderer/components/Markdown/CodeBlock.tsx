/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import SyntaxHighlighter from 'react-syntax-highlighter';
import { vs, vs2015 } from 'react-syntax-highlighter/dist/esm/styles/hljs';

import katex from 'katex';

import { copyText } from '@/renderer/utils/ui/clipboard';
import { Button, Message, Tooltip } from '@arco-design/web-react';
import { Copy } from '@icon-park/react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatCode, getDiffLineStyle } from './markdownUtils';

export type CodeBlockVariant = 'default' | 'result-card';

type CodeBlockProps = {
  children: string;
  className?: string;
  node?: unknown;
  hiddenCodeCopyButton?: boolean;
  codeStyle?: React.CSSProperties;
  codeVariant?: CodeBlockVariant;
  [key: string]: unknown;
};

const LANGUAGE_PATTERN = /language-([\w#+-]+)/;
const PREVIEW_LINE_LIMIT = 6;
const COLLAPSIBLE_LINE_LIMIT = 24;

const getLanguageLabel = (language: string): string => {
  return language.replace(/^[.]+/, '').toUpperCase();
};

function CodeBlock(props: CodeBlockProps) {
  const { t } = useTranslation();
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>(() => {
    return (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    const updateTheme = () => {
      const theme = (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
      setCurrentTheme(theme);
    };

    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => observer.disconnect();
  }, []);

  const {
    children,
    className,
    node: _node,
    hiddenCodeCopyButton = false,
    codeStyle,
    codeVariant = 'default',
    ...rest
  } = props;
  const rawContent = String(children);
  const match = LANGUAGE_PATTERN.exec(className || '');
  const language = (match?.[1] || 'text').toLowerCase();
  const normalizedContent = rawContent.replace(/\n$/, '');

  if (language === 'latex' || language === 'math' || language === 'tex') {
    const isFullDocument = /\\(documentclass|begin\{document\}|usepackage)\b/.test(normalizedContent);
    if (!isFullDocument) {
      try {
        const html = katex.renderToString(normalizedContent, {
          displayMode: true,
          throwOnError: false,
        });
        return <div className='katex-display' dangerouslySetInnerHTML={{ __html: html }} />;
      } catch {
        // Fall through to render as code block if KaTeX fails.
      }
    }
  }

  if (!rawContent.includes('\n')) {
    return (
      <code
        {...rest}
        className={className}
        style={{
          fontWeight: 'bold',
        }}
      >
        {children}
      </code>
    );
  }

  const isResultCard = codeVariant === 'result-card';
  const containerClassName = className
    ? [className, isResultCard ? '' : 'not-prose'].filter(Boolean).join(' ')
    : isResultCard
      ? undefined
      : 'not-prose';

  const isDiff = language === 'diff';
  const codeTheme = currentTheme === 'dark' ? vs2015 : vs;
  const formattedContent = useMemo(() => formatCode(children), [children]);
  const codeLines = useMemo(() => formattedContent.split('\n'), [formattedContent]);
  const isCollapsible = codeLines.length > COLLAPSIBLE_LINE_LIMIT;
  const [fold, setFold] = useState(false);
  const diffLines = useMemo(() => (isDiff ? codeLines : []), [codeLines, isDiff]);
  const previewContent = useMemo(() => {
    const previewLines = codeLines.slice(0, PREVIEW_LINE_LIMIT);
    return previewLines.join('\n') + (codeLines.length > PREVIEW_LINE_LIMIT ? '\n...' : '');
  }, [codeLines]);

  useEffect(() => {
    setFold(false);
  }, [formattedContent]);

  const handleCopy = () => {
    void copyText(formattedContent)
      .then(() => {
        Message.success(t('common.copySuccess'));
      })
      .catch(() => {
        Message.error(t('common.copyFailed'));
      });
  };

  const renderSyntaxHighlighter = (customStyle: React.CSSProperties) => {
    return (
      <SyntaxHighlighter
        language={language}
        style={codeTheme}
        PreTag='div'
        wrapLines={isDiff}
        wrapLongLines={language === 'text'}
        lineProps={
          isDiff
            ? (lineNumber: number) => ({
                style: {
                  display: 'block',
                  ...getDiffLineStyle(diffLines[lineNumber - 1] || '', currentTheme === 'dark'),
                },
              })
            : undefined
        }
        customStyle={customStyle}
        codeTagProps={{
          style: {
            color: 'var(--text-primary)',
          },
        }}
      >
        {formattedContent}
      </SyntaxHighlighter>
    );
  };

  return (
    <div className={containerClassName} style={{ width: '100%', minWidth: 0, maxWidth: '100%', ...codeStyle }}>
      <div
        className='w-full overflow-hidden rd-12px border border-arco-1 bg-fill-1'
        style={{
          boxShadow: isResultCard ? undefined : '0 4px 18px color-mix(in srgb, var(--color-text-1) 4%, transparent)',
        }}
      >
        <div className='flex items-center justify-between gap-8px border-b border-arco-1 bg-fill-2 px-12px py-10px'>
          <div className='min-w-0 flex items-center gap-8px flex-wrap'>
            <span className='inline-flex h-22px items-center rd-999px bg-primary-light-1 px-8px text-11px font-600 uppercase text-primary'>
              {t('preview.code')}
            </span>
            <span className='text-12px font-600 uppercase text-t-primary'>{getLanguageLabel(language)}</span>
          </div>
          <div className='shrink-0 flex items-center gap-2px'>
            {!hiddenCodeCopyButton && (
              <Tooltip content={t('common.copy')}>
                <Button
                  size='mini'
                  type='text'
                  icon={<Copy theme='outline' size='16' fill='currentColor' className='app-icon' />}
                  onClick={handleCopy}
                  aria-label={t('common.copy')}
                  className='!text-t-secondary hover:!text-t-primary'
                />
              </Tooltip>
            )}
            {isCollapsible ? (
              <Button
                size='mini'
                type='text'
                onClick={() => setFold(!fold)}
                className='!px-8px !text-t-secondary hover:!text-t-primary'
              >
                {fold ? t('common.expandMore') : t('common.collapse')}
              </Button>
            ) : null}
          </div>
        </div>
        {isCollapsible && fold ? (
          <div className='px-12px py-12px'>
            <pre className='m-0 overflow-hidden rd-8px bg-base px-12px py-10px font-mono text-12px leading-18px text-t-primary whitespace-pre-wrap break-words'>
              {previewContent}
            </pre>
          </div>
        ) : (
          <div className='px-12px py-12px'>
            <div className='overflow-hidden rd-8px bg-base'>
              {renderSyntaxHighlighter({
                marginTop: '0',
                margin: '0',
                border: 'none',
                background: 'transparent',
                color: 'var(--text-primary)',
                overflowX: 'auto',
                maxWidth: '100%',
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CodeBlock;
