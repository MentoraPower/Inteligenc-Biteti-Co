import { memo, useRef, useCallback, useEffect } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Lead, Pipeline, LeadTag } from "@/types/crm";
import { KanbanCard } from "./KanbanCard";
import { InlineAddContact } from "./InlineAddContact";

interface DropIndicator {
  pipelineId: string;
  position: "top" | "bottom";
  targetLeadId?: string;
}

interface VirtualizedKanbanColumnProps {
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

const CARD_HEIGHT = 140; // Approximate height of a KanbanCard
const CARD_GAP = 10;

// Disable dnd-kit's built-in item shifting — in this virtualized/absolute layout
// it only translates the inner card (leaving the slot in place), so we open the
// gap ourselves by moving the absolutely-positioned wrappers.
const noShiftStrategy = () => null;

export const VirtualizedKanbanColumn = memo(function VirtualizedKanbanColumn({ 
  pipeline, 
  leads, 
  leadCount,
  isOver, 
  subOriginId,
  activeId,
  dropIndicator,
  activePipelineId,
  tagsMap,
  
}: VirtualizedKanbanColumnProps) {
  const displayCount = leadCount !== undefined ? leadCount : leads.length;
  
  // Separate refs for droppable and scroll container
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  const { setNodeRef: setDroppableRef, isOver: isOverDroppable } = useDroppable({
    id: pipeline.id,
  });

  // Check if column is being targeted for drop
  const isTargeted = isOver || isOverDroppable || (dropIndicator?.pipelineId === pipeline.id);
  
  // Check if this is a cross-pipeline drag
  const isCrossPipelineDrag = activeId && activePipelineId && activePipelineId !== pipeline.id;
  
  // Only show placeholder in EMPTY columns
  const showTopPlaceholder = isTargeted && isCrossPipelineDrag && leads.length === 0;

  // Virtual list setup - use the scroll container ref
  const virtualizer = useVirtualizer({
    count: leads.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: useCallback(() => CARD_HEIGHT + CARD_GAP, []),
    overscan: 8, // Increase overscan to render more items above/below viewport
  });

  // Force re-measure when leads change
  useEffect(() => {
    virtualizer.measure();
  }, [leads.length, virtualizer]);

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  // ── Drag layout (opens REAL space) ──────────────────────────────────────────
  // We take manual control of the vertical layout during a drag so the cards
  // actually move apart and a card-sized dashed slot opens where the card will
  // land. All indices below are in "display" coordinates: the dragged card is
  // lifted out of the flow, so everything after it shifts up by one slot.
  const unit = CARD_HEIGHT + CARD_GAP;
  const activeIndex = activeId ? leads.findIndex((l) => l.id === activeId) : -1;
  const isActiveHere = activeIndex !== -1;

  // original index -> display index (with the dragged card removed)
  const toDisplayIndex = (origIdx: number) =>
    origIdx - (isActiveHere && origIdx > activeIndex ? 1 : 0);

  // gapIndex = where the dashed slot opens, in display coordinates (null = no gap)
  const gapIndex: number | null = (() => {
    if (!dropIndicator || dropIndicator.pipelineId !== pipeline.id || leads.length === 0) {
      return null;
    }
    if (dropIndicator.targetLeadId) {
      const t = leads.findIndex((l) => l.id === dropIndicator.targetLeadId);
      if (t === -1) return null;
      const td = toDisplayIndex(t);
      return dropIndicator.position === "bottom" ? td + 1 : td;
    }
    const flowCount = leads.length - (isActiveHere ? 1 : 0);
    return dropIndicator.position === "bottom" ? flowCount : 0;
  })();
  const showGap = gapIndex !== null;

  // final Y for a card at its original index (removes dragged card, opens gap)
  const cardY = (origIdx: number) => {
    const di = toDisplayIndex(origIdx);
    return (di + (showGap && di >= (gapIndex as number) ? 1 : 0)) * unit;
  };

  // inner container height grows by one slot while a gap is open, shrinks by one
  // while the dragged card is lifted out of this column
  const flowCount = leads.length - (isActiveHere ? 1 : 0);
  const innerHeight = activeId
    ? (flowCount + (showGap ? 1 : 0)) * unit
    : totalSize;
  const dragTransition = activeId
    ? "transform 160ms cubic-bezier(0.2, 0, 0, 1)"
    : undefined;

  return (
    <div 
      ref={setDroppableRef}
      className="flex-shrink-0 w-[420px] flex flex-col min-h-0 relative"
    >
      <div
        className={`flex-1 min-h-0 rounded-xl rounded-b-none border border-b-0 transition-colors duration-100 flex flex-col overflow-hidden ${
          isTargeted
            ? "bg-muted/70 border-black/10 dark:border-white/10 border-dashed"
            : "bg-background border-black/[0.04] dark:border-white/[0.06]"
        }`}
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-2 border-b border-black/5 dark:border-white/[0.06] bg-black/[0.03] dark:bg-white/[0.04]">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-base">{pipeline.nome}</h2>
            <span className="text-sm px-2 py-0.5 rounded-full bg-green-800 text-white">
              {displayCount.toLocaleString('pt-BR')}
            </span>
          </div>
          <InlineAddContact pipelineId={pipeline.id} subOriginId={subOriginId || null} />
        </div>

        {/* Virtualized Cards container - this is the scroll container */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto px-4 py-3 kanban-scroll bg-zinc-500/[0.03]"
          style={{ minHeight: 0 }} // Important for flex child scrolling
        >
          <SortableContext
            items={leads.map(l => l.id)}
            strategy={activeId ? noShiftStrategy : verticalListSortingStrategy}
          >
            {/* Top placeholder for cross-pipeline drag (only when column is empty) */}
            {showTopPlaceholder && (
              <div className="mb-2">
                <div className="h-[100px] rounded-lg border-2 border-dashed border-black/20 bg-black/[0.03]" />
              </div>
            )}

            {leads.length > 0 ? (
              <div
                style={{
                  height: `${innerHeight}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {virtualItems.map((virtualItem) => {
                  const lead = leads[virtualItem.index];
                  if (!lead) return null; // Safety check

                  const isActiveCard = lead.id === activeId;

                  return (
                    <div
                      key={lead.id}
                      data-index={virtualItem.index}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${unit}px`,
                        transform: `translateY(${isActiveCard ? 0 : cardY(virtualItem.index)}px)`,
                        paddingBottom: `${CARD_GAP}px`,
                        transition: dragTransition,
                        // Lifted card is shown in the DragOverlay; collapse its slot here
                        opacity: isActiveCard ? 0 : 1,
                        pointerEvents: isActiveCard ? 'none' : undefined,
                        zIndex: isActiveCard ? 0 : 1,
                      }}
                    >
                      <KanbanCard
                        lead={lead}
                        subOriginId={subOriginId}
                        tags={tagsMap?.get(lead.id) || []}

                      />
                    </div>
                  );
                })}

                {/* Dashed drop indicator — a card-sized slot that OPENS real space */}
                {showGap && (
                  <div
                    className="absolute left-0 right-0 z-20 pointer-events-none"
                    style={{
                      top: 0,
                      transform: `translateY(${(gapIndex as number) * unit}px)`,
                      height: `${unit}px`,
                      paddingBottom: `${CARD_GAP}px`,
                      transition: dragTransition,
                    }}
                  >
                    <div className="h-full rounded-xl border-2 border-dashed border-primary/60 bg-primary/[0.06]" />
                  </div>
                )}
              </div>
            ) : !showTopPlaceholder ? (
              <div className={`text-center text-sm py-8 rounded-lg border-2 border-dashed transition-colors duration-100 ${
                isTargeted 
                  ? "border-black/20 text-foreground bg-black/[0.02]" 
                  : "border-transparent text-muted-foreground"
              }`}>
                {isTargeted ? "Solte aqui" : "Nenhum lead"}
              </div>
            ) : null}
            
            {/* Extra padding at bottom for scroll area */}
            {leads.length > 0 && <div className="h-4" />}
          </SortableContext>
        </div>
      </div>
      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-background to-transparent pointer-events-none rounded-b-xl" />
    </div>
  );
});
