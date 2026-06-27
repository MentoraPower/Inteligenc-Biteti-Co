/**
 * Event Normalizers
 * Transform raw Supabase payloads into normalized events
 */

import type {
  NormalizedEvent,
  RealtimeDomain,
  EventPriority,
  SupabaseRealtimePayload,
  Lead,
  LeadActivity,
} from './types';

// Table to domain mapping
const TABLE_DOMAIN_MAP: Record<string, RealtimeDomain> = {
  leads: 'leads',
  lead_activities: 'activities',
  pipelines: 'pipelines',
  lead_tracking: 'activities',
};

// Table to priority mapping
const TABLE_PRIORITY_MAP: Record<string, EventPriority> = {
  leads: 'normal',
  lead_activities: 'normal',
  pipelines: 'low',
};

/**
 * Extract entity ID from payload
 */
const getEntityId = (payload: SupabaseRealtimePayload): string => {
  const data = payload.new || payload.old;
  return (data as any)?.id || 'unknown';
};

/**
 * Main normalizer function
 */
export const normalizeEvent = <T>(
  payload: SupabaseRealtimePayload<T>
): NormalizedEvent<T> | null => {
  const domain = TABLE_DOMAIN_MAP[payload.table];
  
  if (!domain) {
    console.warn(`[Normalizer] Unknown table: ${payload.table}`);
    return null;
  }

  const entityId = getEntityId(payload as SupabaseRealtimePayload);
  const eventType = payload.eventType.toLowerCase() as 'insert' | 'update' | 'delete';
  
  return {
    id: entityId,
    domain,
    type: eventType,
    priority: TABLE_PRIORITY_MAP[payload.table] || 'normal',
    timestamp: Date.now(),
    data: (payload.new || payload.old) as T,
    oldData: payload.old as T | undefined,
    table: payload.table,
    batchKey: getBatchKey(payload),
  };
};

/**
 * Get batch key for grouping related events
 */
const getBatchKey = (payload: SupabaseRealtimePayload): string | undefined => {
  const data = payload.new || payload.old;

  // Group activities by lead_id
  if (payload.table === 'lead_activities') {
    return `lead_${(data as LeadActivity)?.lead_id}`;
  }

  // Group leads by pipeline_id
  if (payload.table === 'leads') {
    return `pipeline_${(data as Lead)?.pipeline_id}`;
  }

  return undefined;
};

/**
 * Validate and type-check lead payload
 */
export const normalizeLead = (data: unknown): Lead | null => {
  if (!data || typeof data !== 'object') return null;

  const lead = data as Record<string, unknown>;

  if (!lead.id || !lead.name || !lead.email) return null;

  return {
    id: String(lead.id),
    name: String(lead.name),
    email: String(lead.email),
    whatsapp: String(lead.whatsapp || ''),
    instagram: String(lead.instagram || ''),
    pipeline_id: lead.pipeline_id ? String(lead.pipeline_id) : null,
    sub_origin_id: lead.sub_origin_id ? String(lead.sub_origin_id) : null,
    ordem: typeof lead.ordem === 'number' ? lead.ordem : null,
    created_at: String(lead.created_at || new Date().toISOString()),
  };
};

/**
 * Validate and type-check activity payload
 */
export const normalizeActivity = (data: unknown): LeadActivity | null => {
  if (!data || typeof data !== 'object') return null;
  
  const act = data as Record<string, unknown>;
  
  if (!act.id || !act.lead_id || !act.titulo) return null;
  
  return {
    id: String(act.id),
    lead_id: String(act.lead_id),
    titulo: String(act.titulo),
    tipo: String(act.tipo || 'task'),
    data: String(act.data || new Date().toISOString().split('T')[0]),
    hora: String(act.hora || '09:00'),
    concluida: act.concluida === true,
    notas: act.notas ? String(act.notas) : null,
    pipeline_id: act.pipeline_id ? String(act.pipeline_id) : null,
    created_at: String(act.created_at || new Date().toISOString()),
    updated_at: String(act.updated_at || new Date().toISOString()),
  };
};

/**
 * Check if event is obsolete (newer version already processed)
 */
export const isEventObsolete = (
  event: NormalizedEvent,
  existingTimestamp: number | undefined
): boolean => {
  if (!existingTimestamp) return false;
  return event.timestamp < existingTimestamp;
};

/**
 * Merge events for same entity (keep only latest)
 */
export const mergeEvents = (events: NormalizedEvent[]): NormalizedEvent[] => {
  const eventMap = new Map<string, NormalizedEvent>();
  
  events.forEach((event) => {
    const key = `${event.domain}_${event.id}`;
    const existing = eventMap.get(key);
    
    // Keep delete events or newer events
    if (!existing || event.type === 'delete' || event.timestamp > existing.timestamp) {
      eventMap.set(key, event);
    }
  });
  
  return Array.from(eventMap.values());
};
