/**
 * Real-time Service
 * Orchestrates WebSocket connections, event buffering, and store updates
 */

import { getWebSocketManager, resetWebSocketManager } from './websocketManager';
import { EventBuffer, resetEventBuffer } from './eventBuffer';
import { normalizeEvent, mergeEvents } from './eventNormalizers';
import { useRealtimeStore } from '@/stores/realtimeStore';
import type { SupabaseRealtimePayload, NormalizedEvent } from './types';

// Tables to subscribe for real-time updates
const REALTIME_TABLES = [
  'leads',
  'lead_activities',
  'pipelines',
];

class RealtimeService {
  private wsManager = getWebSocketManager();
  private eventBuffer: EventBuffer;
  private isInitialized: boolean = false;
  private unsubscribeConnection: (() => void) | null = null;
  private visibilityHandler: (() => void) | null = null;

  constructor() {
    // Initialize event buffer with flush callback
    this.eventBuffer = new EventBuffer(
      (events) => this.handleBatchFlush(events),
      {
        minBatchInterval: 50,
        maxBatchInterval: 150,
        maxBatchSize: 100,
        priorityFlush: true,
      }
    );
  }

  /**
   * Initialize real-time subscriptions
   */
  initialize(): void {
    if (this.isInitialized) {
      console.log('[RealtimeService] Already initialized');
      return;
    }

    console.log('[RealtimeService] Initializing...');

    // Subscribe to events from WebSocket manager
    this.wsManager.onEvent((payload) => this.handleRawEvent(payload));

    // Subscribe to connection state changes
    this.unsubscribeConnection = this.wsManager.onConnectionChange((state) => {
      useRealtimeStore.getState().setConnectionState(state);
      
      if (state === 'connected') {
        useRealtimeStore.getState().resetReconnectAttempts();
      } else if (state === 'reconnecting') {
        useRealtimeStore.getState().incrementReconnectAttempts();
      }
    });

    // Subscribe to all tables
    this.wsManager.subscribeAll(
      REALTIME_TABLES.map((table) => ({ table }))
    );

    // Set up visibility change handler
    this.setupVisibilityHandler();

    this.isInitialized = true;
    console.log('[RealtimeService] Initialized successfully');
  }

  /**
   * Cleanup and destroy service
   */
  destroy(): void {
    console.log('[RealtimeService] Destroying...');

    if (this.unsubscribeConnection) {
      this.unsubscribeConnection();
      this.unsubscribeConnection = null;
    }

    if (this.visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }

    resetWebSocketManager();
    resetEventBuffer();
    useRealtimeStore.getState().reset();

    this.isInitialized = false;
    console.log('[RealtimeService] Destroyed');
  }

  /**
   * Manually trigger reconnection
   */
  reconnect(): void {
    this.wsManager.reconnect();
    this.wsManager.subscribeAll(
      REALTIME_TABLES.map((table) => ({ table }))
    );
  }

  /**
   * Check if service is initialized
   */
  isActive(): boolean {
    return this.isInitialized;
  }

  /**
   * Get current connection state
   */
  getConnectionState() {
    return this.wsManager.getConnectionState();
  }

  private handleRawEvent(payload: SupabaseRealtimePayload): void {
    console.log('[RealtimeService] Raw event:', payload.table, payload.eventType);

    // Normalize the event
    const normalizedEvent = normalizeEvent(payload);

    if (!normalizedEvent) {
      console.warn('[RealtimeService] Could not normalize event:', payload);
      return;
    }

    // Check if tab is active
    const { isTabActive } = useRealtimeStore.getState();

    if (!isTabActive) {
      // Queue event for when tab becomes active
      useRealtimeStore.setState((state) => ({
        pendingUpdates: [...state.pendingUpdates, normalizedEvent],
      }));
      return;
    }

    // Add to buffer for batching
    this.eventBuffer.add(normalizedEvent);
  }

  private handleBatchFlush(events: NormalizedEvent[]): void {
    if (events.length === 0) return;

    console.log(`[RealtimeService] Flushing ${events.length} events`);

    // Merge events for same entities (keep latest)
    const mergedEvents = mergeEvents(events);

    // Apply batch to store
    useRealtimeStore.getState().applyBatch(mergedEvents);
  }

  private setupVisibilityHandler(): void {
    if (typeof document === 'undefined') return;

    this.visibilityHandler = () => {
      const isActive = !document.hidden;
      const store = useRealtimeStore.getState();

      store.setTabActive(isActive);

      if (isActive) {
        console.log('[RealtimeService] Tab became active - processing pending updates');
        
        // Resume event buffer
        this.eventBuffer.resume();

        // Process any pending updates
        store.processPendingUpdates();
      } else {
        console.log('[RealtimeService] Tab became inactive - pausing visual updates');
        
        // Pause event buffer (events still accumulate in pendingUpdates)
        this.eventBuffer.pause();
      }
    };

    document.addEventListener('visibilitychange', this.visibilityHandler);
  }
}

// Singleton instance
let realtimeService: RealtimeService | null = null;

export const getRealtimeService = (): RealtimeService => {
  if (!realtimeService) {
    realtimeService = new RealtimeService();
  }
  return realtimeService;
};

export const initializeRealtime = (): void => {
  getRealtimeService().initialize();
};

export const destroyRealtime = (): void => {
  if (realtimeService) {
    realtimeService.destroy();
    realtimeService = null;
  }
};

export const reconnectRealtime = (): void => {
  getRealtimeService().reconnect();
};
