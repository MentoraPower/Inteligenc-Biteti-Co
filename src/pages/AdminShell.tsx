import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Outlet, useNavigate } from "react-router-dom";
import { StatusBanner } from "@/components/StatusBanner";
import { WorkspaceDropdown } from "@/components/workspace/WorkspaceDropdown";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, LogOut, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MobileBlock } from "@/components/MobileBlock";
import { isMobilePhone } from "@/lib/device";
import { ProfileDialog } from "@/components/profile/ProfileDialog";

function TopNavbar() {
  const navigate = useNavigate();
  const [userName, setUserName] = useState<string>("");
  const [photoUrl, setPhotoUrl] = useState<string>("");
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchUserInfo = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, photo_url')
      .eq('id', user.id)
      .single();
    setUserName(profile?.name || user.email?.split('@')[0] || "Usuário");
    setPhotoUrl(profile?.photo_url || "");
  };

  useEffect(() => {
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
        className="fixed top-0 left-0 right-0 z-50 h-[60px] bg-zinc-900 dark:bg-zinc-800 flex items-center justify-between px-0"
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
              className="w-8 h-8 rounded-full bg-white/10 overflow-hidden flex items-center justify-center hover:ring-2 hover:ring-white/20 transition-all"
            >
              {photoUrl ? (
                <img src={photoUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <User className="h-4 w-4 text-zinc-300" strokeWidth={1.5} />
              )}
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
                  onClick={() => { setProfileMenuOpen(false); setProfileDialogOpen(true); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground rounded-lg transition-colors"
                >
                  <Settings2 className="h-4 w-4" />
                  Perfil
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

      <ProfileDialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen} onUpdated={fetchUserInfo} />
    </>
  );
}

export default function AdminShell() {
  // Block access on mobile phones — by device, not by screen size.
  if (isMobilePhone()) {
    return <MobileBlock />;
  }

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
