/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Selects a stable copy variant from a random value generated once per page load.
 */
export function selectGuidCopyVariant(variants: string[], randomValue: number): string {
  const normalizedVariants = variants.map((variant) => variant.trim()).filter(Boolean);
  if (normalizedVariants.length === 0) {
    return '';
  }

  if (!Number.isFinite(randomValue)) {
    return normalizedVariants[0];
  }

  const clampedRandom = Math.min(Math.max(randomValue, 0), 0.999999999999);
  return normalizedVariants[Math.floor(clampedRandom * normalizedVariants.length)] ?? normalizedVariants[0];
}
