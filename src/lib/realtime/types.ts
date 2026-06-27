/**
 * Real-time Architecture Types
 * Professional high-performance real-time system
 */

// Domain identifiers for store separation
export type RealtimeDomain =
  | 'leads'
  | 'users'
  | 'metrics'
  | 'presence'
  | 'activities'
  | 'pipelines';

// Event priority levels
export type EventPriority = 'critical' | 'high' | 'normal' | 'low';

// Base event structure from Supabase realtime
export interface SupabaseRealtimePayload<T = unknown> {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: T | null;
  old: T | null;
  table: string;
  schema: string;
  commit_timestamp: string;
}

// Normalized event after processing
export interface NormalizedEvent<T = unknown> {
  id: string;
  domain: RealtimeDomain;
  type: 'insert' | 'update' | 'delete';
  priority: EventPriority;
  timestamp: number;
  data: T;
  oldData?: T;
  table: string;
  batchKey?: string; // For grouping related events
}

// WebSocket connection states
export type ConnectionState = 
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'reconnecting'
  | 'error';

// Event buffer configuration
export interface BufferConfig {
  minBatchInterval: number; // Minimum time between flushes (50ms)
  maxBatchInterval: number; // Maximum time to hold events (150ms)
  maxBatchSize: number; // Maximum events per batch
  priorityFlush: boolean; // Flush immediately for critical events
}

// Domain-specific data types
export interface Lead {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  instagram: string;
  pipeline_id: string | null;
  sub_origin_id: string | null;
  ordem: number | null;
  created_at: string;
  // ... other lead fields
}

export interface LeadActivity {
  id: string;
  lead_id: string;
  titulo: string;
  tipo: string;
  data: string;
  hora: string;
  concluida: boolean;
  notas: string | null;
  pipeline_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserPresence {
  id: string;
  userId: string;
  status: 'online' | 'away' | 'offline';
  lastSeen: string;
  currentPage?: string;
}

// Store slice types
export interface LeadsSlice {
  byId: Record<string, Lead>;
  byPipelineId: Record<string, string[]>; // pipeline_id -> lead ids
  allIds: string[];
}

export interface ActivitiesSlice {
  byId: Record<string, LeadActivity>;
  byLeadId: Record<string, string[]>; // lead_id -> activity ids
  allIds: string[];
}

export interface PresenceSlice {
  users: Record<string, UserPresence>;
}

export interface MetricsSlice {
  lastUpdated: number;
  data: Record<string, unknown>;
}

// Global real-time store state
export interface RealtimeStoreState {
  // Connection state
  connectionState: ConnectionState;
  lastConnectedAt: number | null;
  reconnectAttempts: number;
  
  // Tab visibility
  isTabActive: boolean;
  pendingUpdates: NormalizedEvent[];
  
  // Domain slices
  leads: LeadsSlice;
  activities: ActivitiesSlice;
  presence: PresenceSlice;
  metrics: MetricsSlice;
}

// Store actions
export interface RealtimeStoreActions {
  // Connection actions
  setConnectionState: (state: ConnectionState) => void;
  incrementReconnectAttempts: () => void;
  resetReconnectAttempts: () => void;
  
  // Tab visibility
  setTabActive: (active: boolean) => void;
  processPendingUpdates: () => void;
  
  // Batch update handler
  applyBatch: (events: NormalizedEvent[]) => void;
  
  // Domain-specific actions
  setLeads: (leads: Lead[]) => void;
  upsertLead: (lead: Lead) => void;
  deleteLead: (id: string) => void;

  setActivities: (activities: LeadActivity[]) => void;
  upsertActivity: (activity: LeadActivity) => void;
  deleteActivity: (id: string) => void;
  
  updatePresence: (presence: UserPresence) => void;
  removePresence: (userId: string) => void;

  // Reset
  reset: () => void;
}

export type RealtimeStore = RealtimeStoreState & RealtimeStoreActions;
