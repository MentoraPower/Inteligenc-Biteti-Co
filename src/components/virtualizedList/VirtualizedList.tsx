/**
 * Virtualized List Component
 * High-performance list rendering for large datasets
 */

import { useRef, memo, ReactNode, useCallback, useMemo } from 'react';
import { useVirtualizer, VirtualItem } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils';

interface VirtualizedListProps<T> {
  items: T[];
  estimateSize: number | ((index: number) => number);
  renderItem: (item: T, index: number, virtualItem: VirtualItem) => ReactNode;
  keyExtractor: (item: T, index: number) => string;
  className?: string;
  overscan?: number;
  horizontal?: boolean;
  gap?: number;
  paddingStart?: number;
  paddingEnd?: number;
  onEndReached?: () => void;
  endReachedThreshold?: number;
}

function VirtualizedListInner<T>({
  items,
  estimateSize,
  renderItem,
  keyExtractor,
  className,
  overscan = 5,
  horizontal = false,
  gap = 0,
  paddingStart = 0,
  paddingEnd = 0,
  onEndReached,
  endReachedThreshold = 200,
}: VirtualizedListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const endReachedCalledRef = useRef(false);

  const estimateSizeFn = useMemo(() => {
    if (typeof estimateSize === 'function') {
      return estimateSize;
    }
    return () => estimateSize;
  }, [estimateSize]);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: estimateSizeFn,
    overscan,
    horizontal,
    paddingStart,
    paddingEnd,
    gap,
  });

  const virtualItems = virtualizer.getVirtualItems();

  // Handle end reached callback
  const handleScroll = useCallback(() => {
    if (!onEndReached || !parentRef.current) return;

    const scrollElement = parentRef.current;
    const { scrollTop, scrollHeight, clientHeight } = scrollElement;
    const distanceFromEnd = scrollHeight - scrollTop - clientHeight;

    if (distanceFromEnd <= endReachedThreshold && !endReachedCalledRef.current) {
      endReachedCalledRef.current = true;
      onEndReached();
      // Reset after a short delay to allow for loading
      setTimeout(() => {
        endReachedCalledRef.current = false;
      }, 1000);
    }
  }, [onEndReached, endReachedThreshold]);

  return (
    <div
      ref={parentRef}
      className={cn('overflow-auto', className)}
      onScroll={handleScroll}
    >
      <div
        style={{
          [horizontal ? 'width' : 'height']: `${virtualizer.getTotalSize()}px`,
          [horizontal ? 'height' : 'width']: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualItem) => {
          const item = items[virtualItem.index];
          const key = keyExtractor(item, virtualItem.index);

          return (
            <div
              key={key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                [horizontal ? 'width' : 'height']: `${virtualItem.size}px`,
                transform: horizontal
                  ? `translateX(${virtualItem.start}px)`
                  : `translateY(${virtualItem.start}px)`,
              }}
            >
              {renderItem(item, virtualItem.index, virtualItem)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const VirtualizedList = memo(VirtualizedListInner) as typeof VirtualizedListInner;

export default VirtualizedList;
