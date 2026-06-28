import { memo, useRef, useMemo } from "react";
import { useSortable, AnimateLayoutChanges } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Lead, LeadTag } from "@/types/crm";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, Clock } from "lucide-react";
import { getAvatarForName } from "@/lib/avatar";
import WhatsApp from "@/components/icons/WhatsApp";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useNavigate, useSearchParams } from "react-router-dom";
import { differenceInSeconds, differenceInMinutes, differenceInHours, differenceInDays, differenceInWeeks, differenceInMonths, differenceInYears } from "date-fns";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";


interface KanbanCardProps {
  lead: Lead;
  isDragging?: boolean;
  subOriginId?: string | null;
  tags?: LeadTag[];
  
}

// Custom animateLayoutChanges - disable animations after drop for instant positioning
const animateLayoutChanges: AnimateLayoutChanges = (args) => {
  const { wasDragging } = args;
  // Nunca animar após soltar - card vai direto para posição final
  if (wasDragging) {
    return false;
  }
  return false;
};

// Format time ago in compact format
// Format a phone for display, e.g. "+55 (51) 98203-5736"
const formatPhone = (ddi?: string, number?: string): string => {
  let ddiDigits = (ddi || "").replace(/\D/g, "");
  let d = (number || "").replace(/\D/g, "");
  if (!d) return "";
  // Strip the DDI if it's embedded at the start of the number
  if (ddiDigits && d.startsWith(ddiDigits) && d.length > ddiDigits.length) {
    d = d.slice(ddiDigits.length);
  }
  // Always show a DDI — infer 55 (Brazil) when none was saved
  if (!ddiDigits) {
    if ((d.length === 12 || d.length === 13) && d.startsWith("55")) {
      d = d.slice(2);
    }
    ddiDigits = "55";
  }
  const prefix = `+${ddiDigits} `;
  if (d.length >= 10) {
    const ddd = d.slice(0, 2);
    const rest = d.slice(2);
    return `${prefix}(${ddd}) ${rest.slice(0, rest.length - 4)}-${rest.slice(rest.length - 4)}`;
  }
  if (d.length >= 8) {
    return `${prefix}${d.slice(0, d.length - 4)}-${d.slice(d.length - 4)}`;
  }
  return `${prefix}${d}`.trim();
};

// Tag color at a given opacity (background uses the tag color at ~15%)
const tagColorAlpha = (hex: string, alpha: number): string => {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex || "");
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

const formatTimeAgo = (date: Date): string => {
  const now = new Date();

  const years = differenceInYears(now, date);
  if (years > 0) return `${years} Ano${years > 1 ? "s" : ""}`;

  const months = differenceInMonths(now, date);
  if (months > 0) return `${months} ${months > 1 ? "Meses" : "Mês"}`;

  const weeks = differenceInWeeks(now, date);
  if (weeks > 0) return `${weeks} Semana${weeks > 1 ? "s" : ""}`;

  const days = differenceInDays(now, date);
  if (days > 0) return `${days} Dia${days > 1 ? "s" : ""}`;

  const hours = differenceInHours(now, date);
  if (hours > 0) return `${hours}h`;

  const minutes = differenceInMinutes(now, date);
  if (minutes > 0) return `${minutes}m`;

  const seconds = differenceInSeconds(now, date);
  if (seconds > 0) return `${seconds}s`;

  return "agora";
};

export const KanbanCard = memo(function KanbanCard({ lead, isDragging: isDraggingOverlay, subOriginId, tags = [] }: KanbanCardProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const wasDragged = useRef(false);
  
  // Tags to display
  const visibleTags = tags.slice(0, 2);
  const extraTags = tags.slice(2);
  const hasExtraTags = extraTags.length > 0;
  
  // Memoize time ago to avoid recalculation on every render
  const timeAgo = useMemo(() => formatTimeAgo(new Date(lead.created_at)), [lead.created_at]);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useSortable({ 
    id: lead.id,
    animateLayoutChanges,
  });

  // Posicionamento instantâneo sem animação
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: undefined,
    opacity: isDragging ? 0 : 1,
    position: 'relative',
    zIndex: isDragging ? 0 : 1,
  };

  const isBeingDragged = isDraggingOverlay;

  const handlePointerDown = (e: React.PointerEvent) => {
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    wasDragged.current = false;
    listeners?.onPointerDown?.(e as any);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragStartPos.current) {
      const dx = Math.abs(e.clientX - dragStartPos.current.x);
      const dy = Math.abs(e.clientY - dragStartPos.current.y);
      if (dx > 5 || dy > 5) {
        wasDragged.current = true;
      }
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!wasDragged.current && !isDragging) {
      e.stopPropagation();
      const params = new URLSearchParams();
      if (subOriginId) params.set("origin", subOriginId);
      const searchQuery = searchParams.get("search");
      if (searchQuery) params.set("search", searchQuery);
      params.set("view", "quadro");
      const queryString = params.toString();
      const url = `/crm/${lead.id}${queryString ? `?${queryString}` : ''}`;
      navigate(url);
    }
    dragStartPos.current = null;
    wasDragged.current = false;
  };

  const hasWhatsapp = lead.whatsapp && lead.whatsapp.trim() !== "";
  const hasEmail = lead.email && lead.email.trim() !== "";
  // Phone with country code (DDI), e.g. "+55 11999999999"
  const phoneWithDdi = formatPhone(lead.country_code, lead.whatsapp);

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      data-lead-id={lead.id}
      className={`
        cursor-grab active:cursor-grabbing bg-zinc-50 dark:bg-zinc-950 shadow-none select-none touch-none
        border-0 dark:border dark:border-white/10 rounded-xl h-full
        ${isBeingDragged ? "opacity-100 scale-[1.02]" : ""}
      `}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onClick={handleClick}
    >
      <CardContent className="p-4 flex flex-col h-full">
        {/* Top: avatar (left) + name + contact (right) */}
        <div className="flex items-start gap-3 min-w-0">
          <img
            src={getAvatarForName(lead.name)}
            alt=""
            loading="lazy"
            className="w-10 h-10 rounded-lg object-cover flex-shrink-0 select-none pointer-events-none"
          />
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-[15px] leading-tight truncate">{lead.name}</h3>
            {/* phone (with DDI) — placeholder keeps all cards the same height */}
            <div className="flex items-center gap-1.5 text-[13px] mt-1 min-w-0">
              <WhatsApp className={`w-3.5 h-3.5 flex-shrink-0 ${hasWhatsapp ? "text-muted-foreground" : "text-muted-foreground/40"}`} />
              <span className={`truncate font-semibold ${hasWhatsapp ? "text-foreground/80" : "text-muted-foreground/40"}`}>
                {hasWhatsapp ? phoneWithDdi : "Sem número"}
              </span>
            </div>
            {/* email */}
            <div className="flex items-center gap-1.5 text-[13px] min-w-0">
              <Mail className={`w-3.5 h-3.5 flex-shrink-0 ${hasEmail ? "text-muted-foreground" : "text-muted-foreground/40"}`} />
              <span className={`truncate font-semibold ${hasEmail ? "text-foreground/80" : "text-muted-foreground/40"}`}>
                {hasEmail ? lead.email : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Bottom block (separator + time & tags on the same line), pinned to the bottom */}
        <div className="mt-auto">
          <div className="h-px -mx-4 mb-3 bg-[#00000015] dark:bg-[#ffffff15]" />
          <div className="flex items-center justify-between gap-2 min-w-0">
            {/* Time (left) */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-shrink-0">
              <Clock className="w-3.5 h-3.5" />
              <span className="font-semibold">{timeAgo}</span>
            </div>
            {/* Tags in the corner: first tag + "+N" circle (hover shows the rest) */}
            {tags.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-hidden min-w-0 justify-end">
                <span
                  className="text-[10px] px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wide whitespace-nowrap truncate"
                  style={{ backgroundColor: tagColorAlpha(tags[0].color, 0.25), color: tags[0].color }}
                >
                  {tags[0].name}
                </span>
                {tags.length > 1 && (
                  <TooltipProvider delayDuration={80}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center justify-center h-[18px] min-w-[18px] px-1 rounded-full bg-muted text-foreground/70 text-[10px] font-bold cursor-default flex-shrink-0"
                        >
                          +{tags.length - 1}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" align="end" className="flex flex-col items-start gap-1 p-2 max-w-[200px]">
                        {tags.slice(1).map((tag) => (
                          <span
                            key={tag.id}
                            className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide whitespace-nowrap"
                            style={{ backgroundColor: tagColorAlpha(tag.color, 0.25), color: tag.color }}
                          >
                            {tag.name}
                          </span>
                        ))}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
