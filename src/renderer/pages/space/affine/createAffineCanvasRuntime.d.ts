import type { SpaceAffineCanvasProjection, SpaceAffineCanvasSelectionItem } from './types';

export type AffineCanvasRuntime = {
  destroy: () => void;
  editor: HTMLElement;
  fitToScreen: () => void;
  ready: () => Promise<void>;
  subscribeSelection: (onSelectionChange: (item: SpaceAffineCanvasSelectionItem | null) => void) => () => void;
};

export declare const createAffineCanvasRuntime: (
  projection: SpaceAffineCanvasProjection
) => Promise<AffineCanvasRuntime>;
