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
  const wrapperClassName = ['markdown-code-block', isResultCard ? 'markdown-code-block--result-card' : '', className]
    .filter(Boolean)
    .join(' ');

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
    <div className={wrapperClassName} style={{ width: '100%', minWidth: 0, maxWidth: '100%', ...codeStyle }}>
      <div className='markdown-code-block__header'>
        <div className='markdown-code-block__meta'>
          <span className='markdown-code-block__badge'>{t('preview.code')}</span>
          <span className='markdown-code-block__language'>{getLanguageLabel(language)}</span>
        </div>
        <div className='markdown-code-block__actions'>
          {!hiddenCodeCopyButton ? (
            <Tooltip content={t('common.copy')}>
              <Button
                type='text'
                size='mini'
                onClick={handleCopy}
                aria-label={t('common.copy')}
                className='markdown-code-block__action markdown-code-block__copy'
                icon={<Copy theme='outline' size='16' fill='currentColor' className='app-icon' />}
              />
            </Tooltip>
          ) : null}
          {isCollapsible ? (
            <Button
              type='text'
              size='mini'
              onClick={() => setFold(!fold)}
              className='markdown-code-block__action markdown-code-block__toggle'
              aria-label={fold ? t('common.expandMore') : t('common.collapse')}
            >
              {fold ? t('common.expandMore') : t('common.collapse')}
            </Button>
          ) : null}
        </div>
      </div>
      {isCollapsible && fold ? (
        <div className='markdown-code-block__body'>
          <pre className='markdown-code-block__preview'>{previewContent}</pre>
        </div>
      ) : (
        <div className='markdown-code-block__body'>
          <div className='markdown-code-block__surface'>
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
  );
}

export default CodeBlock;
