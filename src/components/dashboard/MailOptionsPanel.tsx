import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

// Simple options submenu for the Mail section (mirrors the Espaços submenu visually,
// but with a flat list of options instead of origins/sub-origins).
export function MailOptionsPanel() {
  const location = useLocation();
  const navigate = useNavigate();

  const options = [
    { label: "Fluxo", path: "/mail", isActive: location.pathname === "/mail" },
    { label: "Disparo", path: "/mail/disparo", isActive: location.pathname.startsWith("/mail/disparo") },
    { label: "Templates", path: "/mail/templates", isActive: location.pathname.startsWith("/mail/templates") },
  ];

  return (
    <div className="h-full flex flex-col bg-background text-foreground">
      <div className="flex-1 overflow-y-auto px-3 pt-6 pb-4">
        {/* Big title */}
        <h2 className="text-xl font-bold px-2 mb-5">Mail</h2>

        <div className="space-y-0.5">
          {options.map(({ label, path, isActive }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className="group w-full py-0.5 text-left flex items-center gap-2"
            >
              <span
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-bold truncate transition-colors",
                  isActive ? "bg-muted text-foreground" : "text-foreground/80 group-hover:bg-accent"
                )}
              >
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
