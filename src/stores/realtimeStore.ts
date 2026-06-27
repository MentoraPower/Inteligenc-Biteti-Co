/**
 * Zustand Real-time Store
 * Single source of truth for all real-time data
 */

import { create } from 'zustand';
import { subscribeWithSelector, devtools } from 'zustand/middleware';
import type {
  RealtimeStore,
  RealtimeStoreState,
  NormalizedEvent,
  Lead,
  LeadActivity,
  UserPresence,
} from '@/lib/realtime/types';

// Initial state
const initialState: RealtimeStoreState = {
  connectionState: 'disconnected',
  lastConnectedAt: null,
  reconnectAttempts: 0,
  isTabActive: true,
  pendingUpdates: [],

  leads: {
    byId: {},
    byPipelineId: {},
    allIds: [],
  },

  activities: {
    byId: {},
    byLeadId: {},
    allIds: [],
  },

  presence: {
    users: {},
  },

  metrics: {
    lastUpdated: 0,
    data: {},
  },
};

const applyLeadEvent = (state: RealtimeStoreState, event: NormalizedEvent): void => {
  const lead = event.data as Lead;
  
  if (event.type === 'delete') {
    const oldLead = state.leads.byId[event.id];
    delete state.leads.byId[event.id];
    state.leads.allIds = state.leads.allIds.filter((id) => id !== event.id);
    if (oldLead?.pipeline_id) {
      state.leads.byPipelineId[oldLead.pipeline_id] = (
        state.leads.byPipelineId[oldLead.pipeline_id] || []
      ).filter((id) => id !== event.id);
    }
  } else {
    const oldLead = state.leads.byId[event.id];
    state.leads.byId[event.id] = lead;
    if (!state.leads.allIds.includes(event.id)) {
      state.leads.allIds.push(event.id);
    }
    if (oldLead?.pipeline_id && oldLead.pipeline_id !== lead.pipeline_id) {
      state.leads.byPipelineId[oldLead.pipeline_id] = (
        state.leads.byPipelineId[oldLead.pipeline_id] || []
      ).filter((id) => id !== event.id);
    }
    if (lead.pipeline_id) {
      if (!state.leads.byPipelineId[lead.pipeline_id]) {
        state.leads.byPipelineId[lead.pipeline_id] = [];
      }
      if (!state.leads.byPipelineId[lead.pipeline_id].includes(event.id)) {
        state.leads.byPipelineId[lead.pipeline_id].push(event.id);
      }
    }
  }
};

const applyActivityEvent = (state: RealtimeStoreState, event: NormalizedEvent): void => {
  const activity = event.data as LeadActivity;
  
  if (event.type === 'delete') {
    delete state.activities.byId[event.id];
    state.activities.allIds = state.activities.allIds.filter((id) => id !== event.id);
    Object.keys(state.activities.byLeadId).forEach((leadId) => {
      state.activities.byLeadId[leadId] = state.activities.byLeadId[leadId].filter(
        (id) => id !== event.id
      );
    });
  } else {
    state.activities.byId[event.id] = activity;
    if (!state.activities.allIds.includes(event.id)) {
      state.activities.allIds.push(event.id);
    }
    if (!state.activities.byLeadId[activity.lead_id]) {
      state.activities.byLeadId[activity.lead_id] = [];
    }
    if (!state.activities.byLeadId[activity.lead_id].includes(event.id)) {
      state.activities.byLeadId[activity.lead_id].push(event.id);
    }
  }
};

const applyPresenceEvent = (state: RealtimeStoreState, event: NormalizedEvent): void => {
  const presence = event.data as UserPresence;
  
  if (event.type === 'delete') {
    delete state.presence.users[presence.userId];
  } else {
    state.presence.users[presence.userId] = presence;
  }
};

export const useRealtimeStore = create<RealtimeStore>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      ...initialState,

      // Connection actions
      setConnectionState: (state) =>
        set(
          (prev) => ({
            connectionState: state,
            lastConnectedAt: state === 'connected' ? Date.now() : prev.lastConnectedAt,
          }),
          false,
          'setConnectionState'
        ),

      incrementReconnectAttempts: () =>
        set(
          (prev) => ({ reconnectAttempts: prev.reconnectAttempts + 1 }),
          false,
          'incrementReconnectAttempts'
        ),

      resetReconnectAttempts: () =>
        set({ reconnectAttempts: 0 }, false, 'resetReconnectAttempts'),

      // Tab visibility
      setTabActive: (active) =>
        set({ isTabActive: active }, false, 'setTabActive'),

      processPendingUpdates: () => {
        const { pendingUpdates, applyBatch } = get();
        if (pendingUpdates.length > 0) {
          applyBatch(pendingUpdates);
          set({ pendingUpdates: [] }, false, 'processPendingUpdates');
        }
      },

      // Batch update handler
      applyBatch: (events) =>
        set(
          (state) => {
            const newState = { ...state };

            events.forEach((event) => {
              switch (event.domain) {
                case 'leads':
                  applyLeadEvent(newState, event);
                  break;
                case 'activities':
                  applyActivityEvent(newState, event);
                  break;
                case 'presence':
                  applyPresenceEvent(newState, event);
                  break;
              }
            });

            return newState;
          },
          false,
          'applyBatch'
        ),

      // Leads actions
      setLeads: (leads) =>
        set(
          (state) => {
            const byId: Record<string, Lead> = {};
            const byPipelineId: Record<string, string[]> = {};
            const allIds: string[] = [];

            leads.forEach((lead) => {
              byId[lead.id] = lead;
              allIds.push(lead.id);
              if (lead.pipeline_id) {
                if (!byPipelineId[lead.pipeline_id]) {
                  byPipelineId[lead.pipeline_id] = [];
                }
                byPipelineId[lead.pipeline_id].push(lead.id);
              }
            });

            return { leads: { byId, byPipelineId, allIds } };
          },
          false,
          'setLeads'
        ),

      upsertLead: (lead) =>
        set(
          (state) => {
            const oldLead = state.leads.byId[lead.id];
            const byId = { ...state.leads.byId, [lead.id]: lead };
            const allIds = state.leads.allIds.includes(lead.id)
              ? state.leads.allIds
              : [...state.leads.allIds, lead.id];

            const byPipelineId = { ...state.leads.byPipelineId };

            // Remove from old pipeline if changed
            if (oldLead?.pipeline_id && oldLead.pipeline_id !== lead.pipeline_id) {
              byPipelineId[oldLead.pipeline_id] = (byPipelineId[oldLead.pipeline_id] || []).filter(
                (lid) => lid !== lead.id
              );
            }

            // Add to new pipeline
            if (lead.pipeline_id) {
              if (!byPipelineId[lead.pipeline_id]) {
                byPipelineId[lead.pipeline_id] = [];
              }
              if (!byPipelineId[lead.pipeline_id].includes(lead.id)) {
                byPipelineId[lead.pipeline_id] = [...byPipelineId[lead.pipeline_id], lead.id];
              }
            }

            return { leads: { byId, byPipelineId, allIds } };
          },
          false,
          'upsertLead'
        ),

      deleteLead: (id) =>
        set(
          (state) => {
            const { [id]: deleted, ...byId } = state.leads.byId;
            const allIds = state.leads.allIds.filter((lid) => lid !== id);

            const byPipelineId = { ...state.leads.byPipelineId };
            Object.keys(byPipelineId).forEach((pipelineId) => {
              byPipelineId[pipelineId] = byPipelineId[pipelineId].filter((lid) => lid !== id);
            });

            return { leads: { byId, byPipelineId, allIds } };
          },
          false,
          'deleteLead'
        ),

      // Activities actions
      setActivities: (activities) =>
        set(
          (state) => {
            const byId: Record<string, LeadActivity> = {};
            const byLeadId: Record<string, string[]> = {};
            const allIds: string[] = [];

            activities.forEach((act) => {
              byId[act.id] = act;
              allIds.push(act.id);
              if (!byLeadId[act.lead_id]) {
                byLeadId[act.lead_id] = [];
              }
              byLeadId[act.lead_id].push(act.id);
            });

            return { activities: { byId, byLeadId, allIds } };
          },
          false,
          'setActivities'
        ),

      upsertActivity: (activity) =>
        set(
          (state) => {
            const byId = { ...state.activities.byId, [activity.id]: activity };
            const allIds = state.activities.allIds.includes(activity.id)
              ? state.activities.allIds
              : [...state.activities.allIds, activity.id];

            const byLeadId = { ...state.activities.byLeadId };
            if (!byLeadId[activity.lead_id]) {
              byLeadId[activity.lead_id] = [];
            }
            if (!byLeadId[activity.lead_id].includes(activity.id)) {
              byLeadId[activity.lead_id] = [...byLeadId[activity.lead_id], activity.id];
            }

            return { activities: { byId, byLeadId, allIds } };
          },
          false,
          'upsertActivity'
        ),

      deleteActivity: (id) =>
        set(
          (state) => {
            const { [id]: deleted, ...byId } = state.activities.byId;
            const allIds = state.activities.allIds.filter((aid) => aid !== id);

            const byLeadId = { ...state.activities.byLeadId };
            Object.keys(byLeadId).forEach((leadId) => {
              byLeadId[leadId] = byLeadId[leadId].filter((aid) => aid !== id);
            });

            return { activities: { byId, byLeadId, allIds } };
          },
          false,
          'deleteActivity'
        ),

      // Presence actions
      updatePresence: (presence) =>
        set(
          (state) => ({
            presence: {
              users: { ...state.presence.users, [presence.userId]: presence },
            },
          }),
          false,
          'updatePresence'
        ),

      removePresence: (userId) =>
        set(
          (state) => {
            const { [userId]: removed, ...users } = state.presence.users;
            return { presence: { users } };
          },
          false,
          'removePresence'
        ),

      // Reset
      reset: () => set(initialState, false, 'reset'),
    })),
    { name: 'realtime-store' }
  )
);
