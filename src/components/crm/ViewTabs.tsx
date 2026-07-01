import { useRef, useLayoutEffect, useState, memo, ReactNode, useMemo, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { X, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";

type CRMView = "quadro";

interface ViewTabsProps {
  activeView: CRMView;
  onViewChange: (view: CRMView) => void;
  onSettingsClick: () => void;
  extraActions?: ReactNode;
  onTabHover?: (view: CRMView) => void;
  subOriginId: string;
}

interface TabItem {
  id: CRMView;
  label: string;
}

const defaultTabs: TabItem[] = [
  { id: "quadro", label: "Quadro" },
];

const defaultOrder: CRMView[] = ["quadro"];

interface TabConfig {
  order: CRMView[];
  hidden: CRMView[];
}

interface SortableTabProps {
  tab: TabItem;
  isActive: boolean;
  onViewChange: (view: CRMView) => void;
  onTabHover?: (view: CRMView) => void;
  onHide: (id: CRMView) => void;
  setTabRef: (el: HTMLButtonElement | null) => void;
}

function SortableTab({ tab, isActive, onViewChange, onTabHover, onHide, setTabRef }: SortableTabProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tab.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          ref={(el) => {
            setNodeRef(el);
            setTabRef(el);
          }}
          onClick={() => onViewChange(tab.id)}
          onMouseEnter={() => onTabHover?.(tab.id)}
          style={style}
          className={cn(
            "relative text-sm font-semibold tracking-wide transition-colors duration-150 pb-0.5",
            isActive
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground/80"
          )}
          {...attributes}
          {...listeners}
        >
          {tab.label}
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent className="min-w-[160px]">
        <ContextMenuItem
          onClick={() => onHide(tab.id)}
          className="text-destructive focus:text-destructive cursor-pointer"
        >
          <X className="w-4 h-4 mr-2" />
          Ocultar aba
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export const ViewTabs = memo(function ViewTabs({ activeView, onViewChange, onSettingsClick, extraActions, onTabHover, subOriginId }: ViewTabsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Map<CRMView, HTMLButtonElement>>(new Map());
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  const [tabConfig, setTabConfig] = useState<TabConfig>({ order: defaultOrder, hidden: [] });
  const [isLoading, setIsLoading] = useState(true);
  const saveTimeoutRef = useRef<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  // Load tab config from database
  useEffect(() => {
    if (!subOriginId) {
      setIsLoading(false);
      return;
    }

    // Reset to defaults when subOriginId changes
    setTabConfig({ order: defaultOrder, hidden: [] });
    setIsLoading(true);

    const loadConfig = async () => {
      try {
        const { data, error } = await supabase
          .from('crm_tab_preferences')
          .select('tab_order, hidden_tabs')
          .eq('sub_origin_id', subOriginId)
          .maybeSingle();

        if (error) {
          console.error('Error loading tab config:', error);
        } else if (data) {
          setTabConfig({
            order: (data.tab_order as CRMView[]) || defaultOrder,
            hidden: (data.hidden_tabs as CRMView[]) || [],
          });
        }
      } catch (e) {
        console.error('Failed to load tab config:', e);
      } finally {
        setIsLoading(false);
      }
    };

    loadConfig();
  }, [subOriginId]);

  // Save tab config to database (debounced)
  const saveConfig = useCallback((config: TabConfig) => {
    if (!subOriginId) return;

    // Clear previous timeout
    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
    }

    // Debounce save to avoid too many requests
    saveTimeoutRef.current = window.setTimeout(async () => {
      try {
        const { error } = await supabase
          .from('crm_tab_preferences')
          .upsert({
            sub_origin_id: subOriginId,
            tab_order: config.order,
            hidden_tabs: config.hidden,
          }, {
            onConflict: 'sub_origin_id',
          });

        if (error) {
          console.error('Error saving tab config:', error);
        }
      } catch (e) {
        console.error('Failed to save tab config:', e);
      }
    }, 500);
  }, [subOriginId]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Get visible tabs in order - memoized to avoid infinite loops
  const visibleTabs = useMemo(() => {
    return tabConfig.order
      .filter(id => !tabConfig.hidden.includes(id))
      .map(id => defaultTabs.find(t => t.id === id))
      .filter((t): t is TabItem => t !== undefined);
  }, [tabConfig.order, tabConfig.hidden]);

  // Stable key for visible tabs to use in dependencies
  const visibleTabsKey = visibleTabs.map(t => t.id).join(',');

  // Update indicator position when active view changes
  useLayoutEffect(() => {
    const activeTab = tabRefs.current.get(activeView);
    const container = containerRef.current;
    
    if (activeTab && container) {
      const containerRect = container.getBoundingClientRect();
      const tabRect = activeTab.getBoundingClientRect();
      
      setIndicator({
        left: tabRect.left - containerRect.left,
        width: tabRect.width,
      });
    }
  }, [activeView, visibleTabsKey]);

  const setTabRef = (id: CRMView) => (el: HTMLButtonElement | null) => {
    if (el) {
      tabRefs.current.set(id, el);
    } else {
      tabRefs.current.delete(id);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = tabConfig.order.indexOf(active.id as CRMView);
      const newIndex = tabConfig.order.indexOf(over.id as CRMView);
      
      const newOrder = arrayMove(tabConfig.order, oldIndex, newIndex);
      const newConfig = { ...tabConfig, order: newOrder };
      
      setTabConfig(newConfig);
      saveConfig(newConfig);
    }
  };

  const handleHideTab = (id: CRMView) => {
    const newHidden = [...tabConfig.hidden, id];
    const newConfig = { ...tabConfig, hidden: newHidden };
    
    setTabConfig(newConfig);
    saveConfig(newConfig);
    
    // If hiding the active tab, switch to another visible tab
    if (id === activeView) {
      const remainingVisible = tabConfig.order.filter(
        tabId => !newHidden.includes(tabId) && defaultTabs.some(t => t.id === tabId)
      );
      if (remainingVisible.length > 0) {
        onViewChange(remainingVisible[0]);
      }
    }
  };

  // Show hidden tabs in context menu of the container
  const hiddenTabs = defaultTabs.filter(t => tabConfig.hidden.includes(t.id));

  const handleShowTab = (id: CRMView) => {
    const newHidden = tabConfig.hidden.filter(h => h !== id);
    const newConfig = { ...tabConfig, hidden: newHidden };
    
    setTabConfig(newConfig);
    saveConfig(newConfig);
  };

  return (
    <div className="w-full">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="flex items-center justify-between w-full px-4 pb-2">
          <div ref={containerRef} className="relative inline-flex items-center gap-0">
            {/* Animated gradient indicator */}
            <div
              className="absolute bottom-0 h-[2px] rounded-sm bg-gradient-to-r from-purple-700 to-purple-800"
              style={{
                left: indicator.left - 8,
                width: indicator.width + 16,
                transition: "left 200ms cubic-bezier(0.4, 0, 0.2, 1), width 200ms cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            />
            
            <SortableContext
              items={visibleTabs.map(t => t.id)}
              strategy={horizontalListSortingStrategy}
            >
              {visibleTabs.map((tab, index) => (
                <div key={tab.id} className="flex items-center">
                  {index > 0 && (
                    <span className="text-border mx-3 select-none text-[13px] font-light">|</span>
                  )}
                  <SortableTab
                    tab={tab}
                    isActive={activeView === tab.id}
                    onViewChange={onViewChange}
                    onTabHover={onTabHover}
                    onHide={handleHideTab}
                    setTabRef={setTabRef(tab.id)}
                  />
                </div>
              ))}
            </SortableContext>
            
            
          </div>
          
          {/* Extra Actions + Settings Icon */}
          {extraActions && (
            <div className="flex items-center gap-2">
              {extraActions}
            </div>
          )}
        </div>
      </DndContext>
      
      {/* Line removed - rendered by parent KanbanBoard for full-width */}
    </div>
  );
});
