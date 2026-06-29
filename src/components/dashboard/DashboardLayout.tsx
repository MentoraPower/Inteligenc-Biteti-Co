import { useState, useCallback, useEffect, memo, useRef, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, LogOut, LayoutGrid, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { CRMOriginsPanel } from "./CRMOriginsPanel";
import { PageTransition } from "./PageTransition";
import { LoadingBar } from "@/components/LoadingBar";
import { ConnectionStatus } from "@/components/realtime/ConnectionStatus";
import { supabase } from "@/integrations/supabase/client";
import { originIdToSlug, slugify } from "@/lib/origin-slugs";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useIsDesktop } from "@/hooks/use-mobile";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

type ActivePanel = 'none' | 'crm' | 'settings';

// Load panel state from localStorage
const getInitialPanelState = (): ActivePanel => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('active_panel');
    if (saved === 'crm') {
      return saved as ActivePanel;
    }
  }
  return 'crm'; // Default to CRM
};

let globalActivePanel: ActivePanel = getInitialPanelState();

// Memoized route content to prevent re-renders when submenu toggles
const RouteContentMemo = memo(function RouteContentMemo({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
});

// Memoized CRM Origins Panel wrapper
const MemoizedCRMOriginsPanel = memo(CRMOriginsPanel);

const DashboardLayout = memo(function DashboardLayout({ children }: DashboardLayoutProps) {
  const { currentWorkspace } = useWorkspace();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<ActivePanel>(globalActivePanel);
  const location = useLocation();
  const navigate = useNavigate();
  const sidebarRef = useRef<HTMLElement>(null);
  const isDesktop = useIsDesktop();

  const isCRMActive = location.pathname.startsWith("/crm") || location.pathname === "/";
  const isSettingsActive = location.pathname === "/settings";

  // Initialize submenu states directly from localStorage (no animation on refresh)
  const getInitialCrmSubmenuState = () => {
    if (typeof window === 'undefined') return false;
    const savedCrm = localStorage.getItem('crm_submenu_open');
    return savedCrm !== 'false' && 
      (window.location.pathname.startsWith("/crm") || window.location.pathname === "/");
  };
  
  const [crmSubmenuOpen, setCrmSubmenuOpen] = useState(getInitialCrmSubmenuState);
  
  // Track if submenus were restored from storage (skip animation)
  const [crmSubmenuRestored] = useState(getInitialCrmSubmenuState);
  const [animationsEnabled, setAnimationsEnabled] = useState(false);
  
  // Enable animations after first render
  useEffect(() => {
    const timer = requestAnimationFrame(() => setAnimationsEnabled(true));
    return () => cancelAnimationFrame(timer);
  }, []);

  // Stable onClose callbacks to prevent re-renders
  const handleCloseCrmSubmenu = useCallback(() => {
    setCrmSubmenuOpen(false);
  }, []);

  // Persist submenu states to localStorage
  useEffect(() => {
    localStorage.setItem('crm_submenu_open', String(crmSubmenuOpen));
  }, [crmSubmenuOpen]);

  // Sync activePanel with current route (without forcing submenu open)
  useEffect(() => {
    if (isSettingsActive && activePanel !== 'settings') {
      setActivePanel('settings');
    } else if (isCRMActive && activePanel !== 'crm') {
      setActivePanel('crm');
    }
  }, [location.pathname, isCRMActive, isSettingsActive]);


  // Sync with global state and localStorage (without affecting submenu)
  useEffect(() => {
    globalActivePanel = activePanel;
    localStorage.setItem('active_panel', activePanel);
  }, [activePanel]);

  // Navigate to CRM immediately using last used origin for instant load
  const handleNavClick = useCallback((panelId: ActivePanel) => {
    setActivePanel(panelId);

    if (panelId === 'crm') {
      // Toggle: if already on CRM and the submenu is open, close it
      if (location.pathname.startsWith('/crm') && crmSubmenuOpen) {
        setCrmSubmenuOpen(false);
        return;
      }

      setCrmSubmenuOpen(true);

      // Check if already on CRM with an origin
      const originParam = new URLSearchParams(location.search).get('origin');
      if (location.pathname.startsWith('/crm') && originParam) {
        return; // Already on CRM with origin, nothing to do
      }

      // Try to use last saved origin for instant navigation - always open in overview
      const lastOrigin = localStorage.getItem('crm_last_sub_origin');
      if (lastOrigin) {
        navigate(`/crm?origin=${lastOrigin}&view=quadro`, { replace: true });
        return;
      }

      // No last origin - navigate to CRM with overview (will show skeleton) and fetch default async
      if (!location.pathname.startsWith('/crm')) {
        navigate('/crm?view=quadro');
      }

      // Fetch default origin in background
      void (async () => {
        if (!currentWorkspace?.id) return;
        
        const { data: origins } = await supabase
          .from('crm_origins')
          .select('id')
          .eq('workspace_id', currentWorkspace.id)
          .order('ordem')
          .limit(1);

        if (!origins || origins.length === 0) return;

        const { data: subOrigins } = await supabase
          .from('crm_sub_origins')
          .select('id, nome')
          .eq('origin_id', origins[0].id)
          .order('ordem')
          .limit(1);

        if (subOrigins && subOrigins.length > 0) {
          const slug = originIdToSlug(subOrigins[0].id) || slugify(subOrigins[0].nome);
          navigate(`/crm?origin=${slug}&view=quadro`, { replace: true });
        }
      })();


      return;
    }

      setCrmSubmenuOpen(false);
  }, [location.pathname, location.search, navigate, currentWorkspace?.id, crmSubmenuOpen]);

  // Navigate when panel changes
  useEffect(() => {
    if (activePanel === 'settings' && location.pathname !== '/settings') {
      navigate('/settings');
    }
  }, [activePanel, location.pathname, navigate]);

  // Sidebar dimensions
  const sidebarCollapsedWidth = 64;
  const submenuWidth = 256;

  return (
    <div className="min-h-screen bg-background px-3 pb-3">
      <div className="min-h-[calc(100vh-0.75rem)] relative">
        <LoadingBar />
        
        {/* Mobile Header */}
        <header className="lg:hidden fixed top-[60px] left-0 right-0 h-14 bg-card border-b border-border z-50 flex items-center justify-between px-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-muted rounded-xl transition-colors"
          >
            {sidebarOpen ? (
              <X className="h-5 w-5 text-foreground" />
            ) : (
              <Menu className="h-5 w-5 text-foreground" />
            )}
          </button>
          <div className="w-9" />
        </header>

        {/* Desktop Sidebar - Black background, CSS-only hover expansion */}
        <aside
          ref={sidebarRef}
          style={{
            left: 0,
            top: '60px',
            height: 'calc(100vh - 60px)',
          }}
          className="group hidden lg:flex flex-col fixed bg-card border-r border-border overflow-hidden z-50 w-16 hover:w-[180px] transition-[width] duration-200 ease-out"
        >
          <div className="flex flex-col h-full relative">
            {/* Top spacing (logo removed) */}
            <div className="h-4" />

            <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-2">
              <div className="flex flex-col gap-2">
                {/* CRM Button */}
                <button
                  onClick={() => handleNavClick('crm')}
                  className={cn(
                    "relative flex items-center h-10 rounded-lg transition-all duration-200",
                    activePanel === 'crm'
                      ? "bg-accent text-foreground before:absolute before:-left-3 before:top-1/2 before:-translate-y-1/2 before:h-[70%] before:w-1.5 before:rounded-r-full before:bg-gradient-to-b before:from-orange-500 before:to-amber-500"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <div className="w-10 flex items-center justify-center flex-shrink-0">
                    <LayoutGrid className="h-5 w-5" strokeWidth={1.5} />
                  </div>
                  <span className="text-sm font-medium whitespace-nowrap transition-all duration-200 overflow-hidden opacity-0 w-0 group-hover:opacity-100 group-hover:w-auto">
                    Espaços
                  </span>
                </button>

              </div>
            </nav>
          </div>
        </aside>

        {/* CRM Submenu Clip Container - clips the submenu animation */}
        <div
          style={{
            left: sidebarCollapsedWidth - 16,
            top: '60px',
            height: 'calc(100vh - 60px)',
            width: submenuWidth + 16 + 4,
            zIndex: 39,
            pointerEvents: crmSubmenuOpen ? 'auto' : 'none',
          }}
          className="hidden lg:block fixed overflow-hidden"
        >
          {/* CRM Submenu Panel - animated inside clip container */}
          <div
            style={{
              width: submenuWidth + 16,
              transform: crmSubmenuOpen ? 'translateX(0px)' : `translateX(-${submenuWidth + 16}px)`,
              willChange: animationsEnabled ? 'transform' : 'auto',
              paddingLeft: 16,
            }}
            className={cn(
              "h-full overflow-hidden",
              animationsEnabled && "transition-transform duration-500 ease-[cubic-bezier(0.25,0.1,0.25,1)]"
            )}
          >
            <div className="h-full bg-background border border-border border-t-0 border-l-0 overflow-hidden">
              <div
                className={cn(
                  "h-full",
                  animationsEnabled && "transition-opacity duration-400"
                )}
                style={{
                  width: submenuWidth,
                  minWidth: submenuWidth,
                  opacity: crmSubmenuOpen ? 1 : 0,
                  transitionDelay: (animationsEnabled && crmSubmenuOpen) ? '80ms' : '0ms',
                }}
              >
                <div className="h-full px-2 py-2">
                  <MemoizedCRMOriginsPanel
                    isOpen={crmSubmenuOpen}
                    onClose={handleCloseCrmSubmenu}
                    sidebarWidth={sidebarCollapsedWidth}
                    embedded={true}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>


        {/* Floating button to reopen CRM submenu when closed */}
        {isCRMActive && !crmSubmenuOpen && (
          <button
            onClick={() => setCrmSubmenuOpen(true)}
            style={{ 
              left: sidebarCollapsedWidth - 4,
              zIndex: 40,
            }}
            className="hidden lg:flex fixed top-1/2 -translate-y-1/2 w-5 h-10 items-center justify-center bg-zinc-900 rounded-r-md hover:bg-zinc-800 transition-colors shadow-md"
          >
            <ChevronRight className="w-3 h-3 text-white" />
          </button>
        )}


        {/* Mobile Sidebar */}
        <aside
          className={cn(
            "lg:hidden fixed left-0 bottom-0 w-64 bg-black border-r border-white/10 z-40 transform transition-transform duration-300 ease-in-out",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
          style={{ top: 'calc(60px + 56px)' }}
        >
          <div className="flex flex-col h-full py-4">
            <nav className="flex-1 px-2 overflow-y-auto">
              <div className="flex flex-col gap-1">
                {/* CRM Button - Mobile */}
                <button
                  onClick={() => {
                    handleNavClick('crm');
                  }}
                  className={cn(
                    "relative flex items-center w-full rounded-xl transition-colors duration-200 px-4 py-3 gap-3",
                    isCRMActive
                      ? "bg-white/10 text-white before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-[70%] before:w-1.5 before:rounded-r-full before:bg-gradient-to-b before:from-orange-500 before:to-amber-500"
                      : "text-white/60 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <LayoutGrid className="h-5 w-5 flex-shrink-0" strokeWidth={1.5} />
                  <span className="text-sm font-medium whitespace-nowrap">
                    CRM
                  </span>
                </button>
                

              </div>
            </nav>

            {/* Logout - Mobile */}
            <div className="border-t border-white/10 p-3">
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  navigate("/auth");
                }}
                className="relative flex items-center w-full rounded-xl transition-colors duration-200 px-4 py-3 gap-3 text-white/60 hover:bg-red-500/20 hover:text-red-400"
              >
                <LogOut className="h-5 w-5 flex-shrink-0" strokeWidth={1.5} />
                <span className="text-sm font-medium whitespace-nowrap">
                  Sair
                </span>
              </button>
            </div>
          </div>
        </aside>

        {/* Mobile Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content - Conditionally render only ONE to avoid duplicate children mounts */}
        {isDesktop ? (
          <main 
            style={{ 
              left: crmSubmenuOpen 
                ? sidebarCollapsedWidth - 16 + submenuWidth + 16 + 4
                : sidebarCollapsedWidth + 8,
              top: '49px',
              right: 0,
              height: 'calc(100vh - 49px)',
              willChange: 'left',
            }}
            className="fixed transition-[left] duration-500 ease-[cubic-bezier(0.25,0.1,0.25,1)]"
          >
            <div className="h-full overflow-hidden relative flex flex-col bg-card pt-1 pb-3 px-3">
              <PageTransition>
                <RouteContentMemo>
                  {children}
                </RouteContentMemo>
              </PageTransition>
            </div>
          </main>
        ) : (
          <main className="pt-[calc(60px+56px)] min-h-screen p-4">
            <PageTransition>
              {children}
            </PageTransition>
          </main>
        )}
      </div>
    </div>
  );
});

export default DashboardLayout;
