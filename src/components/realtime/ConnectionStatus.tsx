/**
 * Connection Status Indicator
 * Shows current real-time connection status
 */

import { memo } from 'react';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useConnectionState, useReconnectAttempts } from '@/hooks/useRealtimeSelectors';
import { reconnectRealtime } from '@/lib/realtime';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ConnectionStatusProps {
  className?: string;
  showLabel?: boolean;
}

export const ConnectionStatus = memo(function ConnectionStatus({
  className,
  showLabel = false,
}: ConnectionStatusProps) {
  const connectionState = useConnectionState();
  const reconnectAttempts = useReconnectAttempts();

  const getStatusInfo = () => {
    switch (connectionState) {
      case 'connected':
        return {
          icon: <Wifi className="h-4 w-4" />,
          label: 'Conectado',
          color: 'text-green-500',
          bgColor: 'bg-green-500/10',
        };
      case 'connecting':
        return {
          icon: <Loader2 className="h-4 w-4 animate-spin" />,
          label: 'Conectando...',
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-500/10',
        };
      case 'reconnecting':
        return {
          icon: <Loader2 className="h-4 w-4 animate-spin" />,
          label: `Reconectando (${reconnectAttempts})...`,
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-500/10',
        };
      case 'error':
        return {
          icon: <WifiOff className="h-4 w-4" />,
          label: 'Erro de conexão',
          color: 'text-destructive',
          bgColor: 'bg-destructive/10',
        };
      case 'disconnected':
      default:
        return {
          icon: <WifiOff className="h-4 w-4" />,
          label: 'Desconectado',
          color: 'text-muted-foreground',
          bgColor: 'bg-muted',
        };
    }
  };

  const status = getStatusInfo();

  const handleReconnect = () => {
    reconnectRealtime();
  };

  if (connectionState === 'connected' && !showLabel) {
    // Don't show anything when connected and label is hidden
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'flex items-center gap-2 px-2 py-1 rounded-md transition-colors',
              status.bgColor,
              className
            )}
          >
            <span className={status.color}>{status.icon}</span>
            {showLabel && (
              <span className={cn('text-xs font-medium', status.color)}>
                {status.label}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <div className="text-sm">
            <p className="font-medium">{status.label}</p>
            {connectionState === 'error' && (
              <Button
                variant="link"
                size="sm"
                onClick={handleReconnect}
                className="p-0 h-auto text-xs"
              >
                Clique para reconectar
              </Button>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

export default ConnectionStatus;
