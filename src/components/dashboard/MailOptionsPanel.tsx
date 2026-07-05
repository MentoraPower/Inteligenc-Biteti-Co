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
      <div className="flex-1 overflow-y-auto px-3 pt-6 pb-4">
        {/* Big title */}
        <h2 className="text-xl font-bold px-2 mb-5">Mail</h2>

        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group.title}>
              {/* Section header (uppercase, subtle) */}
              <div className="px-2 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.title}
              </div>
              <div className="space-y-0.5">
                {group.items.map(({ label, path, isActive, dev }) => (
                  <button
                    key={path || label}
                    onClick={() => !dev && navigate(path)}
                    disabled={dev}
                    className={cn(
                      "w-full py-2 px-3 rounded-lg text-sm text-left transition-colors truncate flex items-center justify-between gap-2",
                      dev
                        ? "text-foreground/40 cursor-not-allowed"
                        : isActive
                        ? "bg-muted font-semibold text-foreground"
                        : "text-foreground/80 hover:bg-accent"
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
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
