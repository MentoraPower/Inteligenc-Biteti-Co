import { memo, useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Lead, Pipeline, LeadTag } from "@/types/crm";
import { KanbanCard } from "./KanbanCard";
import { InlineAddContact } from "./InlineAddContact";

interface DropIndicator {
  pipelineId: string;
  position: "top" | "bottom";
  targetLeadId?: string;
}

interface KanbanColumnProps {
  pipeline: Pipeline;
  leads: Lead[];
  leadCount?: number;
  isOver?: boolean;
  subOriginId?: string | null;
  activeId?: string | null;
  dropIndicator?: DropIndicator | null;
  activePipelineId?: string | null;
  tagsMap?: Map<string, LeadTag[]>;
}

export const KanbanColumn = memo(function KanbanColumn({ 
  pipeline, 
  leads, 
  leadCount,
  isOver, 
  subOriginId,
  activeId,
  dropIndicator,
  activePipelineId,
  tagsMap,
}: KanbanColumnProps) {
  // Use exact count if provided, fallback to leads array length
  const displayCount = leadCount !== undefined ? leadCount : leads.length;
  const { setNodeRef } = useDroppable({
    id: pipeline.id,
  });

  // Check if column is being targeted for drop
  const isTargeted = isOver || (dropIndicator?.pipelineId === pipeline.id);
  
  // Check if this is a cross-pipeline drag (card coming from different pipeline)
  const isCrossPipelineDrag = activeId && activePipelineId && activePipelineId !== pipeline.id;
  
  // Only show placeholder in EMPTY columns to avoid layout "bounce" when dropping
  const showTopPlaceholder = isTargeted && isCrossPipelineDrag && leads.length === 0;

  // IDs for SortableContext - must include all items
  const leadIds = useMemo(() => leads.map(l => l.id), [leads]);

  return (
    <div className="flex-shrink-0 w-80 flex flex-col min-h-0 relative">
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-0 rounded-xl rounded-b-none border border-b-0 transition-colors duration-100 flex flex-col overflow-hidden ${
          isTargeted
            ? "bg-accent/50 border-border border-dashed"
            : "bg-muted/40 border-border"
        }`}
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-2 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-sm text-foreground">{pipeline.nome}</h2>
            <span className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
              isTargeted 
                ? "bg-accent text-foreground" 
                : "text-muted-foreground bg-muted"
            }`}>
              {displayCount.toLocaleString('pt-BR')}
            </span>
          </div>
          <InlineAddContact pipelineId={pipeline.id} subOriginId={subOriginId || null} />
        </div>

        {/* Cards container */}
        <div className="p-3 flex-1 overflow-y-auto">
          <SortableContext
            items={leadIds}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2 pb-12">
              {/* Top placeholder for cross-pipeline drag (only when column is empty) */}
              {showTopPlaceholder && (
                <div className="mb-2">
                  <div className="h-[100px] rounded-lg border-2 border-dashed border-border bg-accent/30" />
                </div>
              )}

              {leads.map((lead) => (
                <KanbanCard 
                  key={lead.id}
                  lead={lead} 
                  subOriginId={subOriginId}
                  tags={tagsMap?.get(lead.id) || []}
                />
              ))}

              {/* Empty state */}
              {leads.length === 0 && !showTopPlaceholder && (
                <div className={`text-center text-sm py-8 rounded-lg border-2 border-dashed transition-colors duration-100 ${
                  isTargeted 
                    ? "border-border text-foreground bg-accent/30" 
                    : "border-transparent text-muted-foreground"
                }`}>
                  {isTargeted ? "Solte aqui" : "Nenhum lead"}
                </div>
              )}
            </div>
          </SortableContext>
        </div>
      </div>
      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent pointer-events-none rounded-b-xl" />
    </div>
  );
});