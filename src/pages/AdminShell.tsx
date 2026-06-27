import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Outlet, useNavigate } from "react-router-dom";
import { StatusBanner } from "@/components/StatusBanner";
import { WorkspaceDropdown } from "@/components/workspace/WorkspaceDropdown";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { ThemeToggle } from "@/components/ThemeToggle";

function TopNavbar() {
  const navigate = useNavigate();
  const [userName, setUserName] = useState<string>("");
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchUserInfo = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .single();
      
      setUserName(profile?.name || user.email?.split('@')[0] || "Usuário");
    };
    fetchUserInfo();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <>
      <div 
        className="fixed top-0 left-0 right-0 z-50 h-[60px] bg-card flex items-center justify-between px-0 border-b border-border"
      >
        <WorkspaceDropdown />
        
        {/* Center slot for page-specific content (e.g., search) */}
        <div id="navbar-center-slot" className="flex-1 flex items-center justify-center max-w-md mx-4" />
        
        {/* Right side actions */}
        <div className="flex items-center gap-3 pr-3">
          <ThemeToggle />
          
          {/* Profile Avatar */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setProfileMenuOpen(!profileMenuOpen)}
              className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-accent transition-colors"
            >
              <User className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            </button>
            
            {/* Dropdown */}
            <div 
              className={cn(
                "absolute right-0 top-full mt-2 w-48 bg-card rounded-xl shadow-xl overflow-hidden transition-all duration-200 origin-top-right border border-border",
                profileMenuOpen ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
              )}
            >
              <div className="px-3 py-2 border-b border-border">
                <p className="text-sm font-medium text-foreground truncate">{userName}</p>
              </div>
              
              <div className="p-1">
                <button
                  onClick={() => {
                    setProfileMenuOpen(false);
                    setSettingsOpen(true);
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground rounded-lg transition-colors"
                >
                  <Settings className="h-4 w-4" />
                  Configurações
                </button>
                
                <button
                  onClick={async () => {
                    await supabase.auth.signOut();
                    navigate("/auth");
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Sair
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}

export default function AdminShell() {
  return (
    <>
      <TopNavbar />
      <div className="pt-[60px]">
        <StatusBanner />
        <DashboardLayout>
          <Outlet />
        </DashboardLayout>
      </div>
    </>
  );
}
