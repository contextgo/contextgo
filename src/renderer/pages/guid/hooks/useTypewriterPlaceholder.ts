/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';

/**
 * Typewriter animation hook for rotating text phrases.
 */
export const useTypewriterPlaceholder = (texts: string | string[]): string => {
  const [placeholder, setPlaceholder] = useState('');
  const sourceTexts = Array.isArray(texts) ? texts : [texts];
  const textKey = sourceTexts.join('\u0000');
  const normalizedTexts = sourceTexts.map((text) => text.trim()).filter((text) => text.length > 0);

  useEffect(() => {
    if (normalizedTexts.length === 0) {
      setPlaceholder('');
      return;
    }

    const initialDelayMs = 300;
    const typingSpeedMs = 80;
    const holdDelayMs = 1800;
    const rotateDelayMs = 260;
    const phraseCount = normalizedTexts.length;
    let currentPhraseIndex = Math.min(Math.floor(Math.random() * phraseCount), Math.max(phraseCount - 1, 0));
    let currentIndex = 0;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const typeNextChar = () => {
      const currentText = normalizedTexts[currentPhraseIndex] ?? '';
      if (currentIndex < currentText.length) {
        currentIndex += 1;
        const isComplete = currentIndex >= currentText.length;
        setPlaceholder(currentText.slice(0, currentIndex) + (isComplete ? '' : '|'));
        if (isComplete) {
          if (phraseCount <= 1) {
            return;
          }

          timeoutId = setTimeout(() => {
            currentPhraseIndex = (currentPhraseIndex + 1) % phraseCount;
            currentIndex = 0;
            setPlaceholder('');
            timeoutId = setTimeout(typeNextChar, rotateDelayMs);
          }, holdDelayMs);
          return;
        }

        timeoutId = setTimeout(typeNextChar, typingSpeedMs);
        return;
      }
    };

    setPlaceholder('');
    timeoutId = setTimeout(typeNextChar, initialDelayMs);

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [textKey]);

  return placeholder;
};
