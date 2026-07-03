import { useLocation, useNavigate } from "react-router-dom";
import { Workflow, LayoutTemplate } from "lucide-react";
import { cn } from "@/lib/utils";

// Simple options submenu for the Mail section (mirrors the Espaços submenu visually,
// but with a flat list of options instead of origins/sub-origins).
export function MailOptionsPanel() {
  const location = useLocation();
  const navigate = useNavigate();

  const options = [
    {
      label: "Automações",
      icon: Workflow,
      path: "/mail",
      isActive: location.pathname === "/mail",
    },
    {
      label: "Templates",
      icon: LayoutTemplate,
      path: "/mail/templates",
      isActive: location.pathname.startsWith("/mail/templates"),
    },
  ];

  return (
    <div className="h-full flex flex-col bg-background text-foreground">
      {/* Options list */}
      <div className="flex-1 overflow-y-auto px-2 pt-4 pb-3 space-y-1">
        {options.map(({ label, icon: Icon, path, isActive }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className={cn(
              "flex items-center gap-2.5 w-full py-2.5 px-3 rounded-lg text-sm transition-colors",
              isActive
                ? "bg-accent text-foreground"
                : "text-foreground/70 hover:text-foreground hover:bg-accent"
            )}
          >
            <Icon
              className={cn(
                "h-4 w-4 flex-shrink-0",
                isActive ? "text-purple-700" : "text-foreground/60"
              )}
            />
            <span
              className={cn(
                "truncate font-bold",
                isActive &&
                  "bg-gradient-to-r from-purple-700 to-purple-900 bg-clip-text text-transparent"
              )}
            >
              {label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
