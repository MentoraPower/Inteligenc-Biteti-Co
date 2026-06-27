import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { UserCircle, Check, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface TeamMember {
  id: string;
  name: string | null;
  email: string | null;
  user_id: string;
  photo_url: string | null;
}

interface AssignMemberDropdownProps {
  leadId: string;
  assignedTo?: string | null;
  onAssign?: (userId: string | null) => void;
  size?: "sm" | "default";
}

export function AssignMemberDropdown({ leadId, assignedTo, onAssign, size = "default" }: AssignMemberDropdownProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: teamMembers, isLoading } = useQuery({
    queryKey: ["team-members-list"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("list-team-members");
      if (error) throw new Error(error.message);
      return (data?.members || []) as TeamMember[];
    },
    staleTime: 60000, // 60 seconds - team members rarely change
    gcTime: 300000,   // 5 minutes - keep in cache longer
  });

  const assignMutation = useMutation({
    mutationFn: async (userId: string | null) => {
      const { error } = await supabase
        .from("leads")
        .update({ assigned_to: userId })
        .eq("id", leadId);
      if (error) throw error;
      return userId;
    },
    onSuccess: (userId) => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      onAssign?.(userId);
      setOpen(false);
    },
  });

  const assignedMember = teamMembers?.find(m => m.user_id === assignedTo);

  const handleSelect = (userId: string | null) => {
    assignMutation.mutate(userId);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
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
          title={assignedMember?.name || "Atribuir responsável"}
        >
          {assignedMember?.photo_url ? (
            <img 
              src={assignedMember.photo_url} 
              alt={assignedMember.name || ""}
              className={cn(
                "object-cover",
                size === "sm" ? "w-5 h-5 rounded-full" : "w-full h-full rounded-lg"
              )}
            />
          ) : assignedMember?.name ? (
            <span className={cn(
              "font-bold uppercase",
              size === "sm" ? "text-[8px]" : "text-xs"
            )}>
              {assignedMember.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
            </span>
          ) : (
            <UserCircle className={cn(size === "sm" ? "w-3 h-3" : "w-4 h-4")} strokeWidth={1.5} />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent 
        side="bottom" 
        align="end"
        className="w-48 p-1 bg-popover border border-border/60 dark:border-white/15 shadow-lg z-50"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-xs text-muted-foreground px-2 py-1.5 font-medium">Atribuir responsável</p>
        
        {isLoading ? (
          <div className="px-2 py-3 text-center text-xs text-muted-foreground">
            Carregando...
          </div>
        ) : (
          <div className="max-h-48 overflow-y-auto">
            {/* Unassign option */}
            {assignedTo && (
              <button
                onClick={() => handleSelect(null)}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-slate-100 rounded-md transition-colors text-destructive"
              >
                <X className="w-3.5 h-3.5" />
                <span>Remover responsável</span>
              </button>
            )}
            
            {teamMembers?.map((member) => (
              <button
                key={member.user_id}
                onClick={() => handleSelect(member.user_id)}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-slate-100 rounded-md transition-colors",
                  assignedTo === member.user_id && "bg-slate-100"
                )}
              >
                {member.photo_url ? (
                  <img 
                    src={member.photo_url} 
                    alt={member.name || ""}
                    className="w-5 h-5 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                    <span className="text-[8px] font-semibold text-slate-600 uppercase">
                      {member.name?.split(' ').map(n => n[0]).slice(0, 2).join('') || '?'}
                    </span>
                  </div>
                )}
                <span className="truncate flex-1 text-left">{member.name || member.email || "Sem nome"}</span>
                {assignedTo === member.user_id && (
                  <Check className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
                )}
              </button>
            ))}
            
            {teamMembers?.length === 0 && (
              <div className="px-2 py-3 text-center text-xs text-muted-foreground">
                Nenhum membro encontrado
              </div>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
