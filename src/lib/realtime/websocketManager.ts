/**
 * WebSocket Manager
 * Handles connection lifecycle, reconnection, and event routing
 */

import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { ConnectionState, SupabaseRealtimePayload } from './types';

type EventCallback = (payload: SupabaseRealtimePayload) => void;
type ConnectionCallback = (state: ConnectionState) => void;

interface ChannelConfig {
  table: string;
  schema?: string;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  filter?: string;
}

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000]; // Exponential backoff

export class WebSocketManager {
  private channels: Map<string, RealtimeChannel> = new Map();
  private eventCallbacks: Set<EventCallback> = new Set();
  private connectionCallbacks: Set<ConnectionCallback> = new Set();
  private connectionState: ConnectionState = 'disconnected';
  private reconnectAttempt: number = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private isDestroyed: boolean = false;

  constructor() {
    // Listen for visibility changes
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
    
    // Listen for online/offline
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
    }
  }

  /**
   * Subscribe to real-time events for a table
   */
  subscribe(config: ChannelConfig): void {
    const channelName = `realtime_${config.table}`;
    
    // Validate channel name to prevent invalid UUID errors
    if (channelName.includes('null') || channelName.includes('undefined')) {
      console.warn(`[WSManager] Invalid channel name: ${channelName}, skipping subscription`);
      return;
    }
    
    // Also validate filter if present
    if (config.filter && (config.filter.includes('=null') || config.filter.includes('=undefined'))) {
      console.warn(`[WSManager] Invalid filter: ${config.filter}, skipping subscription`);
      return;
    }
    
    if (this.channels.has(channelName)) {
      console.log(`[WSManager] Channel ${channelName} already subscribed`);
      return;
    }

    console.log(`[WSManager] Subscribing to ${channelName}`);
    
    const channel = supabase
      .channel(channelName)
      .on<Record<string, unknown>>(
        'postgres_changes' as const,
        {
          event: config.event || '*',
          schema: config.schema || 'public',
          table: config.table,
          filter: config.filter,
        } as any,
        (payload: any) => {
          const normalizedPayload: SupabaseRealtimePayload = {
            eventType: payload.eventType,
            new: payload.new,
            old: payload.old,
            table: payload.table,
            schema: payload.schema,
            commit_timestamp: payload.commit_timestamp,
          };
          this.handleEvent(normalizedPayload);
        }
      )
      .subscribe((status) => {
        console.log(`[WSManager] Channel ${channelName} status: ${status}`);
        
        if (status === 'SUBSCRIBED') {
          this.updateConnectionState('connected');
          this.reconnectAttempt = 0;
        } else if (status === 'CHANNEL_ERROR') {
          this.updateConnectionState('error');
          this.scheduleReconnect();
        } else if (status === 'CLOSED') {
          this.updateConnectionState('disconnected');
        }
      });

    this.channels.set(channelName, channel);
  }

  /**
   * Subscribe to multiple tables
   */
  subscribeAll(configs: ChannelConfig[]): void {
    configs.forEach((config) => this.subscribe(config));
  }

  /**
   * Unsubscribe from a table
   */
  unsubscribe(table: string): void {
    const channelName = `realtime_${table}`;
    const channel = this.channels.get(channelName);
    
    if (channel) {
      supabase.removeChannel(channel);
      this.channels.delete(channelName);
      console.log(`[WSManager] Unsubscribed from ${channelName}`);
    }
  }

  /**
   * Unsubscribe from all tables
   */
  unsubscribeAll(): void {
    this.channels.forEach((channel, name) => {
      supabase.removeChannel(channel);
      console.log(`[WSManager] Unsubscribed from ${name}`);
    });
    this.channels.clear();
  }

  /**
   * Register event callback
   */
  onEvent(callback: EventCallback): () => void {
    this.eventCallbacks.add(callback);
    return () => this.eventCallbacks.delete(callback);
  }

  /**
   * Register connection state callback
   */
  onConnectionChange(callback: ConnectionCallback): () => void {
    this.connectionCallbacks.add(callback);
    // Immediately call with current state
    callback(this.connectionState);
    return () => this.connectionCallbacks.delete(callback);
  }

  /**
   * Get current connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Force reconnect
   */
  reconnect(): void {
    this.unsubscribeAll();
    // Re-subscribe will happen when configs are provided again
    this.updateConnectionState('reconnecting');
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.isDestroyed = true;
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    this.unsubscribeAll();
    this.eventCallbacks.clear();
    this.connectionCallbacks.clear();
    
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
    
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('offline', this.handleOffline);
    }
  }

  private handleEvent = (payload: SupabaseRealtimePayload): void => {
    console.log('[WSManager] Event received:', payload.table, payload.eventType);
    
    this.eventCallbacks.forEach((callback) => {
      try {
        callback(payload);
      } catch (error) {
        console.error('[WSManager] Error in event callback:', error);
      }
    });
  };

  private updateConnectionState(state: ConnectionState): void {
    if (this.connectionState === state) return;
    
    console.log(`[WSManager] Connection state: ${this.connectionState} -> ${state}`);
    this.connectionState = state;
    
    this.connectionCallbacks.forEach((callback) => {
      try {
        callback(state);
      } catch (error) {
        console.error('[WSManager] Error in connection callback:', error);
      }
    });
  }

  private scheduleReconnect = (): void => {
    if (this.isDestroyed || this.reconnectTimeout) return;
    
    const delay = RECONNECT_DELAYS[Math.min(this.reconnectAttempt, RECONNECT_DELAYS.length - 1)];
    console.log(`[WSManager] Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempt + 1})`);
    
    this.updateConnectionState('reconnecting');
    
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.reconnectAttempt++;
      
      // Re-subscribe to all channels
      const tables = Array.from(this.channels.keys()).map((name) => 
        name.replace('realtime_', '')
      );
      
      this.unsubscribeAll();
      tables.forEach((table) => this.subscribe({ table }));
    }, delay);
  };

  private handleVisibilityChange = (): void => {
    if (document.hidden) {
      console.log('[WSManager] Tab hidden - connection maintained');
    } else {
      console.log('[WSManager] Tab visible - checking connection');
      // Force a reconnect if we were disconnected
      if (this.connectionState === 'disconnected' || this.connectionState === 'error') {
        this.reconnect();
      }
    }
  };

  private handleOnline = (): void => {
    console.log('[WSManager] Network online - reconnecting');
    this.reconnect();
  };

  private handleOffline = (): void => {
    console.log('[WSManager] Network offline');
    this.updateConnectionState('disconnected');
  };
}

// Singleton instance
let wsManager: WebSocketManager | null = null;

export const getWebSocketManager = (): WebSocketManager => {
  if (!wsManager) {
    wsManager = new WebSocketManager();
  }
  return wsManager;
};

export const resetWebSocketManager = (): void => {
  if (wsManager) {
    wsManager.destroy();
    wsManager = null;
  }
};
