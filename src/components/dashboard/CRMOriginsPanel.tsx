import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Kanban, ChevronRight, ChevronsRight, Folder, FolderOpen, MoreVertical, Plus, Pencil, Trash2, GripVertical, CalendarDays, ListTodo, Search, LayoutGrid, Copy, Settings } from "lucide-react";
import googleSheetsIcon from "@/assets/google-sheets-icon.png";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { registerSubOrigins, originIdToSlug, resolveOriginParam } from "@/lib/origin-slugs";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface Origin {
  id: string;
  nome: string;
  ordem: number;
}

interface SubOrigin {
  id: string;
  origin_id: string;
  nome: string;
  ordem: number;
  tipo: 'tarefas' | 'calendario';
}

interface LeadCount {
  sub_origin_id: string;
  count: number;
}

interface CRMOriginsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  sidebarWidth: number;
  embedded?: boolean;
}


// Add Sub-origin Dropdown Component (only Tarefas type now)
function AddSubOriginDropdown({ 
  originId, 
  subOriginsCount,
  onCreated 
}: { 
  originId: string; 
  subOriginsCount: number;
  onCreated: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Cmd/Ctrl+K focuses the spaces search field
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setInputValue('');
    }
  };

  const handleCreate = async () => {
    if (!inputValue.trim()) {
      toast.error("Digite um nome");
      return;
    }
    
    setIsLoading(true);
    const { error } = await supabase.from("crm_sub_origins").insert({ 
      nome: inputValue.trim(), 
      origin_id: originId,
      ordem: subOriginsCount,
      tipo: 'tarefas'
    });
    
    setIsLoading(false);
    
    if (error) {
      toast.error("Erro ao criar sub-origem");
      return;
    }
    
    toast.success("Sub-origem criada");
    setIsOpen(false);
    setInputValue('');
    onCreated();
    
    // Trigger a refetch
    window.dispatchEvent(new CustomEvent('crm-data-updated'));
  };

  return (
    <li className="relative pl-6 py-0.5">
      <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 w-full py-1.5 px-2 rounded-lg transition-all duration-200 ease-out text-xs text-zinc-500 hover:text-white hover:bg-zinc-800">
            <Plus className="h-3 w-3" />
            <span>Criar sub origem</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="start" 
          side="right"
          sideOffset={8}
          className="w-64 p-3 z-[9999] bg-popover"
        >
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-black/[0.04] flex items-center justify-center">
                <ListTodo className="h-3 w-3 text-foreground/60" />
              </div>
              <span className="text-[13px] font-medium text-foreground">Nova Sub-origem</span>
            </div>
            <input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Nome da sub-origem"
              className="w-full bg-transparent border-0 border-b-2 border-foreground/20 focus:border-foreground/60 outline-none py-2 text-[13px] text-foreground placeholder:text-foreground/30 transition-colors"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <Button 
              onClick={handleCreate} 
              disabled={isLoading || !inputValue.trim()}
              className="w-full h-8 bg-foreground hover:bg-foreground/90 text-background text-[13px]"
            >
              {isLoading ? 'Criando...' : 'Criar'}
            </Button>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

// Sortable Origin Item Component
function SortableOriginItem({ 
  origin, 
  originSubOrigins,
  isOriginExpanded,
  expandedOrigins,
  toggleOrigin,
  openEditOriginDialog,
  handleDeleteOrigin,
  openCreateSubOriginDialog,
  openEditSubOriginDialog,
  handleDeleteSubOrigin,
  handleSubOriginClick,
  leadCounts,
  currentSubOriginId,
  currentCalendarOriginId,
  userPermissions,
}: {
  origin: Origin;
  originSubOrigins: SubOrigin[];
  isOriginExpanded: boolean;
  expandedOrigins: Set<string>;
  toggleOrigin: (id: string) => void;
  openEditOriginDialog: (origin: Origin) => void;
  handleDeleteOrigin: (id: string) => void;
  openCreateSubOriginDialog: (originId: string) => void;
  openEditSubOriginDialog: (subOrigin: SubOrigin) => void;
  handleDeleteSubOrigin: (id: string) => void;
  handleSubOriginClick: (id: string, tipo: 'tarefas' | 'calendario') => void;
  leadCounts: LeadCount[];
  currentSubOriginId: string | null;
  currentCalendarOriginId: string | null;
  userPermissions: {
    isAdmin: boolean;
    canCreateOrigins: boolean;
    canCreateSubOrigins: boolean;
    allowedOriginIds: string[];
    allowedSubOriginIds: string[];
  };
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: origin.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const LINE_TOP_PX = 20;
  const lastSubOriginRef = useRef<HTMLLIElement | null>(null);
  const [treeLineHeightPx, setTreeLineHeightPx] = useState(0);

  const updateTreeLineHeight = useCallback(() => {
    if (!isOriginExpanded) return;

    if (originSubOrigins.length === 0) {
      setTreeLineHeightPx(0);
      return;
    }

    const lastEl = lastSubOriginRef.current;
    if (!lastEl) return;

    // Calcula até o centro vertical do último item para alinhar com a curva
    const centerY = lastEl.offsetTop + lastEl.offsetHeight / 2;
    // Ajuste preciso: a linha vai do topo até o centro da última curva
    const next = Math.max(0, Math.round(centerY - LINE_TOP_PX));
    setTreeLineHeightPx((prev) => (prev === next ? prev : next));
  }, [isOriginExpanded, originSubOrigins.length]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => updateTreeLineHeight());
    window.addEventListener("resize", updateTreeLineHeight);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", updateTreeLineHeight);
    };
  }, [updateTreeLineHeight]);

  return (
    <div ref={setNodeRef} style={style} className="animate-in fade-in duration-200">
      {/* Origin (Folder) */}
      <div className="flex items-center group/origin relative">
        {/* Drag Handle - only show for admins */}
        {userPermissions.isAdmin && (
          <div className="absolute -left-1 top-1/2 -translate-y-1/2 transition-all duration-200 ease-out opacity-0 -translate-x-2 group-hover/origin:opacity-100 group-hover/origin:translate-x-0 group-has-[.actions-area:hover]/origin:opacity-0 group-has-[.actions-area:hover]/origin:-translate-x-2">
            <button
              {...attributes}
              {...listeners}
              className="p-1 rounded cursor-grab active:cursor-grabbing hover:bg-zinc-800"
            >
              <GripVertical className="h-3 w-3 text-zinc-500" />
            </button>
          </div>
        )}
        
        <button
          onClick={() => toggleOrigin(origin.id)}
          className={cn(
            "flex items-center gap-2 flex-1 py-2 px-2 rounded-lg transition-all duration-200 ease-out text-base text-foreground/70 hover:text-foreground hover:bg-accent",
            userPermissions.isAdmin && "group-hover/origin:translate-x-4 group-has-[.actions-area:hover]/origin:translate-x-0"
          )}
        >
          {isOriginExpanded ? (
            <FolderOpen className="h-4 w-4 flex-shrink-0 fill-current text-foreground/60" />
          ) : (
            <Folder className="h-4 w-4 flex-shrink-0 fill-current text-foreground/60" />
          )}
          <span className="flex-1 text-left truncate font-bold">{origin.nome}</span>
          <ChevronRight 
            className={cn(
              "h-3 w-3 transition-transform duration-300 text-foreground/50",
              isOriginExpanded ? "rotate-90" : ""
            )} 
          />
        </button>
        
        {/* Origin Actions - only show for admins */}
        {userPermissions.isAdmin && (
          <div className="actions-area transition-all duration-200 ease-out group-hover/origin:translate-x-4 hover:!translate-x-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button 
                  onClick={(e) => e.stopPropagation()}
                  className="p-1.5 rounded opacity-0 group-hover/origin:opacity-100 transition-all duration-200 ease-out hover:bg-zinc-800"
                >
                  <MoreVertical className="h-4 w-4 text-zinc-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40 z-[9999] bg-popover border-border/30 dark:border-white/[0.06]">
                <DropdownMenuItem onClick={() => openEditOriginDialog(origin)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="text-destructive focus:text-destructive"
                  onClick={() => handleDeleteOrigin(origin.id)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Sub-origins with tree lines - SVG curves approach */}
      <div 
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: isOriginExpanded ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          {/* Tree container */}
          <ul className="ml-4 pt-2 pb-1 list-none pl-0 relative">
            
            {/* Linha vertical principal - cor escura, sem transparência, z-index alto */}
            <div 
              className="absolute left-[11px] w-[2px] z-20"
              style={{
                top: `${LINE_TOP_PX}px`,
                height: `${treeLineHeightPx}px`,
                backgroundColor: "#52525b",
              }}
            />
            

            {/* Task sub-origins only (calendar is now accessed via tabs in CRM page) */}
            {originSubOrigins.filter(s => s.tipo === 'tarefas').map((subOrigin, index, filteredArr) => {
              const leadCountEntry = leadCounts.find(lc => lc.sub_origin_id === subOrigin.id);
              const isCountLoading = leadCountEntry === undefined;
              const leadCount = leadCountEntry?.count || 0;
              const isActive = currentSubOriginId === subOrigin.id;
              const isLastTask = index === filteredArr.length - 1;
              
              return (
                <li 
                  key={subOrigin.id} 
                  className="relative pl-6 py-1"
                  ref={isLastTask ? (el) => { lastSubOriginRef.current = el; } : undefined}
                >
                  {/* Curva SVG perfeita */}
                  <svg 
                    className="absolute left-[4px] top-1/2 -translate-y-1/2 z-0" 
                    width="18" 
                    height="18" 
                    viewBox="0 0 18 18"
                    fill="none"
                  >
                    <path 
                      d="M 8 0 L 8 5 Q 8 9 12 9 L 18 9" 
                      stroke="#52525b"
                      strokeWidth="2" 
                      fill="none"
                    />
                  </svg>
                  
                  <div className="flex items-center group">
                    <button
                      onClick={() => handleSubOriginClick(subOrigin.id, subOrigin.tipo)}
                      className={cn(
                        "flex items-center gap-2 flex-1 py-1.5 px-2 rounded-lg transition-all duration-200 ease-out text-[13px]",
                        isActive 
                          ? "bg-accent font-medium text-foreground"
                          : "text-foreground/70 hover:text-foreground hover:bg-accent"
                      )}
                    >
                      <Kanban className={cn(
                        "h-3 w-3 flex-shrink-0",
                        isActive ? "text-orange-500" : "text-foreground/60"
                      )} />
                      <span className={cn(
                        "truncate font-bold",
                        isActive && "bg-gradient-to-r from-orange-500 to-amber-400 bg-clip-text text-transparent"
                      )}>{subOrigin.nome}</span>
                    </button>
                    
                    {/* Sub-origin Actions */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button 
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 rounded opacity-0 group-hover:opacity-100 transition-all duration-200 ease-out hover:bg-accent"
                        >
                          <MoreVertical className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent 
                        align="start" 
                        side="right"
                        sideOffset={8}
                        className="w-56 z-[9999] bg-popover p-1.5 rounded-xl shadow-xl border border-border/30 dark:border-white/[0.06]"
                      >
                        {/* Export */}
                        <DropdownMenuItem 
                          onSelect={() => {
                            requestAnimationFrame(() => {
                              window.dispatchEvent(new CustomEvent('open-export-dialog', { 
                                detail: { subOriginId: subOrigin.id } 
                              }));
                            });
                          }}
                          className="gap-3 h-9 rounded-lg cursor-pointer"
                        >
                          <img src={googleSheetsIcon} alt="Google Sheets" className="h-4 w-4" />
                          <span className="text-[13px]">Exportar para Planilha</span>
                        </DropdownMenuItem>

                        {userPermissions.isAdmin && (
                          <>
                            <DropdownMenuSeparator className="my-1.5" />
                            
                            <DropdownMenuItem 
                              onClick={() => openEditSubOriginDialog(subOrigin)} 
                              className="gap-3 h-9 rounded-lg cursor-pointer"
                            >
                              <Pencil className="h-4 w-4 text-muted-foreground" />
                              <span className="text-[13px]">Renomear</span>
                            </DropdownMenuItem>

                            <DropdownMenuItem 
                              onClick={(e) => {
                                e.stopPropagation();
                                // Future: duplicate functionality
                                toast.info("Em breve");
                              }}
                              className="gap-3 h-9 rounded-lg cursor-pointer"
                            >
                              <Copy className="h-4 w-4 text-muted-foreground" />
                              <span className="text-[13px]">Duplicar</span>
                            </DropdownMenuItem>

                            <DropdownMenuSeparator className="my-1.5" />
                            
                            <DropdownMenuItem 
                              className="gap-3 h-9 rounded-lg cursor-pointer text-red-500 focus:text-red-500 focus:bg-red-50 dark:focus:bg-red-950/20"
                              onClick={() => handleDeleteSubOrigin(subOrigin.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="text-[13px]">Excluir</span>
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              );
            })}

            {/* Add Sub-origin Button - only show for admins or users with permission */}
            {(userPermissions.isAdmin || userPermissions.canCreateSubOrigins) && (
              <AddSubOriginDropdown 
                originId={origin.id}
                subOriginsCount={originSubOrigins.length}
                onCreated={() => {}}
              />
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

interface UserPermissions {
  isAdmin: boolean;
  canCreateOrigins: boolean;
  canCreateSubOrigins: boolean;
  allowedOriginIds: string[];
  allowedSubOriginIds: string[];
}

export function CRMOriginsPanel({ isOpen, onClose, sidebarWidth, embedded = false }: CRMOriginsPanelProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const [origins, setOrigins] = useState<Origin[]>([]);
  const [subOrigins, setSubOrigins] = useState<SubOrigin[]>([]);
  const [leadCounts, setLeadCounts] = useState<LeadCount[]>([]);
  const hasInitialized = useRef(false);
  
  // User permissions state
  const [userPermissions, setUserPermissions] = useState<UserPermissions>({
    isAdmin: false,
    canCreateOrigins: false,
    canCreateSubOrigins: false,
    allowedOriginIds: [],
    allowedSubOriginIds: [],
  });
  
  const [expandedOrigins, setExpandedOrigins] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('crm_expanded_origins');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'origin' | 'suborigin'>('origin');
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [editingItem, setEditingItem] = useState<{ id: string; nome: string; origin_id?: string; tipo?: string } | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [selectedOriginId, setSelectedOriginId] = useState<string | null>(null);
  const [selectedTipo, setSelectedTipo] = useState<'tarefas' | 'calendario'>('tarefas');

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Persist expandedOrigins to localStorage
  useEffect(() => {
    localStorage.setItem('crm_expanded_origins', JSON.stringify([...expandedOrigins]));
  }, [expandedOrigins]);

  // Fetch user permissions with localStorage cache for instant load
  const fetchUserPermissions = useCallback(async () => {
    try {
      // Try to use cached permissions first for instant render
      const cached = localStorage.getItem('crm_user_permissions');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setUserPermissions(parsed);
        } catch { /* ignore parse errors */ }
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if user is admin
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      const isAdmin = roleData?.role === "admin";

      let newPermissions: UserPermissions;

      if (isAdmin) {
        newPermissions = {
          isAdmin: true,
          canCreateOrigins: true,
          canCreateSubOrigins: true,
          allowedOriginIds: [],
          allowedSubOriginIds: [],
        };
      } else {
        // Fetch user permissions
        const { data: permData } = await supabase
          .from("user_permissions")
          .select("*")
          .eq("user_id", user.id)
          .single();

        newPermissions = {
          isAdmin: false,
          canCreateOrigins: permData?.can_create_origins ?? false,
          canCreateSubOrigins: permData?.can_create_sub_origins ?? false,
          allowedOriginIds: permData?.allowed_origin_ids ?? [],
          allowedSubOriginIds: permData?.allowed_sub_origin_ids ?? [],
        };
      }

      // Update state and cache
      setUserPermissions(newPermissions);
      localStorage.setItem('crm_user_permissions', JSON.stringify(newPermissions));
    } catch (error) {
      console.error('Error fetching user permissions:', error);
    }
  }, []);

  // Fetch lead counts in a non-blocking way (deferred after structure is rendered)
  const fetchLeadCounts = useCallback(async (subOriginsList: SubOrigin[]) => {
    const countPromises = subOriginsList.map(async (subOrigin) => {
      const { count, error } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("sub_origin_id", subOrigin.id);
      
      return {
        sub_origin_id: subOrigin.id,
        count: error ? 0 : (count || 0),
      };
    });
    
    const counts = await Promise.all(countPromises);
    setLeadCounts(counts);
  }, []);

  const fetchData = useCallback(async () => {
    if (!currentWorkspace?.id) return;
    
    try {
      // Fetch only structure first (origins + sub-origins) - this is fast
      const [originsRes, subOriginsRes] = await Promise.all([
        supabase.from("crm_origins").select("*").eq("workspace_id", currentWorkspace.id).order("ordem"),
        supabase.from("crm_sub_origins").select("*, crm_origins!inner(workspace_id)").eq("crm_origins.workspace_id", currentWorkspace.id).order("ordem"),
      ]);

      if (originsRes.data) {
        setOrigins(originsRes.data);
      }
      
      let parsedSubOrigins: SubOrigin[] = [];
      if (subOriginsRes.data) {
        parsedSubOrigins = subOriginsRes.data.map(s => ({
          ...s,
          tipo: (s.tipo === 'calendario' ? 'calendario' : 'tarefas') as 'tarefas' | 'calendario'
        }));
        setSubOrigins(parsedSubOrigins);
        // Register slugs for URL mapping
        registerSubOrigins(parsedSubOrigins);
      }
      
      hasInitialized.current = true;

      // Defer lead counts fetch to after UI renders (non-blocking)
      if (parsedSubOrigins.length > 0) {
        // Use requestIdleCallback if available, otherwise setTimeout
        if ('requestIdleCallback' in window) {
          window.requestIdleCallback(() => fetchLeadCounts(parsedSubOrigins), { timeout: 500 });
        } else {
          setTimeout(() => fetchLeadCounts(parsedSubOrigins), 100);
        }
      }
    } catch (error) {
      console.error('Error fetching CRM data:', error);
    }
  }, [fetchLeadCounts, currentWorkspace?.id]);

  // Listen for createOrigin event from other components (e.g., KanbanBoard empty state)
  useEffect(() => {
    const handleCreateOriginEvent = () => {
      if (userPermissions.isAdmin || userPermissions.canCreateOrigins) {
        openCreateOriginDialog();
      }
    };
    
    window.addEventListener('createOrigin', handleCreateOriginEvent);
    return () => window.removeEventListener('createOrigin', handleCreateOriginEvent);
  }, [userPermissions.isAdmin, userPermissions.canCreateOrigins]);

  // Fetch data and permissions on first mount or workspace change
  useEffect(() => {
    fetchUserPermissions();
    hasInitialized.current = false;
    fetchData();
  }, [fetchData, fetchUserPermissions, currentWorkspace?.id]);

  // Auto-expand origin of currently selected sub-origin (from URL) or first origin
  useEffect(() => {
    if (origins.length === 0 || subOrigins.length === 0) return;
    
    const urlParams = new URLSearchParams(location.search);
    const selectedSubOriginId = urlParams.get('origin');
    
    if (selectedSubOriginId) {
      // Find which origin contains this sub-origin and expand it
      const selectedSubOrigin = subOrigins.find(s => s.id === selectedSubOriginId);
      if (selectedSubOrigin && !expandedOrigins.has(selectedSubOrigin.origin_id)) {
        setExpandedOrigins(new Set([...expandedOrigins, selectedSubOrigin.origin_id]));
      }
    } else if (expandedOrigins.size === 0) {
      // No sub-origin selected and nothing expanded - expand first origin
      const firstOriginId = origins[0].id;
      setExpandedOrigins(new Set([firstOriginId]));
    }
  }, [origins, subOrigins, location.search]);

  // Filter origins and sub-origins based on user permissions
  const filteredOrigins = userPermissions.isAdmin 
    ? origins 
    : origins.filter(origin => userPermissions.allowedOriginIds.includes(origin.id));
  
  const filteredSubOrigins = userPermissions.isAdmin
    ? subOrigins
    : subOrigins.filter(subOrigin => userPermissions.allowedSubOriginIds.includes(subOrigin.id));

  // Apply the "Pesquisar" search: keep origins that match by name or that have a
  // matching sub-origin; when matching by sub, only show the matching subs + expand.
  const searchTerm = searchQuery.trim().toLowerCase();
  const searchedOrigins = filteredOrigins
    .map((origin) => {
      const allSubs = filteredSubOrigins.filter((s) => s.origin_id === origin.id);
      if (!searchTerm) return { origin, subs: allSubs, forceExpand: false };
      const originMatches = origin.nome.toLowerCase().includes(searchTerm);
      const matchingSubs = allSubs.filter((s) => s.nome.toLowerCase().includes(searchTerm));
      if (!originMatches && matchingSubs.length === 0) return null;
      return {
        origin,
        subs: originMatches ? allSubs : matchingSubs,
        forceExpand: matchingSubs.length > 0,
      };
    })
    .filter(Boolean) as { origin: typeof filteredOrigins[number]; subs: typeof filteredSubOrigins; forceExpand: boolean }[];

  // Real-time subscriptions - only for structure changes, not navigation
  useEffect(() => {
    const originsChannel = supabase
      .channel('crm-origins-panel-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'crm_origins' }, fetchData)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'crm_origins' }, fetchData)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'crm_origins' }, fetchData)
      .subscribe();

    const subOriginsChannel = supabase
      .channel('crm-sub-origins-panel-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'crm_sub_origins' }, fetchData)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'crm_sub_origins' }, fetchData)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'crm_sub_origins' }, fetchData)
      .subscribe();

    // Listen for custom event from dropdown
    const handleCustomUpdate = () => fetchData();
    window.addEventListener('crm-data-updated', handleCustomUpdate);

    return () => {
      supabase.removeChannel(originsChannel);
      supabase.removeChannel(subOriginsChannel);
      window.removeEventListener('crm-data-updated', handleCustomUpdate);
    };
  }, [fetchData]);

  // Debounced lead count updates - separate from structure changes
  useEffect(() => {
    if (subOrigins.length === 0) return;

    let debounceTimer: NodeJS.Timeout | null = null;
    let isMounted = true;

    const updateLeadCounts = async () => {
      const countPromises = subOrigins.map(async (subOrigin) => {
        const { count, error } = await supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .eq("sub_origin_id", subOrigin.id);
        
        return {
          sub_origin_id: subOrigin.id,
          count: error ? 0 : (count || 0),
        };
      });
      
      const counts = await Promise.all(countPromises);
      if (isMounted) {
        setLeadCounts(prev => {
          // Only update if values actually changed to prevent re-renders
          const hasChanged = counts.some((c, i) => {
            const prevCount = prev.find(p => p.sub_origin_id === c.sub_origin_id);
            return !prevCount || prevCount.count !== c.count;
          });
          return hasChanged ? counts : prev;
        });
      }
    };

    const debouncedUpdate = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(updateLeadCounts, 500);
    };

    const leadsChannel = supabase
      .channel('crm-leads-panel-count-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads' }, debouncedUpdate)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'leads' }, debouncedUpdate)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads', filter: 'sub_origin_id=neq.null' }, debouncedUpdate)
      .subscribe();

    return () => {
      isMounted = false;
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(leadsChannel);
    };
  }, [subOrigins]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = origins.findIndex((o) => o.id === active.id);
      const newIndex = origins.findIndex((o) => o.id === over.id);

      const newOrigins = arrayMove(origins, oldIndex, newIndex);
      
      // Optimistic update
      setOrigins(newOrigins);

      // Update ordem in database
      const updates = newOrigins.map((origin, index) => 
        supabase.from("crm_origins").update({ ordem: index }).eq("id", origin.id)
      );

      try {
        await Promise.all(updates);
      } catch (error) {
        toast.error("Erro ao reordenar origens");
        fetchData(); // Revert on error
      }
    }
  };

  const toggleOrigin = (originId: string) => {
    setExpandedOrigins(prev => {
      const newSet = new Set(prev);
      if (newSet.has(originId)) {
        newSet.delete(originId);
      } else {
        newSet.add(originId);
      }
      return newSet;
    });
  };

  const openCreateOriginDialog = () => {
    setDialogType('origin');
    setDialogMode('create');
    setInputValue("");
    setEditingItem(null);
    setDialogOpen(true);
  };

  const openCreateSubOriginDialog = (originId: string) => {
    setDialogType('suborigin');
    setDialogMode('create');
    setInputValue("");
    setSelectedOriginId(originId);
    setEditingItem(null);
    setSelectedTipo('tarefas');
    setDialogOpen(true);
  };

  const openEditOriginDialog = (origin: Origin) => {
    setDialogType('origin');
    setDialogMode('edit');
    setInputValue(origin.nome);
    setEditingItem({ id: origin.id, nome: origin.nome });
    setDialogOpen(true);
  };

  const openEditSubOriginDialog = (subOrigin: SubOrigin) => {
    setDialogType('suborigin');
    setDialogMode('edit');
    setInputValue(subOrigin.nome);
    setEditingItem({ id: subOrigin.id, nome: subOrigin.nome, origin_id: subOrigin.origin_id });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!inputValue.trim()) {
      toast.error("Digite um nome");
      return;
    }

  if (dialogType === 'origin') {
      if (dialogMode === 'create') {
        const { error } = await supabase.from("crm_origins").insert({ 
          nome: inputValue.trim(), 
          ordem: origins.length,
          workspace_id: currentWorkspace?.id
        });
        if (error) {
          toast.error("Erro ao criar origem");
          return;
        }
        toast.success("Origem criada");
      } else if (editingItem) {
        const { error } = await supabase.from("crm_origins").update({ nome: inputValue.trim() }).eq("id", editingItem.id);
        if (error) {
          toast.error("Erro ao atualizar origem");
          return;
        }
        toast.success("Origem atualizada");
      }
    } else {
      const originId = dialogMode === 'create' ? selectedOriginId : editingItem?.origin_id;
      if (!originId) return;

      if (dialogMode === 'create') {
        const originSubOrigins = subOrigins.filter(s => s.origin_id === originId);
        const { error } = await supabase.from("crm_sub_origins").insert({ 
          nome: inputValue.trim(), 
          origin_id: originId,
          ordem: originSubOrigins.length,
          tipo: selectedTipo
        });
        if (error) {
          toast.error("Erro ao criar sub-origem");
          return;
        }
        toast.success("Sub-origem criada");
      } else if (editingItem) {
        const { error } = await supabase.from("crm_sub_origins").update({ nome: inputValue.trim() }).eq("id", editingItem.id);
        if (error) {
          toast.error("Erro ao atualizar sub-origem");
          return;
        }
        toast.success("Sub-origem atualizada");
      }
    }

    setDialogOpen(false);
    fetchData();
  };

  const handleDeleteOrigin = async (originId: string) => {
    const { error } = await supabase.from("crm_origins").delete().eq("id", originId);
    if (error) {
      toast.error("Erro ao excluir origem");
      return;
    }
    toast.success("Origem excluída");
    fetchData();
  };

  const handleDeleteSubOrigin = async (subOriginId: string) => {
    const { error } = await supabase.from("crm_sub_origins").delete().eq("id", subOriginId);
    if (error) {
      toast.error("Erro ao excluir sub-origem");
      return;
    }
    toast.success("Sub-origem excluída");
    fetchData();
  };

  const handleSubOriginClick = (subOriginId: string, tipo: 'tarefas' | 'calendario') => {
    const currentOrigin = new URLSearchParams(window.location.search).get('origin');
    const currentResolvedId = resolveOriginParam(currentOrigin);
    
    if (currentResolvedId === subOriginId) {
      return;
    }
    
    window.dispatchEvent(new CustomEvent('suborigin-change'));
    
    const slug = originIdToSlug(subOriginId);
    if (tipo === 'calendario') {
      navigate(`/calendario?origin=${slug}`);
    } else {
      navigate(`/crm?origin=${slug}`);
    }
  };

  const currentSubOriginId = resolveOriginParam(new URLSearchParams(location.search).get('origin'));
  const currentCalendarOriginId = location.pathname === '/calendario' 
    ? resolveOriginParam(new URLSearchParams(location.search).get('origin'))
    : null;
  // Embedded content for unified submenu
  const content = (
    <>
      {/* Header */}
      <div className="px-4 pl-2 py-4 flex items-center justify-between">
        <h2 className="text-foreground font-semibold text-base">Espaços</h2>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-full border border-border hover:bg-accent transition-colors"
        >
          <ChevronsRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Search field */}
      <div className="px-2 pb-3">
        <div className="flex items-center gap-2 border-b border-border pb-2">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') setSearchQuery(''); }}
            placeholder="Pesquisar..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <div className="flex items-center gap-0.5 text-muted-foreground">
            <LayoutGrid className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">K</span>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-3 pl-0 pb-3 space-y-1">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={searchedOrigins.map(({ origin }) => origin.id)}
            strategy={verticalListSortingStrategy}
          >
            {searchedOrigins.length === 0 && searchTerm && (
              <div className="px-4 py-6 text-sm text-muted-foreground text-center">
                Nenhum espaço encontrado
              </div>
            )}
            {searchedOrigins.map(({ origin, subs, forceExpand }) => {
              const originSubOrigins = subs;
              const isOriginExpanded = forceExpand || expandedOrigins.has(origin.id);

              return (
                <SortableOriginItem
                  key={origin.id}
                  origin={origin}
                  originSubOrigins={originSubOrigins}
                  isOriginExpanded={isOriginExpanded}
                  expandedOrigins={expandedOrigins}
                  toggleOrigin={toggleOrigin}
                  openEditOriginDialog={openEditOriginDialog}
                  handleDeleteOrigin={handleDeleteOrigin}
                  openCreateSubOriginDialog={openCreateSubOriginDialog}
                  openEditSubOriginDialog={openEditSubOriginDialog}
                  handleDeleteSubOrigin={handleDeleteSubOrigin}
                  handleSubOriginClick={handleSubOriginClick}
                  leadCounts={leadCounts}
                  currentSubOriginId={currentSubOriginId}
                  currentCalendarOriginId={currentCalendarOriginId}
                  userPermissions={userPermissions}
                />
              );
            })}
          </SortableContext>
        </DndContext>

        {/* Add Origin Button - only show for admins or users with permission */}
        {(userPermissions.isAdmin || userPermissions.canCreateOrigins) && (
          <div className="flex justify-center pt-4 pb-2 px-2">
            <button
              onClick={openCreateOriginDialog}
              className="relative flex items-center justify-center gap-2 py-2.5 px-8 w-full rounded-lg text-xs font-medium transition-all duration-200 hover:scale-[1.02] group bg-transparent border border-dashed border-orange-500/50 hover:border-orange-400/70"
            >
              <Plus className="h-4 w-4 text-orange-400 group-hover:text-orange-300 transition-colors" />
              <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent group-hover:from-orange-300 group-hover:to-amber-300 transition-all">
                Nova Origem
              </span>
            </button>
          </div>
        )}
      </div>


      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'create' 
                ? (dialogType === 'origin' ? 'Nova Origem' : 'Nova Sub-origem')
                : (dialogType === 'origin' ? 'Editar Origem' : 'Editar Sub-origem')
              }
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={dialogType === 'origin' ? "Nome da origem" : "Nome da sub-origem"}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
            
            {/* Type selector for sub-origin creation */}
            {dialogType === 'suborigin' && dialogMode === 'create' && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Tipo de gestão</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedTipo('tarefas')}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                      selectedTipo === 'tarefas'
                        ? "border-orange-500 bg-orange-50"
                        : "border-border hover:border-muted-foreground/30 hover:bg-muted/30"
                    )}
                  >
                    <ListTodo className={cn(
                      "h-6 w-6",
                      selectedTipo === 'tarefas' ? "text-orange-500" : "text-muted-foreground"
                    )} />
                    <span className={cn(
                      "text-sm font-medium",
                      selectedTipo === 'tarefas' ? "text-orange-600" : "text-muted-foreground"
                    )}>
                      Tarefas
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedTipo('calendario')}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                      selectedTipo === 'calendario'
                        ? "border-orange-500 bg-orange-50"
                        : "border-border hover:border-muted-foreground/30 hover:bg-muted/30"
                    )}
                  >
                    <CalendarDays className={cn(
                      "h-6 w-6",
                      selectedTipo === 'calendario' ? "text-orange-500" : "text-muted-foreground"
                    )} />
                    <span className={cn(
                      "text-sm font-medium",
                      selectedTipo === 'calendario' ? "text-orange-600" : "text-muted-foreground"
                    )}>
                      Calendário
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} className="bg-gradient-to-r from-orange-600 to-amber-500 text-white">
              {dialogMode === 'create' ? 'Criar' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  // When embedded, just return the content
  if (embedded) {
    return <div className="h-full flex flex-col bg-background text-foreground">{content}</div>;
  }

  // Standalone mode (mobile/fallback)
  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Panel - only shown in standalone mode */}
      <div
        style={{ left: sidebarWidth - 8 }}
        className={cn(
          "hidden lg:block fixed top-2 h-[calc(100vh-1rem)] w-64 rounded-2xl bg-[#f5f5f7] z-50 overflow-hidden pl-4",
          isOpen 
            ? "opacity-100" 
            : "opacity-0 pointer-events-none"
        )}
      >
        {content}
      </div>
    </>
  );
}
