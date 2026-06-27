/**
 * Event Buffer - Batching and Flow Control
 * Buffers events and flushes them in batches for optimal performance
 */

import type { NormalizedEvent, BufferConfig, EventPriority } from './types';

const DEFAULT_CONFIG: BufferConfig = {
  minBatchInterval: 50,
  maxBatchInterval: 150,
  maxBatchSize: 100,
  priorityFlush: true,
};

type FlushCallback = (events: NormalizedEvent[]) => void;

export class EventBuffer {
  private buffer: NormalizedEvent[] = [];
  private config: BufferConfig;
  private flushCallback: FlushCallback;
  private flushTimeout: ReturnType<typeof setTimeout> | null = null;
  private lastFlushTime: number = 0;
  private isProcessing: boolean = false;

  constructor(flushCallback: FlushCallback, config: Partial<BufferConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.flushCallback = flushCallback;
  }

  /**
   * Add an event to the buffer
   */
  add(event: NormalizedEvent): void {
    // Deduplicate: replace older event for same entity
    const existingIndex = this.buffer.findIndex(
      (e) => e.id === event.id && e.domain === event.domain
    );

    if (existingIndex !== -1) {
      // Keep the newer event
      this.buffer[existingIndex] = event;
    } else {
      this.buffer.push(event);
    }

    // Sort by priority
    this.buffer.sort((a, b) => this.getPriorityWeight(b.priority) - this.getPriorityWeight(a.priority));

    // Check for immediate flush conditions
    if (this.shouldFlushImmediately(event)) {
      this.flush();
      return;
    }

    // Schedule flush if not already scheduled
    this.scheduleFlush();
  }

  /**
   * Add multiple events at once
   */
  addBatch(events: NormalizedEvent[]): void {
    events.forEach((event) => this.add(event));
  }

  /**
   * Force flush all buffered events
   */
  flush(): void {
    if (this.isProcessing || this.buffer.length === 0) {
      return;
    }

    this.isProcessing = true;
    this.clearScheduledFlush();

    // Take events up to max batch size
    const eventsToFlush = this.buffer.splice(0, this.config.maxBatchSize);
    this.lastFlushTime = Date.now();

    try {
      this.flushCallback(eventsToFlush);
    } catch (error) {
      console.error('[EventBuffer] Error flushing events:', error);
    } finally {
      this.isProcessing = false;
    }

    // If there are remaining events, schedule another flush
    if (this.buffer.length > 0) {
      this.scheduleFlush();
    }
  }

  /**
   * Get current buffer size
   */
  size(): number {
    return this.buffer.length;
  }

  /**
   * Clear all buffered events
   */
  clear(): void {
    this.buffer = [];
    this.clearScheduledFlush();
  }

  /**
   * Pause/resume buffering for tab visibility
   */
  private paused: boolean = false;

  pause(): void {
    this.paused = true;
    this.clearScheduledFlush();
  }

  resume(): void {
    this.paused = false;
    if (this.buffer.length > 0) {
      this.flush();
    }
  }

  isPaused(): boolean {
    return this.paused;
  }

  /**
   * Get pending events without flushing
   */
  getPending(): NormalizedEvent[] {
    return [...this.buffer];
  }

  private shouldFlushImmediately(event: NormalizedEvent): boolean {
    // Flush immediately for critical events if configured
    if (this.config.priorityFlush && event.priority === 'critical') {
      return true;
    }

    // Flush if buffer is full
    if (this.buffer.length >= this.config.maxBatchSize) {
      return true;
    }

    return false;
  }

  private scheduleFlush(): void {
    if (this.flushTimeout || this.paused) {
      return;
    }

    const timeSinceLastFlush = Date.now() - this.lastFlushTime;
    const delay = Math.max(
      this.config.minBatchInterval,
      Math.min(this.config.maxBatchInterval - timeSinceLastFlush, this.config.maxBatchInterval)
    );

    this.flushTimeout = setTimeout(() => {
      this.flushTimeout = null;
      if (!this.paused) {
        this.flush();
      }
    }, delay);
  }

  private clearScheduledFlush(): void {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }
  }

  private getPriorityWeight(priority: EventPriority): number {
    switch (priority) {
      case 'critical':
        return 4;
      case 'high':
        return 3;
      case 'normal':
        return 2;
      case 'low':
        return 1;
      default:
        return 0;
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.clear();
  }
}

// Singleton instance for global use
let globalBuffer: EventBuffer | null = null;

export const getEventBuffer = (
  flushCallback?: FlushCallback,
  config?: Partial<BufferConfig>
): EventBuffer => {
  if (!globalBuffer && flushCallback) {
    globalBuffer = new EventBuffer(flushCallback, config);
  }
  if (!globalBuffer) {
    throw new Error('EventBuffer not initialized. Call with flushCallback first.');
  }
  return globalBuffer;
};

export const resetEventBuffer = (): void => {
  if (globalBuffer) {
    globalBuffer.destroy();
    globalBuffer = null;
  }
};
