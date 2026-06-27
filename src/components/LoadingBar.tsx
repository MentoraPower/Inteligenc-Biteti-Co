import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

export const LoadingBar = () => {
  const [isLoading, setIsLoading] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => setIsLoading(false), 1200);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  if (!isLoading) return null;

  return (
    <div className="fixed top-0 left-0 right-0 h-[3px] z-[99999] overflow-hidden pointer-events-none bg-transparent">
      <div 
        className="h-full w-full animate-loading-progress"
        style={{
          background: "linear-gradient(90deg, transparent 0%, hsl(var(--primary)) 20%, hsl(var(--primary)) 80%, transparent 100%)",
        }}
      />
    </div>
  );
};
