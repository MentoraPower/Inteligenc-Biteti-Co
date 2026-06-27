/**
 * Real-time Store Selectors
 * Optimized selectors for consuming real-time data with minimal re-renders
 */

import { useCallback, useMemo } from 'react';
import { useRealtimeStore } from '@/stores/realtimeStore';
import type {
  Lead,
  LeadActivity,
  ConnectionState,
} from '@/lib/realtime/types';

// Shallow compare for arrays
const shallowArrayEqual = <T>(a: T[], b: T[]): boolean => {
  if (a.length !== b.length) return false;
  return a.every((item, index) => item === b[index]);
};

// ============================================
// Connection Selectors
// ============================================

export const useConnectionState = (): ConnectionState => {
  return useRealtimeStore((state) => state.connectionState);
};

export const useIsConnected = (): boolean => {
  return useRealtimeStore((state) => state.connectionState === 'connected');
};

export const useReconnectAttempts = (): number => {
  return useRealtimeStore((state) => state.reconnectAttempts);
};

export const useIsTabActive = (): boolean => {
  return useRealtimeStore((state) => state.isTabActive);
};

// ============================================
// Lead Selectors
// ============================================

export const useLead = (leadId: string): Lead | undefined => {
  return useRealtimeStore((state) => state.leads.byId[leadId]);
};

export const useLeadsByPipelineId = (pipelineId: string): Lead[] => {
  return useRealtimeStore(
    useCallback(
      (state) => {
        const leadIds = state.leads.byPipelineId[pipelineId] || [];
        return leadIds
          .map((id) => state.leads.byId[id])
          .filter(Boolean)
          .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
      },
      [pipelineId]
    )
  );
};

export const useAllLeads = (): Lead[] => {
  return useRealtimeStore(
    useCallback((state) => {
      return state.leads.allIds.map((id) => state.leads.byId[id]).filter(Boolean);
    }, [])
  );
};

export const useLeadIds = (): string[] => {
  return useRealtimeStore((state) => state.leads.allIds);
};

export const useLeadsCount = (): number => {
  return useRealtimeStore((state) => state.leads.allIds.length);
};

// ============================================
// Activity Selectors
// ============================================

export const useActivity = (activityId: string): LeadActivity | undefined => {
  return useRealtimeStore((state) => state.activities.byId[activityId]);
};

export const useActivitiesByLeadId = (leadId: string): LeadActivity[] => {
  return useRealtimeStore(
    useCallback(
      (state) => {
        const activityIds = state.activities.byLeadId[leadId] || [];
        return activityIds
          .map((id) => state.activities.byId[id])
          .filter(Boolean)
          .sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
      },
      [leadId]
    )
  );
};

export const useAllActivities = (): LeadActivity[] => {
  return useRealtimeStore(
    useCallback((state) => {
      return state.activities.allIds.map((id) => state.activities.byId[id]).filter(Boolean);
    }, [])
  );
};

export const usePendingActivitiesCount = (): number => {
  return useRealtimeStore(
    useCallback((state) => {
      return Object.values(state.activities.byId).filter(
        (activity) => !activity.concluida
      ).length;
    }, [])
  );
};

// ============================================
// Presence Selectors
// ============================================

export const useUserPresence = (userId: string) => {
  return useRealtimeStore((state) => state.presence.users[userId]);
};

export const useOnlineUsers = () => {
  return useRealtimeStore(
    useCallback((state) => {
      return Object.values(state.presence.users).filter(
        (user) => user.status === 'online'
      );
    }, [])
  );
};

export const useOnlineUsersCount = (): number => {
  return useRealtimeStore(
    useCallback((state) => {
      return Object.values(state.presence.users).filter(
        (user) => user.status === 'online'
      ).length;
    }, [])
  );
};

// ============================================
// Store Actions (for components that need to update)
// ============================================

export const useRealtimeActions = () => {
  const setLeads = useRealtimeStore((state) => state.setLeads);
  const upsertLead = useRealtimeStore((state) => state.upsertLead);
  const deleteLead = useRealtimeStore((state) => state.deleteLead);

  const setActivities = useRealtimeStore((state) => state.setActivities);
  const upsertActivity = useRealtimeStore((state) => state.upsertActivity);
  const deleteActivity = useRealtimeStore((state) => state.deleteActivity);

  return useMemo(() => ({
    // Leads
    setLeads,
    upsertLead,
    deleteLead,

    // Activities
    setActivities,
    upsertActivity,
    deleteActivity,
  }), [
    setLeads, upsertLead, deleteLead,
    setActivities, upsertActivity, deleteActivity,
  ]);
};
