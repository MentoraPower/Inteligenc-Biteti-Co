import { useState, memo } from "react";
import { UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface LazyAssignMemberDropdownProps {
  leadId: string;
  assignedTo?: string | null;
  onAssign?: (userId: string | null) => void;
  size?: "sm" | "default";
  // Pre-fetched assigned member info to avoid query on render
  assignedMemberName?: string | null;
  assignedMemberPhoto?: string | null;
}

// Lazy import the actual dropdown only when needed
const loadFullDropdown = () => import("./AssignMemberDropdown").then(m => m.AssignMemberDropdown);

export const LazyAssignMemberDropdown = memo(function LazyAssignMemberDropdown({ 
  leadId, 
  assignedTo, 
  onAssign, 
  size = "default",
  assignedMemberName,
  assignedMemberPhoto,
}: LazyAssignMemberDropdownProps) {
  const [isActivated, setIsActivated] = useState(false);
  const [FullDropdown, setFullDropdown] = useState<React.ComponentType<any> | null>(null);

  // When user interacts, load the real dropdown
  const handleActivate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!FullDropdown) {
      const Component = await loadFullDropdown();
      setFullDropdown(() => Component);
    }
    setIsActivated(true);
  };

  // Once loaded, render the full dropdown
  if (isActivated && FullDropdown) {
    return (
      <FullDropdown
        leadId={leadId}
        assignedTo={assignedTo}
        onAssign={onAssign}
        size={size}
      />
    );
  }

  // Placeholder button - visually identical but doesn't load useQuery
  return (
    <button
      onClick={handleActivate}
      className={cn(
        "flex items-center justify-center transition-all",
        size === "sm" 
          ? "w-5 h-5 rounded-full" 
          : "h-10 w-10 rounded-lg border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        assignedTo 
          ? "bg-gradient-to-br from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700" 
          : size === "sm"
            ? "bg-muted/60 hover:bg-muted text-muted-foreground"
            : ""
      )}
      title={assignedMemberName || "Atribuir responsável"}
    >
      {assignedMemberPhoto ? (
        <img 
          src={assignedMemberPhoto} 
          alt={assignedMemberName || ""}
          className={cn(
            "object-cover",
            size === "sm" ? "w-5 h-5 rounded-full" : "w-full h-full rounded-lg"
          )}
        />
      ) : assignedMemberName ? (
        <span className={cn(
          "font-bold uppercase",
          size === "sm" ? "text-[8px]" : "text-xs"
        )}>
          {assignedMemberName.split(' ').map(n => n[0]).slice(0, 2).join('')}
        </span>
      ) : (
        <UserCircle className={cn(size === "sm" ? "w-3 h-3" : "w-4 h-4")} strokeWidth={1.5} />
      )}
    </button>
  );
});
