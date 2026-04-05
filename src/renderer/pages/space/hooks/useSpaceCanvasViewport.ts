import React, { useRef, useState } from 'react';

type SpaceCanvasViewport = {
  x: number;
  y: number;
  scale: number;
};

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
};

const INITIAL_VIEWPORT: SpaceCanvasViewport = {
  x: 64,
  y: 48,
  scale: 1,
};

const MIN_SCALE = 0.7;
const MAX_SCALE = 1.65;
const SCALE_STEP = 0.12;

const clampScale = (value: number): number => {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number(value.toFixed(2))));
};

export const useSpaceCanvasViewport = () => {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [viewport, setViewport] = useState<SpaceCanvasViewport>(INITIAL_VIEWPORT);
  const [dragging, setDragging] = useState(false);

  const setScaleAt = (nextScale: number, originX?: number, originY?: number) => {
    setViewport((previous) => {
      const scale = clampScale(nextScale);
      if (originX === undefined || originY === undefined || scale === previous.scale) {
        return { ...previous, scale };
      }

      const worldX = (originX - previous.x) / previous.scale;
      const worldY = (originY - previous.y) / previous.scale;

      return {
        x: originX - worldX * scale,
        y: originY - worldY * scale,
        scale,
      };
    });
  };

  const resetViewport = () => {
    setViewport(INITIAL_VIEWPORT);
  };

  const zoomIn = () => {
    setViewport((previous) => ({
      ...previous,
      scale: clampScale(previous.scale + SCALE_STEP),
    }));
  };

  const zoomOut = () => {
    setViewport((previous) => ({
      ...previous,
      scale: clampScale(previous.scale - SCALE_STEP),
    }));
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.target !== event.currentTarget) {
      return;
    }

    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: viewport.x,
      originY: viewport.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;
    setViewport((previous) => ({
      ...previous,
      x: dragState.originX + deltaX,
      y: dragState.originY + deltaY,
    }));
  };

  const finishDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
    setDragging(false);
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!event.metaKey && !event.ctrlKey) {
      return;
    }

    event.preventDefault();
    const rect = surfaceRef.current?.getBoundingClientRect();
    const originX = rect ? event.clientX - rect.left : undefined;
    const originY = rect ? event.clientY - rect.top : undefined;
    const nextScale = viewport.scale + (event.deltaY < 0 ? SCALE_STEP : -SCALE_STEP);
    setScaleAt(nextScale, originX, originY);
  };

  return {
    surfaceRef,
    viewport,
    dragging,
    zoomIn,
    zoomOut,
    resetViewport,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp: finishDrag,
    handlePointerCancel: finishDrag,
    handleWheel,
  };
};
