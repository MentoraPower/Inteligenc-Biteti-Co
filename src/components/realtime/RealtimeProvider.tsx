/**
 * Real-time Provider
 * Initializes real-time subscriptions at app root level
 */

import { useEffect, useRef, ReactNode } from 'react';
import { initializeRealtime, destroyRealtime } from '@/lib/realtime';

interface RealtimeProviderProps {
  children: ReactNode;
}

export function RealtimeProvider({ children }: RealtimeProviderProps) {
  const initializedRef = useRef(false);

  useEffect(() => {
    // Prevent double initialization in StrictMode
    if (initializedRef.current) return;
    
    console.log('[RealtimeProvider] Initializing real-time system');
    initializeRealtime();
    initializedRef.current = true;

    return () => {
      console.log('[RealtimeProvider] Cleaning up real-time system');
      destroyRealtime();
      initializedRef.current = false;
    };
  }, []);

  return <>{children}</>;
}

export default RealtimeProvider;
