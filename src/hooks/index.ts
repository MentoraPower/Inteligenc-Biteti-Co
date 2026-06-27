/**
 * Hooks Index
 * Central export for all custom hooks
 */

// Real-time hooks
export { useLeadActivities } from './use-lead-activities';

// Real-time selectors
export {
  useConnectionState,
  useIsConnected,
  useReconnectAttempts,
  useIsTabActive,
  useMessage,
  useMessagesByChatId,
  useMessageIds,
  useMessagesCount,
  useConversation,
  useSortedConversations,
  useConversationIds,
  useConversationsCount,
  useUnreadConversationsCount,
  useLead,
  useLeadsByPipelineId,
  useAllLeads,
  useLeadIds,
  useLeadsCount,
  useActivity,
  useActivitiesByLeadId,
  useAllActivities,
  usePendingActivitiesCount,
  useUserPresence,
  useOnlineUsers,
  useOnlineUsersCount,
  useRealtimeActions,
} from './useRealtimeSelectors';

// Utility hooks
export { useIsMobile } from './use-mobile';
export { useToast, toast } from './use-toast';
export { useAnimatedNumber } from './use-animated-number';
export { useAuth } from './useAuth';
