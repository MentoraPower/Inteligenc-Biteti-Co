import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

// Simple options submenu for the Mail section (mirrors the Espaços submenu visually,
// but with a flat list of options instead of origins/sub-origins).
export function MailOptionsPanel() {
  const location = useLocation();
  const navigate = useNavigate();

  // Grouped by function: each block has a title and its options.
  const groups = [
    {
      title: "Automações",
      items: [
        { label: "Fluxo", path: "/mail", isActive: location.pathname === "/mail", dev: false },
        { label: "Disparo", path: "", isActive: false, dev: true },
      ],
    },
    {
      title: "Estrutura",
      items: [
        {
          label: "Templates",
          path: "/mail/templates",
          isActive: location.pathname.startsWith("/mail/templates"),
          dev: false,
        },
      ],
    },
  ];

  return (
    <div className="h-full flex flex-col bg-background text-foreground">
      {/* Options grouped in blocks */}
      <div className="flex-1 overflow-y-auto px-2 pt-4 pb-3 space-y-5">
        {groups.map((group) => (
          <div key={group.title} className="space-y-1">
            <div className="px-3 pb-1 text-[17px] font-bold text-foreground">
              {group.title}
            </div>
            {group.items.map(({ label, path, isActive, dev }) => (
              <button
                key={path || label}
                onClick={() => !dev && navigate(path)}
                disabled={dev}
                className={cn(
                  "w-full py-2.5 px-3 rounded-lg text-[15px] font-medium text-left transition-colors truncate flex items-center justify-between gap-2",
                  dev
                    ? "text-foreground/40 cursor-not-allowed"
                    : isActive
                    ? "bg-muted border border-border text-foreground"
                    : "text-foreground/70 hover:text-foreground hover:bg-accent"
                )}
              >
                <span className="truncate">{label}</span>
                {dev && (
                  <span className="flex-shrink-0 text-[9px] font-semibold uppercase tracking-wide bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                    em breve
                  </span>
                )}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
