import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface ChannelConfig {
  channelName: string;
  table: string;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  filter?: string;
  schema?: string;
  onPayload: (payload: RealtimePostgresChangesPayload<any>) => void;
  onStatusChange?: (status: string) => void;
  pollingFallback?: {
    enabled: boolean;
    intervalMs: number;
    fetchFn: () => Promise<void>;
    shouldPoll?: () => boolean;
  };
}

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000];

/**
 * A resilient Supabase Realtime channel hook with:
 * - Auto-reconnect with exponential backoff
 * - Optional polling fallback
 * - Visibility change handling
 */
export function useResilientChannel(config: ChannelConfig) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSubscribedRef = useRef(false);
  const lastEventTimeRef = useRef<number>(Date.now());

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const clearPollingInterval = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  const setupPolling = useCallback(() => {
    if (!config.pollingFallback?.enabled) return;
    
    clearPollingInterval();
    
    pollingIntervalRef.current = setInterval(async () => {
      // Check if we should poll
      if (config.pollingFallback?.shouldPoll && !config.pollingFallback.shouldPoll()) {
        return;
      }
      
      // Poll if not subscribed or no recent events
      const timeSinceLastEvent = Date.now() - lastEventTimeRef.current;
      if (!isSubscribedRef.current || timeSinceLastEvent > config.pollingFallback!.intervalMs * 2) {
        console.log(`[ResilientChannel:${config.channelName}] Polling fallback triggered`);
        try {
          await config.pollingFallback!.fetchFn();
        } catch (error) {
          console.error(`[ResilientChannel:${config.channelName}] Polling error:`, error);
        }
      }
    }, config.pollingFallback.intervalMs);
  }, [config, clearPollingInterval]);

  const subscribe = useCallback(() => {
    // Remove existing channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    console.log(`[ResilientChannel:${config.channelName}] Subscribing...`);

    channelRef.current = supabase
      .channel(config.channelName)
      .on(
        'postgres_changes',
        {
          event: config.event || '*',
          schema: config.schema || 'public',
          table: config.table,
          filter: config.filter,
        } as any,
        (payload) => {
          lastEventTimeRef.current = Date.now();
          config.onPayload(payload);
        }
      )
      .subscribe((status) => {
        console.log(`[ResilientChannel:${config.channelName}] Status: ${status}`);
        config.onStatusChange?.(status);

        if (status === 'SUBSCRIBED') {
          isSubscribedRef.current = true;
          reconnectAttemptRef.current = 0;
          clearReconnectTimeout();
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          isSubscribedRef.current = false;
          scheduleReconnect();
        }
      });
  }, [config, clearReconnectTimeout]);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) return;

    const delay = RECONNECT_DELAYS[Math.min(reconnectAttemptRef.current, RECONNECT_DELAYS.length - 1)];
    console.log(`[ResilientChannel:${config.channelName}] Scheduling reconnect in ${delay}ms (attempt ${reconnectAttemptRef.current + 1})`);

    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectTimeoutRef.current = null;
      reconnectAttemptRef.current++;
      subscribe();
    }, delay);
  }, [config.channelName, subscribe]);

  // Handle visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log(`[ResilientChannel:${config.channelName}] Tab hidden`);
      } else {
        console.log(`[ResilientChannel:${config.channelName}] Tab visible - checking connection`);
        if (!isSubscribedRef.current) {
          clearReconnectTimeout();
          reconnectAttemptRef.current = 0;
          subscribe();
        }
        // Force a poll when tab becomes visible
        if (config.pollingFallback?.enabled && config.pollingFallback.fetchFn) {
          config.pollingFallback.fetchFn().catch(console.error);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [config, subscribe, clearReconnectTimeout]);

  // Main subscription setup
  useEffect(() => {
    subscribe();
    setupPolling();

    return () => {
      clearReconnectTimeout();
      clearPollingInterval();
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [subscribe, setupPolling, clearReconnectTimeout, clearPollingInterval]);

  return {
    isSubscribed: () => isSubscribedRef.current,
    forceReconnect: () => {
      clearReconnectTimeout();
      reconnectAttemptRef.current = 0;
      subscribe();
    },
  };
}
