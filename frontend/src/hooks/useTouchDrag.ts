import { useCallback, useRef } from 'react';

interface TouchDragOptions {
  onDragStart: (event: TouchEvent | MouseEvent, startPosition: { x: number; y: number }) => void;
  onDragMove: (event: TouchEvent | MouseEvent, currentPosition: { x: number; y: number }) => void;
  onDragEnd: (event: TouchEvent | MouseEvent, endPosition: { x: number; y: number }) => void;
  enabled?: boolean;
}

export function useTouchDrag({
  onDragStart,
  onDragMove,
  onDragEnd,
  enabled = true
}: TouchDragOptions) {
  const isDragging = useRef(false);
  const startPosition = useRef({ x: 0, y: 0 });

  const getEventPosition = useCallback((event: TouchEvent | MouseEvent) => {
    if ('touches' in event) {
      // Touch event
      const touch = event.touches[0] || event.changedTouches[0];
      return { x: touch.clientX, y: touch.clientY };
    } else {
      // Mouse event
      return { x: event.clientX, y: event.clientY };
    }
  }, []);

  const handleStart = useCallback((event: TouchEvent | MouseEvent) => {
    if (!enabled) return;
    
    event.preventDefault();
    isDragging.current = true;
    
    const position = getEventPosition(event);
    startPosition.current = position;
    
    onDragStart(event, position);

    // Add event listeners for move and end events
    if ('touches' in event) {
      // Touch events
      document.addEventListener('touchmove', handleMove, { passive: false });
      document.addEventListener('touchend', handleEnd);
      document.addEventListener('touchcancel', handleEnd);
    } else {
      // Mouse events
      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleEnd);
    }
  }, [enabled, onDragStart, getEventPosition]);

  const handleMove = useCallback((event: TouchEvent | MouseEvent) => {
    if (!isDragging.current) return;
    
    event.preventDefault();
    const position = getEventPosition(event);
    onDragMove(event, position);
  }, [onDragMove, getEventPosition]);

  const handleEnd = useCallback((event: TouchEvent | MouseEvent) => {
    if (!isDragging.current) return;
    
    isDragging.current = false;
    const position = getEventPosition(event);
    
    onDragEnd(event, position);

    // Remove event listeners
    if ('touches' in event || event.type.startsWith('touch')) {
      // Touch events
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
      document.removeEventListener('touchcancel', handleEnd);
    } else {
      // Mouse events
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
    }
  }, [onDragEnd, getEventPosition, handleMove]);

  const dragHandlers = {
    onMouseDown: handleStart,
    onTouchStart: handleStart,
  };

  return {
    dragHandlers,
    isDragging: isDragging.current
  };
}