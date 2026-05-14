import { layout, prepare, type PreparedText } from '@chenglou/pretext';

const PRETEXT_OPTIONS = { whiteSpace: 'pre-wrap' } as const;
const PREPARED_CACHE_LIMIT = 64;
const WIDE_CHARACTER_RE = /[\u2E80-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF\uFE10-\uFE6F\uFF00-\uFFEF]/u;
const EMOJI_RE = /[\p{Extended_Pictographic}\p{Emoji_Presentation}]/u;
const PUNCTUATION_RE = /[.,!?;:)/\\%\]}]/u;

const preparedCache = new Map<string, PreparedText>();

export type TextLayoutStyle = {
  font: string;
  lineHeight: number;
};

export type MeasureTextLineCountOptions = TextLayoutStyle & {
  text: string;
  maxWidth: number;
};

const parsePixelValue = (value: string, fallback: number): number => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parseFontSize = (font: string): number => {
  const matched = font.match(/(\d+(?:\.\d+)?)px/);
  return matched ? Number.parseFloat(matched[1]) : 14;
};

const canUsePretext = (): boolean => {
  if (typeof OffscreenCanvas !== 'undefined') {
    return true;
  }

  if (typeof document === 'undefined') {
    return false;
  }

  try {
    return document.createElement('canvas').getContext('2d') !== null;
  } catch {
    return false;
  }
};

const getPreparedText = (text: string, font: string): PreparedText => {
  const cacheKey = `${font}\u0000${text}`;
  const cached = preparedCache.get(cacheKey);
  if (cached) {
    preparedCache.delete(cacheKey);
    preparedCache.set(cacheKey, cached);
    return cached;
  }

  const prepared = prepare(text, font, PRETEXT_OPTIONS);
  preparedCache.set(cacheKey, prepared);

  if (preparedCache.size > PREPARED_CACHE_LIMIT) {
    const oldestKey = preparedCache.keys().next().value;
    if (oldestKey) {
      preparedCache.delete(oldestKey);
    }
  }

  return prepared;
};

const getApproximateCharacterWidth = (character: string, fontSize: number, lineWidth: number): number => {
  if (character === ' ') {
    return fontSize * 0.33;
  }

  if (character === '\t') {
    const tabStop = fontSize * 0.33 * 8;
    const remainder = lineWidth % tabStop;
    return remainder === 0 ? tabStop : tabStop - remainder;
  }

  if (EMOJI_RE.test(character) || WIDE_CHARACTER_RE.test(character)) {
    return fontSize;
  }

  return PUNCTUATION_RE.test(character) ? fontSize * 0.4 : fontSize * 0.6;
};

const getFallbackLineCount = ({ text, font, maxWidth }: MeasureTextLineCountOptions): number => {
  if (text.length === 0) {
    return 0;
  }

  const fontSize = parseFontSize(font);
  const safeWidth = Math.max(maxWidth, 1);
  const visualLines = text.split('\n');
  let totalLineCount = 0;

  for (const visualLine of visualLines) {
    if (visualLine.length === 0) {
      totalLineCount += 1;
      continue;
    }

    let currentLineWidth = 0;
    totalLineCount += 1;

    for (const character of visualLine) {
      const characterWidth = getApproximateCharacterWidth(character, fontSize, currentLineWidth);
      if (currentLineWidth > 0 && currentLineWidth + characterWidth > safeWidth) {
        totalLineCount += 1;
        currentLineWidth = 0;
      }
      currentLineWidth += getApproximateCharacterWidth(character, fontSize, currentLineWidth);
    }
  }

  return totalLineCount;
};

export const getTextLayoutStyle = (element: HTMLElement): TextLayoutStyle => {
  const style = window.getComputedStyle(element);
  const fontSize = parsePixelValue(style.fontSize, 14);
  const lineHeight = parsePixelValue(style.lineHeight, fontSize * 1.5);
  const font = `${style.fontStyle || 'normal'} ${style.fontWeight || '400'} ${fontSize}px ${style.fontFamily || 'sans-serif'}`;

  return {
    font,
    lineHeight,
  };
};

export const measureTextLineCount = (options: MeasureTextLineCountOptions): number => {
  if (options.text.length === 0) {
    return 0;
  }

  const normalizedOptions = {
    ...options,
    maxWidth: Math.max(options.maxWidth, 1),
    lineHeight:
      Number.isFinite(options.lineHeight) && options.lineHeight > 0
        ? options.lineHeight
        : parseFontSize(options.font) * 1.5,
  };

  if (canUsePretext()) {
    try {
      const prepared = getPreparedText(normalizedOptions.text, normalizedOptions.font);
      return layout(prepared, normalizedOptions.maxWidth, normalizedOptions.lineHeight).lineCount;
    } catch {
      return getFallbackLineCount(normalizedOptions);
    }
  }

  return getFallbackLineCount(normalizedOptions);
};
