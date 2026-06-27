import { useState, useEffect, memo } from "react";
import { AlertTriangle, X, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface StatusBannerProps {
  className?: string;
}

export const StatusBanner = memo(function StatusBanner({ className }: StatusBannerProps) {
  const [hasIssue, setHasIssue] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);

  useEffect(() => {
    // Check if user already dismissed in this session
    const dismissed = sessionStorage.getItem('status_banner_dismissed');
    if (dismissed) {
      setIsDismissed(true);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    let checkInterval: NodeJS.Timeout;

    const checkConnection = async () => {
      try {
        // Simple health check - try to fetch a minimal query
        const startTime = Date.now();
        const { error } = await supabase
          .from("crm_origins")
          .select("id", { count: "exact", head: true });
        
        const responseTime = Date.now() - startTime;

        if (isMounted) {
          // Consider it an issue if there's an error or response is very slow (>5s)
          if (error || responseTime > 5000) {
            setFailedAttempts(prev => {
              const newCount = prev + 1;
              // Only show banner after 2 consecutive failures
              if (newCount >= 2) {
                setHasIssue(true);
              }
              return newCount;
            });
          } else {
            setFailedAttempts(0);
            setHasIssue(false);
          }
        }
      } catch (err) {
        if (isMounted) {
          setFailedAttempts(prev => {
            const newCount = prev + 1;
            if (newCount >= 2) {
              setHasIssue(true);
            }
            return newCount;
          });
        }
      }
    };

    // Initial check after a delay (increased to 5s)
    const initialTimeout = setTimeout(checkConnection, 5000);
    
    // Check every 60 seconds (reduced from 30s)
    checkInterval = setInterval(checkConnection, 60000);

    return () => {
      isMounted = false;
      clearTimeout(initialTimeout);
      clearInterval(checkInterval);
    };
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem('status_banner_dismissed', 'true');
  };

  if (!hasIssue || isDismissed) {
    return null;
  }

  return (
    <div
      className={cn(
        "w-full bg-amber-500/90 backdrop-blur-sm text-amber-950 py-2 px-4 flex items-center justify-center gap-3 text-sm font-medium relative z-[100] animate-in slide-in-from-top duration-300",
        className
      )}
    >
      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
      <span className="text-center">
        Estamos enfrentando instabilidade com nosso provedor de dados. Algumas funcionalidades podem estar lentas ou indisponíveis.
      </span>
      <a
        href="https://status.supabase.com/"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 underline hover:no-underline flex-shrink-0 font-semibold"
      >
        Ver status
        <ExternalLink className="h-3 w-3" />
      </a>
      <button
        onClick={handleDismiss}
        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-amber-600/20 rounded transition-colors"
        aria-label="Fechar"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
});
