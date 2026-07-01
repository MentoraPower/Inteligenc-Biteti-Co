import { useState, useEffect, useCallback, useMemo, lazy, Suspense, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  DragOverEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  pointerWithin,
  rectIntersection,
  CollisionDetection,
  MeasuringStrategy,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useUndo } from "@/contexts/UndoContext";
import { Lead, Pipeline } from "@/types/crm";
import { triggerWebhook } from "@/lib/webhooks";
import { trackPipelineMove, trackPositionChange } from "@/lib/leadTracking";
import { VirtualizedKanbanColumn } from "./VirtualizedKanbanColumn";
import { CRMColumnsSkeleton } from "./CRMColumnsSkeleton";

import { KanbanCard } from "./KanbanCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings, Search, Filter, X, CalendarIcon, Zap, Webhook, GitBranch, LayoutGrid, Plus, Blocks, Upload } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";

import { toast } from "sonner";
import { AutomationsDropdown } from "./AutomationsDropdown";
import { IntegrationsTab } from "./IntegrationsTab";
import { ImportContactsTab } from "./ImportContactsTab";
import { EmailFlowBuilder } from "./EmailFlowBuilder";
import { ViewTabs } from "./ViewTabs";


// Lazy load heavy components
const ManagePipelinesDialog = lazy(() => 
  import("./ManagePipelinesDialog").then(m => ({ default: m.ManagePipelinesDialog }))
);


import { resolveOriginParam, originIdToSlug, subscribeOriginSlugs, getOriginSlugsVersion, hasRegisteredSlugs } from "@/lib/origin-slugs";


interface EmailEditingContext {
  emailName: string;
  emailTriggerPipeline: string;
  editingEmailId: string | null;
  isCreating: boolean;
  emailSubject: string;
  emailBodyHtml: string;
}

interface EmailBuilderState {
  show: boolean;
  props?: {
    automationName: string;
    triggerPipelineName: string;
    onSave: (steps: any[]) => Promise<void>;
    onCancel: () => void;
    initialSteps?: any[];
    editingContext?: EmailEditingContext;
    pipelines?: Pipeline[];
    subOriginId?: string | null;
    automationId?: string;
    pendingEmailsCount?: number;
  };
}

type CRMView = "quadro";

// Single source of truth for a pipeline's card order. MUST match the display
// order in `leadsByPipeline` exactly, otherwise drag-reorder computes gaps/indexes
// against a different order than what's on screen and cards jump around.
const sortLeadsForDisplay = (arr: Lead[]): Lead[] => {
  const hasManualOrder = arr.some((l) => (l.ordem ?? 0) !== 0);
  return [...arr].sort((a, b) =>
    hasManualOrder
      ? (a.ordem ?? 0) - (b.ordem ?? 0)
      : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
};

export function KanbanBoard() {
  const { currentWorkspace } = useWorkspace();
  const [searchParams, setSearchParams] = useSearchParams();
  // Re-render whenever the slug registry (re)loads, so a slug in the URL resolves
  // to its real id after the sub-origins finish loading (keeps the selection on reload).
  useSyncExternalStore(subscribeOriginSlugs, getOriginSlugsVersion, getOriginSlugsVersion);
  const originParam = searchParams.get("origin");
  const subOriginId = resolveOriginParam(originParam) || originParam;
  const urlSearchQuery = searchParams.get("search") || "";
  const urlView = searchParams.get("view") as CRMView | null;
  const isEmailBuilderOpen = searchParams.get("emailBuilder") === "open";
  const emailBuilderEmailId = searchParams.get("emailId");
  const emailBuilderName = searchParams.get("emailName");
  const emailBuilderTriggerPipelineId = searchParams.get("emailTrigger");
  
  const [activeView, setActiveView] = useState<CRMView>("quadro");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{
    pipelineId: string;
    position: "top" | "bottom";
    targetLeadId?: string;
  } | null>(null);
  const [isPipelinesDialogOpen, setIsPipelinesDialogOpen] = useState(false);
  const [localLeads, setLocalLeads] = useState<Lead[]>([]);
  const isReorderingRef = useRef(false);
  const [searchQuery, setSearchQuery] = useState(urlSearchQuery);
  const [filterTags, setFilterTags] = useState<string[]>([]);
  
  const [datePreset, setDatePreset] = useState<"all" | "today" | "yesterday" | "7days" | "30days" | "thismonth" | "custom">("all");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [emailBuilderProps, setEmailBuilderProps] = useState<EmailBuilderState["props"] | null>(null);
  const [emailEditingContext, setEmailEditingContext] = useState<EmailEditingContext | null>(null);
  const [automationsOpen, setAutomationsOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [importingLeads, setImportingLeads] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"automations" | "webhooks" | "pipelines" | "integrations" | "import">("automations");
  const queryClient = useQueryClient();
  const { pushAction } = useUndo();
  const searchTimeoutRef = useRef<number | null>(null);

  // Debounce ref for tab hover prefetch
  const hoverTimeoutRef = useRef<number | null>(null);

  // Handle view change - simple and fast, no keep-alive
  const handleViewChange = useCallback((view: CRMView) => {
    if (view === activeView) return; // Already on this view
    
    // Update state immediately (React 18 batches this)
    setActiveView(view);
    localStorage.setItem("crm-view-preference", view);
    
    // Update URL in next frame to avoid blocking the UI
    requestAnimationFrame(() => {
      const newParams = new URLSearchParams(searchParams);
      if (newParams.get("view") !== view) {
        newParams.set("view", view);
        setSearchParams(newParams, { replace: true });
      }
    });
  }, [activeView, searchParams, setSearchParams]);


  // Open email builder with URL param (and persist minimum state in URL for refresh/deep-link)
  const openEmailBuilder = useCallback((props: EmailBuilderState["props"]) => {
    setEmailBuilderProps(props);
    setAutomationsOpen(false);

    const ctx = props.editingContext;

    // NOTE: react-router-dom's setSearchParams does NOT support functional updates
    const next = new URLSearchParams(searchParams);
    next.set("emailBuilder", "open");

    if (ctx?.editingEmailId) next.set("emailId", ctx.editingEmailId);
    else next.delete("emailId");

    if (ctx?.emailName) next.set("emailName", ctx.emailName);
    else next.delete("emailName");

    if (ctx?.emailTriggerPipeline) next.set("emailTrigger", ctx.emailTriggerPipeline);
    else next.delete("emailTrigger");

    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  // Close email builder and return to CRM with automations popup open
  const closeEmailBuilder = useCallback(() => {
    // Clear builder props first so conditional render switches immediately
    setEmailBuilderProps(null);
    
    // NOTE: react-router-dom's setSearchParams does NOT support functional updates
    const next = new URLSearchParams(searchParams);
    next.delete("emailBuilder");
    next.delete("emailId");
    next.delete("emailName");
    next.delete("emailTrigger");
    setSearchParams(next, { replace: true });

    // Reopen automations dropdown immediately
    setAutomationsOpen(true);
  }, [searchParams, setSearchParams]);

  // Sync search from URL when navigating (e.g., coming back from lead detail)
  useEffect(() => {
    setSearchQuery(urlSearchQuery);
  }, [urlSearchQuery]);

  // Update URL with debounce to avoid triggering loading bar on every keystroke
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    
    // Debounce URL update to avoid loading bar flicker
    if (searchTimeoutRef.current) {
      window.clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = window.setTimeout(() => {
      const newParams = new URLSearchParams(searchParams);
      if (value) {
        newParams.set("search", value);
      } else {
        newParams.delete("search");
      }
      setSearchParams(newParams, { replace: true });
      searchTimeoutRef.current = null;
    }, 500);
  };
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        window.clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 50,
        tolerance: 8,
      },
    })
  );

  // Custom collision detection - more responsive and anticipatory
  const collisionDetection: CollisionDetection = useCallback((args) => {
    // First check pointer within (most precise for cards)
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) {
      return pointerCollisions;
    }
    // Fallback to rect intersection (catches columns better)
    return rectIntersection(args);
  }, []);

  // Persist last used subOriginId for instant navigation
  useEffect(() => {
    if (subOriginId) {
      localStorage.setItem("crm_last_sub_origin", originIdToSlug(subOriginId));
    }
  }, [subOriginId]);

  const { data: pipelines = [], isLoading: isLoadingPipelines } = useQuery({
    queryKey: ["pipelines", subOriginId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipelines")
        .select("*")
        .eq("sub_origin_id", subOriginId)
        .order("ordem", { ascending: true });

      if (error) throw error;
      return data as Pipeline[];
    },
    staleTime: 5000,
    enabled: !!subOriginId, // Only run when we have a subOriginId
  });

  // Fetch exact lead counts per pipeline (bypasses 1000 row limit)
  const { data: pipelineCounts = {} } = useQuery({
    queryKey: ["pipeline-counts", subOriginId, pipelines.map(p => p.id).join(",")],
    queryFn: async () => {
      if (pipelines.length === 0) return {};
      
      const countPromises = pipelines.map(async (pipeline) => {
        const { count, error } = await supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .eq("pipeline_id", pipeline.id);
        
        return {
          pipelineId: pipeline.id,
          count: error ? 0 : (count || 0),
        };
      });
      
      const counts = await Promise.all(countPromises);
      return counts.reduce((acc, { pipelineId, count }) => {
        acc[pipelineId] = count;
        return acc;
      }, {} as Record<string, number>);
    },
    staleTime: 5000,
    enabled: pipelines.length > 0,
  });

  // Fetch automations for pipeline transfers (filtered by sub_origin_id)
  const { data: automations = [] } = useQuery({
    queryKey: ["pipeline-automations", subOriginId],
    queryFn: async () => {
      let query = supabase
        .from("pipeline_automations")
        .select("*")
        .eq("is_active", true);
      
      if (subOriginId) {
        query = query.eq("sub_origin_id", subOriginId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    },
    staleTime: 5000,
  });

  // Fetch email automations for this sub-origin
  const { data: emailAutomations = [] } = useQuery({
    queryKey: ["email-automations-triggers", subOriginId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("email_automations")
        .select("*")
        .eq("is_active", true);

      if (error) throw error;
      
      // Filter by sub_origin_id if available, or by trigger_pipeline belonging to current sub-origin
      if (subOriginId && data) {
        return data.filter(ea => ea.sub_origin_id === subOriginId);
      }
      return data || [];
    },
    staleTime: 5000,
    enabled: !!subOriginId,
  });

  // Fetch current sub-origin name for display
  const { data: currentSubOrigin, isLoading: isLoadingSubOrigin } = useQuery({
    queryKey: ["sub-origin", subOriginId],
    queryFn: async () => {
      if (!subOriginId) return null;
      const { data, error } = await supabase
        .from("crm_sub_origins")
        .select("*, crm_origins(nome)")
        .eq("id", subOriginId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching sub-origin:", error);
        return null;
      }
      return data;
      return data;
    },
    enabled: !!subOriginId,
  });

  // Fetch leads WITH tags in a single query - much faster!
  // Uses range(0, 9999) to fetch up to 10000 leads (bypasses default 1000 row limit)
  const { data: leadsWithTags, dataUpdatedAt, isLoading: isLoadingLeads } = useQuery({
    queryKey: ["crm-leads-with-tags", subOriginId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select(`
          *,
          lead_tags (id, name, color)
        `)
        .eq("sub_origin_id", subOriginId)
        .order("created_at", { ascending: false })
        .range(0, 9999); // Use range instead of limit to properly bypass row limits

      if (error) throw error;
      return data as (Lead & { lead_tags: { id: string; name: string; color: string }[] })[];
    },
    staleTime: 10000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    enabled: !!subOriginId,
  });

  // Fetch exact total count of leads for sub-origin (bypasses row limit)
  const { data: totalLeadCount = 0 } = useQuery({
    queryKey: ["total-leads-count", subOriginId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("sub_origin_id", subOriginId);
      
      if (error) throw error;
      return count || 0;
    },
    staleTime: 10000,
    enabled: !!subOriginId,
  });




  // Extract leads and tags from combined query
  const leads = useMemo(() => 
    (leadsWithTags || []).map(({ lead_tags, ...lead }) => lead as Lead),
    [leadsWithTags]
  );
  
  // Pre-process tags by lead_id for O(1) lookup
  const leadTagsRaw = useMemo(() => {
    if (!leadsWithTags) return [];
    return leadsWithTags.flatMap(lead =>
      (lead.lead_tags || []).map(tag => ({ ...tag, lead_id: lead.id }))
    );
  }, [leadsWithTags]);

  // The lead detail aggregates a contact's tags across every lead record that
  // shares the same email/whatsapp. Cards must match — so we fetch the tags of
  // all related leads (across sub-origins) and aggregate by contact identity.
  const identityKey = useMemo(() => {
    const emails = [...new Set(leads.map((l) => (l as any).email).filter(Boolean))].sort();
    const whats = [...new Set(leads.map((l) => (l as any).whatsapp).filter(Boolean))].sort();
    return JSON.stringify([emails, whats]);
  }, [leads]);

  const { data: relatedTagLeads = [] } = useQuery({
    queryKey: ["crm-related-tags", identityKey],
    queryFn: async () => {
      const emails = [...new Set(leads.map((l) => (l as any).email).filter(Boolean))] as string[];
      const whats = [...new Set(leads.map((l) => (l as any).whatsapp).filter(Boolean))] as string[];
      const chunk = <T,>(arr: T[], n: number) => {
        const out: T[][] = [];
        for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
        return out;
      };
      const rows = new Map<string, any>();
      const runIn = async (col: string, values: string[]) => {
        for (const c of chunk(values, 200)) {
          const { data } = await supabase
            .from("leads")
            .select("id, email, whatsapp, lead_tags (id, name, color)")
            .in(col, c);
          (data || []).forEach((l: any) => rows.set(l.id, l));
        }
      };
      if (emails.length) await runIn("email", emails);
      if (whats.length) await runIn("whatsapp", whats);
      return Array.from(rows.values());
    },
    enabled: leads.length > 0,
    staleTime: 10000,
    refetchOnWindowFocus: false,
  });

  // Get unique tags for filtering
  const allTags = useMemo(() => {
    const uniqueTags = new Map<string, { name: string; color: string }>();
    leadTagsRaw.forEach(tag => {
      if (!uniqueTags.has(tag.name)) {
        uniqueTags.set(tag.name, { name: tag.name, color: tag.color });
      }
    });
    return Array.from(uniqueTags.values());
  }, [leadTagsRaw]);

  // Convert leadTags to filtering format (backwards compatibility)
  const leadTags = useMemo(() => 
    leadTagsRaw.map(t => ({ lead_id: t.lead_id, name: t.name })),
    [leadTagsRaw]
  );

  // Map of lead_id -> LeadTag[] for card display, aggregated by contact identity
  // (email/whatsapp) and de-duplicated by tag name — same set the detail shows.
  const tagsMap = useMemo(() => {
    type Tag = { id: string; name: string; color: string };
    const byEmail = new Map<string, Map<string, Tag>>();
    const byWhats = new Map<string, Map<string, Tag>>();
    const addTag = (m: Map<string, Map<string, Tag>>, key: string | null | undefined, tag: Tag) => {
      if (!key) return;
      let inner = m.get(key);
      if (!inner) { inner = new Map(); m.set(key, inner); }
      const nk = (tag.name || "").trim().toLowerCase();
      if (nk && !inner.has(nk)) inner.set(nk, tag);
    };
    relatedTagLeads.forEach((l: any) => {
      (l.lead_tags || []).forEach((t: Tag) => {
        addTag(byEmail, l.email, t);
        addTag(byWhats, l.whatsapp, t);
      });
    });

    const map = new Map<string, Tag[]>();
    leads.forEach((lead) => {
      const inner = new Map<string, Tag>();
      const collect = (m: Map<string, Map<string, Tag>>, key: string | null | undefined) => {
        const i = key ? m.get(key) : null;
        if (i) i.forEach((t, nk) => { if (!inner.has(nk)) inner.set(nk, t); });
      };
      collect(byEmail, (lead as any).email);
      collect(byWhats, (lead as any).whatsapp);
      // Fallback to the lead's own tags if no identity match was loaded yet.
      if (inner.size === 0) {
        leadTagsRaw.filter((t) => t.lead_id === lead.id).forEach((t) => {
          const nk = (t.name || "").trim().toLowerCase();
          if (nk && !inner.has(nk)) inner.set(nk, { id: t.id, name: t.name, color: t.color });
        });
      }
      map.set(lead.id, Array.from(inner.values()));
    });
    return map;
  }, [relatedTagLeads, leads, leadTagsRaw]);

  // Consider loading: always loading if no subOriginId yet, or while queries are in progress
  const isLoading = !subOriginId || isLoadingPipelines || isLoadingLeads || isLoadingSubOrigin;

  // Track previous values to prevent unnecessary updates
  const prevDataUpdatedAtRef = useRef(dataUpdatedAt);
  const prevSubOriginIdRef = useRef(subOriginId);

  // Sync local state with fetched data - only when data actually changes
  useEffect(() => {
    // Reset when subOriginId changes
    if (prevSubOriginIdRef.current !== subOriginId) {
      prevSubOriginIdRef.current = subOriginId;
      prevDataUpdatedAtRef.current = 0;
      setLocalLeads([]);
      return;
    }
    
    // Don't overwrite local state during reordering operations
    if (isReorderingRef.current) return;
    
    // Update when data changes
    if (dataUpdatedAt && dataUpdatedAt !== prevDataUpdatedAtRef.current) {
      prevDataUpdatedAtRef.current = dataUpdatedAt;
      setLocalLeads(leads);
    }
  }, [dataUpdatedAt, subOriginId, leads]);

  // Real-time subscription - only when subOriginId exists and is valid
  useEffect(() => {
    // Validate subOriginId before creating realtime channel
    if (!subOriginId || subOriginId === 'null' || subOriginId === 'undefined') {
      return; // Don't subscribe to "all" changes or invalid IDs
    }

    // Immediate invalidation for instant UI updates (no debounce)
    const invalidateLeadsImmediate = () => {
      queryClient.invalidateQueries({ queryKey: ["crm-leads-with-tags", subOriginId] });
      queryClient.invalidateQueries({ queryKey: ["pipeline-counts", subOriginId] });
    };

    const channel = supabase
      .channel(`crm-realtime-${subOriginId}`)
      .on(
        "postgres_changes",
        { 
          event: "*", 
          schema: "public", 
          table: "leads",
          filter: `sub_origin_id=eq.${subOriginId}` // Filter at DB level for performance
        },
        (payload) => {
          // Ignore real-time updates during reordering to prevent conflicts
          if (isReorderingRef.current) return;

          if (payload.eventType === "INSERT") {
            const newLead = payload.new as Lead;
            setLocalLeads((prev) => {
              if (prev.some((l) => l.id === newLead.id)) return prev;
              return [newLead, ...prev];
            });
            // Immediate invalidation for counts and tags
            invalidateLeadsImmediate();
          } else if (payload.eventType === "UPDATE") {
            const updatedLead = payload.new as Lead;
            // If sub_origin changed and doesn't match current filter, remove it
            if (updatedLead.sub_origin_id !== subOriginId) {
              setLocalLeads((prev) => prev.filter((l) => l.id !== updatedLead.id));
            } else {
              // UPSERT: if lead exists update it, if not add it (handles leads entering this sub_origin)
              setLocalLeads((prev) => {
                const exists = prev.some((l) => l.id === updatedLead.id);
                if (exists) {
                  return prev.map((l) => (l.id === updatedLead.id ? updatedLead : l));
                } else {
                  // Lead just entered this sub_origin via UPDATE - add it
                  return [updatedLead, ...prev];
                }
              });
            }
            invalidateLeadsImmediate();
          } else if (payload.eventType === "DELETE") {
            const deletedId = (payload.old as any).id;
            setLocalLeads((prev) => prev.filter((l) => l.id !== deletedId));
            // Immediate invalidation for counts
            invalidateLeadsImmediate();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pipelines", filter: `sub_origin_id=eq.${subOriginId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["pipelines", subOriginId] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lead_tags" },
        () => {
          // Invalidate tags query to update cards in real-time
          queryClient.invalidateQueries({ queryKey: ["crm-leads-with-tags", subOriginId] });
          queryClient.invalidateQueries({ queryKey: ["lead-tags-full-related"] });
          queryClient.invalidateQueries({ queryKey: ["all-tags"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, subOriginId]);

  // While we're auto-resolving the first origin, DON'T flash the "Criar origem"
  // empty state (it would briefly show on every workspace switch).
  const [resolvingOrigin, setResolvingOrigin] = useState(true);

  // Auto-navigate to first sub-origin if none selected OR if selected belongs to different workspace
  useEffect(() => {
    const autoSelectFirstSubOrigin = async () => {
      if (!currentWorkspace?.id) return;

      // Reload guard: if the URL has a slug that hasn't resolved to a real id yet
      // (the slug registry is still loading), wait — don't auto-select the first
      // sub-origin, which would drop the CRM the user was on.
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (originParam && !UUID_RE.test(subOriginId || "") && !hasRegisteredSlugs()) {
        return;
      }

      // If we have a subOriginId, validate it belongs to current workspace
      if (subOriginId) {
        const { data: subOrigin } = await supabase
          .from('crm_sub_origins')
          .select('id, crm_origins!inner(workspace_id)')
          .eq('id', subOriginId)
          .maybeSingle();

        // If sub-origin exists and belongs to current workspace, we're good
        if (subOrigin && (subOrigin.crm_origins as any)?.workspace_id === currentWorkspace.id) {
          setResolvingOrigin(false);
          return;
        }
        // Otherwise, clear and select first from current workspace
      }

      setResolvingOrigin(true);

      // Get first origin from CURRENT workspace
      const { data: origins } = await supabase
        .from('crm_origins')
        .select('id')
        .eq('workspace_id', currentWorkspace.id)
        .order('ordem')
        .limit(1);

      if (origins && origins.length > 0) {
        // Get first sub-origin of that origin
        const { data: subOrigins } = await supabase
          .from('crm_sub_origins')
          .select('id')
          .eq('origin_id', origins[0].id)
          .order('ordem')
          .limit(1);

        if (subOrigins && subOrigins.length > 0) {
          const newParams = new URLSearchParams(searchParams);
          newParams.set('origin', subOrigins[0].id);
          setSearchParams(newParams, { replace: true });
          // keep resolvingOrigin true — it flips to false once subOriginId updates
        } else {
          // Origin has no sub-origins — genuinely empty
          const newParams = new URLSearchParams(searchParams);
          newParams.delete('origin');
          setSearchParams(newParams, { replace: true });
          setResolvingOrigin(false);
        }
      } else {
        // No origins in this workspace — genuinely empty
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('origin');
        setSearchParams(newParams, { replace: true });
        setResolvingOrigin(false);
      }
    };

    autoSelectFirstSubOrigin();
  }, [subOriginId, searchParams, setSearchParams, currentWorkspace?.id]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setDropIndicator(null);
    isReorderingRef.current = true;
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over, active } = event;
    setOverId(over?.id as string | null);

    if (!over || !active) {
      setDropIndicator(null);
      return;
    }

    const overId = over.id as string;

    // The live pointer Y = where the drag started + how far it moved. Using the
    // pointer (not the dragged card's center) makes the drop marker follow the
    // cursor precisely — so moving up opens the gap above the card right away.
    const activator = event.activatorEvent as any;
    let pointerY: number | null = null;
    if (activator) {
      if (typeof activator.clientY === "number") pointerY = activator.clientY + event.delta.y;
      else if (activator.touches?.[0]) pointerY = activator.touches[0].clientY + event.delta.y;
    }

    // Check if hovering over a top drop zone
    if (overId.endsWith("-top-zone")) {
      const pipelineId = overId.replace("-top-zone", "");
      setDropIndicator({
        pipelineId,
        position: "top",
      });
      return;
    }

    // Check if hovering over a pipeline column (empty area)
    const overPipeline = pipelines.find((p) => p.id === overId);
    if (overPipeline) {
      // Decide top/bottom based on pointer position inside the column
      const overRect = over.rect;
      const activeRect = active.rect.current.translated;

      let position: "top" | "bottom" = "top";
      if (overRect) {
        const overCenter = overRect.top + overRect.height / 2;
        const ref = pointerY != null ? pointerY : (activeRect ? activeRect.top + activeRect.height / 2 : overCenter);
        position = ref > overCenter ? "bottom" : "top";
      }

      setDropIndicator({
        pipelineId: overPipeline.id,
        position,
      });
      return;
    }

    // Check if hovering over a lead card
    const overLead = localLeads.find((l) => l.id === overId);
    if (overLead && overLead.pipeline_id) {
      const overRect = over.rect;
      if (overRect) {
        const overCenter = overRect.top + overRect.height / 2;
        // Prefer the real pointer; fall back to the dragged card's center.
        const activeRect = active.rect.current.translated;
        const ref = pointerY != null ? pointerY : (activeRect ? activeRect.top + activeRect.height / 2 : overCenter);
        let position: "top" | "bottom" = ref < overCenter ? "top" : "bottom";
        let targetLeadId = overId;

        // Hovering over the card being dragged: retarget to the neighbor in the
        // drag direction. A tiny move up/down opens the adjacent gap, and it never
        // targets the dragged card itself (which used to drop it at the end).
        if (overId === (active.id as string)) {
          const pipeLeads = sortLeadsForDisplay(localLeads.filter((l) => l.pipeline_id === overLead.pipeline_id));
          const idx = pipeLeads.findIndex((l) => l.id === overId);
          if (position === "top" && idx > 0) {
            targetLeadId = pipeLeads[idx - 1].id;
          } else if (position === "bottom" && idx < pipeLeads.length - 1) {
            targetLeadId = pipeLeads[idx + 1].id;
          } else {
            setDropIndicator(null); // at the very top/bottom edge — no move
            return;
          }
        }

        setDropIndicator({
          pipelineId: overLead.pipeline_id,
          position,
          targetLeadId,
        });
      } else {
        setDropIndicator({
          pipelineId: overLead.pipeline_id,
          position: "top",
          targetLeadId: overId,
        });
      }
    }
  }, [pipelines, localLeads]);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      
      // Capture drop indicator before clearing state
      const currentDropIndicator = dropIndicator;

      setActiveId(null);
      setOverId(null);
      setDropIndicator(null);

      if (!over) {
        isReorderingRef.current = false;
        return;
      }

      const activeId = active.id as string;
      const overId = over.id as string;

      const activeLead = localLeads.find((l) => l.id === activeId);
      if (!activeLead) {
        isReorderingRef.current = false;
        return;
      }

      // Check if dropping on a top-zone
      const isTopZone = overId.endsWith("-top-zone");
      const topZonePipelineId = isTopZone ? overId.replace("-top-zone", "") : null;

      // Check if dropping on a pipeline column or another lead
      const overPipeline = pipelines.find((p) => p.id === overId || p.id === topZonePipelineId);
      const overLead = localLeads.find((l) => l.id === overId);

      // Determine target pipeline
      let newPipelineId: string | null = topZonePipelineId
        ? topZonePipelineId
        : overPipeline
          ? overPipeline.id
          : overLead?.pipeline_id ?? null;

      if (!newPipelineId) {
        isReorderingRef.current = false;
        return;
      }

      // Same pipeline - handle reordering
      if (newPipelineId === activeLead.pipeline_id && overLead) {
        const pipelineLeads = sortLeadsForDisplay(localLeads.filter((l) => l.pipeline_id === newPipelineId));

        const oldIndex = pipelineLeads.findIndex((l) => l.id === activeId);
        const targetIndex = pipelineLeads.findIndex((l) => l.id === overId);

        if (oldIndex === -1 || targetIndex === -1) {
          isReorderingRef.current = false;
          return;
        }

        // Insert exactly where the visual gap showed: at the top/bottom of the
        // target card, computed in "without the dragged card" coordinates so the
        // drop matches the dashed slot 1:1 (no jump on release).
        const without = pipelineLeads.filter((l) => l.id !== activeId);
        const targetInWithout = without.findIndex((l) => l.id === overId);
        const insertAt =
          targetInWithout === -1
            ? without.length
            : currentDropIndicator?.position === "bottom"
              ? targetInWithout + 1
              : targetInWithout;

        const reorderedLeads = [
          ...without.slice(0, insertAt),
          pipelineLeads[oldIndex],
          ...without.slice(insertAt),
        ];

        // No-op if the order didn't actually change
        if (reorderedLeads.findIndex((l) => l.id === activeId) === oldIndex) {
          isReorderingRef.current = false;
          return;
        }

        // Update ordem for all reordered leads
        const updates = reorderedLeads.map((lead, index) => ({
          id: lead.id,
          ordem: index,
        }));

        // Optimistic update
        setLocalLeads((prev) =>
          prev.map((l) => {
            const update = updates.find((u) => u.id === l.id);
            return update ? { ...l, ordem: update.ordem } : l;
          })
        );

        // Update database
        try {
          for (const update of updates) {
            await supabase
              .from("leads")
              .update({ ordem: update.ordem })
              .eq("id", update.id);
          }
          
          // Also update react-query cache to prevent refetch from overwriting
          queryClient.setQueryData(["crm-leads-with-tags", subOriginId], (oldData: any) => {
            if (!oldData) return oldData;
            return oldData.map((l: any) => {
              const update = updates.find((u) => u.id === l.id);
              return update ? { ...l, ordem: update.ordem } : l;
            });
          });
        } catch (error) {
          console.error("Erro ao reordenar leads:", error);
          toast.error("Erro ao reordenar leads");
          queryClient.invalidateQueries({ queryKey: ["crm-leads-with-tags", subOriginId] });
        } finally {
          // Clear reordering flag after a short delay to let DB sync
          setTimeout(() => { isReorderingRef.current = false; }, 500);
        }
        return;
      }

      // Same pipeline - dropped on the column (not directly on a card)
      if (newPipelineId === activeLead.pipeline_id && !overLead) {
        const pipelineLeads = sortLeadsForDisplay(localLeads.filter((l) => l.pipeline_id === newPipelineId));

        const oldIndex = pipelineLeads.findIndex((l) => l.id === activeId);
        if (oldIndex === -1) {
          isReorderingRef.current = false;
          return;
        }

        const wantsBottom =
          currentDropIndicator?.pipelineId === newPipelineId &&
          currentDropIndicator?.position === "bottom";

        const targetIndex = wantsBottom ? Math.max(pipelineLeads.length - 1, 0) : 0;
        if (oldIndex === targetIndex) {
          isReorderingRef.current = false;
          return;
        }

        const reorderedLeads = arrayMove(pipelineLeads, oldIndex, targetIndex);

        const updates = reorderedLeads.map((lead, index) => ({
          id: lead.id,
          ordem: index,
        }));

        setLocalLeads((prev) =>
          prev.map((l) => {
            const update = updates.find((u) => u.id === l.id);
            return update ? { ...l, ordem: update.ordem } : l;
          })
        );

        try {
          for (const update of updates) {
            await supabase
              .from("leads")
              .update({ ordem: update.ordem })
              .eq("id", update.id);
          }

          queryClient.setQueryData<Lead[]>(["crm-leads", subOriginId], (oldData) => {
            if (!oldData) return oldData;
            return oldData.map((l) => {
              const update = updates.find((u) => u.id === l.id);
              return update ? { ...l, ordem: update.ordem } : l;
            });
          });
        } catch (error) {
          console.error("Erro ao reordenar leads:", error);
          toast.error("Erro ao reordenar leads");
          queryClient.invalidateQueries({ queryKey: ["crm-leads", subOriginId] });
        } finally {
          setTimeout(() => { isReorderingRef.current = false; }, 500);
        }

        return;
      }
      if (newPipelineId !== activeLead.pipeline_id) {
        // Check for automation on this pipeline
        const automation = automations.find(
          (a) => a.pipeline_id === newPipelineId && a.is_active
        );

        // If automation exists and has target sub_origin, transfer the lead
        if (automation && automation.target_sub_origin_id && automation.target_pipeline_id) {
          // Remove lead from local state immediately (optimistic)
          setLocalLeads((prev) => prev.filter((l) => l.id !== activeId));

          try {
            // Transfer lead to target sub-origin and pipeline
            const { error } = await supabase
              .from("leads")
              .update({
                sub_origin_id: automation.target_sub_origin_id,
                pipeline_id: automation.target_pipeline_id,
                ordem: 0,
              })
              .eq("id", activeId);

            if (error) throw error;

            // Invalidate queries for both origins to refresh data
            queryClient.invalidateQueries({ queryKey: ["crm-leads", subOriginId] });
            queryClient.invalidateQueries({ queryKey: ["crm-leads", automation.target_sub_origin_id] });

            toast.success("Lead transferido automaticamente!");
          } catch (error) {
            // Revert optimistic update
            setLocalLeads((prev) => [...prev, activeLead]);
            console.error("Erro ao transferir lead:", error);
            toast.error("Erro ao transferir lead");
          } finally {
            setTimeout(() => { isReorderingRef.current = false; }, 500);
          }
          return;
        }

        // No automation - normal pipeline move
        const targetPipelineLeads = localLeads
          .filter((l) => l.pipeline_id === newPipelineId && l.id !== activeId)
          .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

        // Determine insertion index using drop indicator for precise placement
        let insertIndex = 0;
        
        // Check if we have a specific target lead from the drop indicator
        const targetLeadId = currentDropIndicator?.targetLeadId;
        if (targetLeadId) {
          const targetIndex = targetPipelineLeads.findIndex((l) => l.id === targetLeadId);
          if (targetIndex >= 0) {
            // Insert above or below based on position
            insertIndex = currentDropIndicator?.position === "bottom" 
              ? targetIndex + 1 
              : targetIndex;
          } else {
            insertIndex = 0;
          }
        } else if (overLead && overLead.id !== activeId) {
          // Fallback: use overId if no targetLeadId
          const overIndex = targetPipelineLeads.findIndex((l) => l.id === overId);
          if (overIndex >= 0) {
            insertIndex = currentDropIndicator?.position === "bottom" 
              ? overIndex + 1 
              : overIndex;
          } else {
            insertIndex = 0;
          }
        } else {
          // Dropped on empty column or no specific position - insert at top
          insertIndex = 0;
        }

        // Calculate new ordem values
        const updatesForTarget = targetPipelineLeads.map((lead, index) => ({
          id: lead.id,
          ordem: index >= insertIndex ? index + 1 : index,
        }));

        // Optimistic update
        setLocalLeads((prev) =>
          prev.map((l) => {
            if (l.id === activeId) {
              return { ...l, pipeline_id: newPipelineId, ordem: insertIndex };
            }
            const update = updatesForTarget.find((u) => u.id === l.id);
            return update ? { ...l, ordem: update.ordem } : l;
          })
        );

        try {
          // Update the moved lead
          await supabase
            .from("leads")
            .update({ pipeline_id: newPipelineId, ordem: insertIndex })
            .eq("id", activeId);

          // Update ordem for displaced leads
          for (const update of updatesForTarget.filter((u) => u.ordem > insertIndex - 1)) {
            await supabase
              .from("leads")
              .update({ ordem: update.ordem })
              .eq("id", update.id);
          }

          // Force update the query cache to prevent stale data from overwriting local state
          queryClient.setQueryData<Lead[]>(["crm-leads", subOriginId], (oldData) => {
            if (!oldData) return oldData;
            return oldData.map((l) => {
              if (l.id === activeId) {
                return { ...l, pipeline_id: newPipelineId, ordem: insertIndex };
              }
              const upd = updatesForTarget.find((u) => u.id === l.id);
              return upd ? { ...l, ordem: upd.ordem } : l;
            });
          });

          // Trigger webhook for lead moved (fire and forget)
          const movedLead = { ...activeLead, pipeline_id: newPipelineId };
          triggerWebhook({
            trigger: "lead_moved",
            lead: movedLead as Lead,
            pipeline_id: newPipelineId,
            previous_pipeline_id: activeLead.pipeline_id,
            sub_origin_id: subOriginId,
          }).catch(console.error);

          // Track pipeline move
          const fromPipeline = pipelines.find(p => p.id === activeLead.pipeline_id);
          const toPipeline = pipelines.find(p => p.id === newPipelineId);
          trackPipelineMove({
            leadId: activeId,
            fromPipelineName: fromPipeline?.nome || "Sem pipeline",
            toPipelineName: toPipeline?.nome || "Desconhecido",
            fromPipelineId: activeLead.pipeline_id,
            toPipelineId: newPipelineId,
          }).catch(console.error);

          // Fire "lead added to pipeline" Unnichat integrations (outbound).
          supabase.functions.invoke("unnichat-dispatch", {
            body: {
              lead: { name: activeLead.name, email: (activeLead as any).email, whatsapp: (activeLead as any).whatsapp },
              sub_origin_id: subOriginId,
              pipeline_id: newPipelineId,
              trigger: "pipeline",
            },
          }).catch(() => {});

          // Email automations are handled server-side by the trigger-webhook edge function.

          // Register the move for Cmd+Z / Cmd+Y
          {
            const oldPipelineId = activeLead.pipeline_id;
            const oldOrdem = activeLead.ordem ?? 0;
            const moveLeadTo = async (pipelineId: string, ordem: number) => {
              await supabase
                .from("leads")
                .update({ pipeline_id: pipelineId, ordem })
                .eq("id", activeId);
              setLocalLeads((prev) =>
                prev.map((l) => (l.id === activeId ? { ...l, pipeline_id: pipelineId, ordem } : l))
              );
              queryClient.setQueryData<Lead[]>(["crm-leads", subOriginId], (oldData) =>
                oldData
                  ? oldData.map((l) => (l.id === activeId ? { ...l, pipeline_id: pipelineId, ordem } : l))
                  : oldData
              );
            };
            pushAction({
              label: "Mover card",
              undo: () => moveLeadTo(oldPipelineId, oldOrdem),
              redo: () => moveLeadTo(newPipelineId, insertIndex),
            });
          }

        } catch (error) {
          setLocalLeads((prev) =>
            prev.map((l) =>
              l.id === activeId
                ? { ...l, pipeline_id: activeLead.pipeline_id }
                : l
            )
          );
          console.error("Erro ao mover lead:", error);
          toast.error("Erro ao mover lead");
        } finally {
          setTimeout(() => { isReorderingRef.current = false; }, 500);
        }
      }

      // No-op drop (ex: soltou no fundo da mesma coluna): libera o lock do realtime
      isReorderingRef.current = false;
    },
    [localLeads, pipelines, automations, queryClient, subOriginId, dropIndicator]
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setOverId(null);
    setDropIndicator(null);
    isReorderingRef.current = false;
  }, []);

  const activeLead = useMemo(
    () => (activeId ? localLeads.find((l) => l.id === activeId) : null),
    [activeId, localLeads]
  );

  const displayLeads = useMemo(() => {
    let baseLeads = localLeads.length > 0 ? localLeads : leads;
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      baseLeads = baseLeads.filter(lead => 
        lead.name.toLowerCase().includes(query) ||
        lead.email.toLowerCase().includes(query) ||
        lead.clinic_name?.toLowerCase().includes(query)
      );
    }
    
    
    
    // Filter by date range based on preset or custom dates
    const now = new Date();
    let filterStartDate = startDate;
    let filterEndDate = endDate;

    if (datePreset === "thismonth") {
      filterStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
      filterEndDate = now;
    } else if (datePreset === "today") {
      filterStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      filterEndDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (datePreset === "yesterday") {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      filterStartDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
      filterEndDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
    } else if (datePreset === "7days") {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      filterStartDate = new Date(weekAgo.getFullYear(), weekAgo.getMonth(), weekAgo.getDate());
      filterEndDate = now;
    } else if (datePreset === "30days") {
      const monthAgo = new Date(now);
      monthAgo.setDate(monthAgo.getDate() - 30);
      filterStartDate = new Date(monthAgo.getFullYear(), monthAgo.getMonth(), monthAgo.getDate());
      filterEndDate = now;
    }
    
    if (filterStartDate) {
      const start = new Date(filterStartDate);
      start.setHours(0, 0, 0, 0);
      baseLeads = baseLeads.filter(lead => new Date(lead.created_at) >= start);
    }
    if (filterEndDate) {
      const end = new Date(filterEndDate);
      end.setHours(23, 59, 59, 999);
      baseLeads = baseLeads.filter(lead => new Date(lead.created_at) <= end);
    }
    
    return baseLeads;
  }, [localLeads, leads, searchQuery, datePreset, startDate, endDate]);

  const activeFilterCount = datePreset !== "all" ? 1 : 0;
  const hasActiveFilters = activeFilterCount > 0;

  const clearFilters = () => {
    setDatePreset("all");
    setStartDate(undefined);
    setEndDate(undefined);
  };

  // Memoize leads grouped by pipeline for Kanban view
  // Also track leads with null/invalid pipeline_id
  const { leadsByPipeline, orphanLeads } = useMemo(() => {
    const map = new Map<string, Lead[]>();
    const orphans: Lead[] = [];
    const pipelineIds = new Set(pipelines.map(p => p.id));
    
    pipelines.forEach(p => map.set(p.id, []));
    
    displayLeads.forEach(lead => {
      if (lead.pipeline_id && pipelineIds.has(lead.pipeline_id)) {
        // Lead has valid pipeline
        const arr = map.get(lead.pipeline_id);
        if (arr) arr.push(lead);
      } else {
        // Lead has null pipeline_id or pipeline_id doesn't exist in current pipelines
        orphans.push(lead);
      }
    });
    
    // Sort each pipeline's leads with the SAME rule the drag logic uses.
    map.forEach((pipelineLeads, pid) => {
      map.set(pid, sortLeadsForDisplay(pipelineLeads));
    });
    
    // Sort orphan leads by created_at (newest first)
    orphans.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    return { leadsByPipeline: map, orphanLeads: orphans };
  }, [displayLeads, pipelines]);

  // "Sem pipeline" (orphan) column removed — leads without a valid pipeline are not shown.
  const orphanPipeline: Pipeline | null = null;

  // Persist the real column count (incl. the orphan column) so the loading
  // skeleton renders the correct number of columns INSTANTLY on the next load —
  // no delay waiting for queries, and none missing at the end.
  const totalColumns = (orphanPipeline ? 1 : 0) + pipelines.length;
  useEffect(() => {
    if (!isLoading && subOriginId && totalColumns > 0) {
      try {
        localStorage.setItem(`crm_cols_${subOriginId}`, String(totalColumns));
        // Global last-known count for the CRM Suspense/auth fallback skeleton.
        localStorage.setItem("crm_cols_last", String(totalColumns));
      } catch { /* ignore */ }
    }
  }, [isLoading, subOriginId, totalColumns]);

  const persistedColumnCount = (() => {
    if (!subOriginId) return NaN;
    try {
      return parseInt(localStorage.getItem(`crm_cols_${subOriginId}`) || "", 10);
    } catch {
      return NaN;
    }
  })();
  const skeletonColumnCount =
    Number.isFinite(persistedColumnCount) && persistedColumnCount > 0
      ? persistedColumnCount
      : pipelines.length > 0
        ? totalColumns
        : 4;

  // Check if sub-origin doesn't exist (after loading completes)
  if (subOriginId && !isLoadingSubOrigin && !currentSubOrigin) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-2rem)] gap-4">
        <p className="text-muted-foreground">Sub-origem não encontrada</p>
        <Button variant="outline" onClick={() => window.history.back()}>
          Voltar
        </Button>
      </div>
    );
  }

  // Check if no sub-origin selected and workspace has no origins (empty workspace)
  if (!subOriginId && !resolvingOrigin && !isLoadingSubOrigin && !isLoadingPipelines) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] gap-4">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground max-w-sm">
            Comece a criar suas origens do <span className="font-bold text-foreground">negócio para organizar seus leads e pipelines.</span>
          </p>
          <button 
            onClick={() => {
              // Trigger origin creation - dispatch custom event or use existing mechanism
              const event = new CustomEvent('createOrigin');
              window.dispatchEvent(event);
            }}
            className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-black/90 transition-colors"
          >
            Criar Origem
          </button>
        </div>
      </div>
    );
  }

  // Build title based on current sub-origin
  const pageTitle = currentSubOrigin 
    ? `${currentSubOrigin.crm_origins?.nome || ''} > ${currentSubOrigin.nome}`.toUpperCase()
    : "CARREGANDO...";

  // If email builder is open, show only EmailFlowBuilder
  if (isEmailBuilderOpen && emailBuilderProps) {
    return (
      <div className="relative flex flex-col h-full w-full overflow-hidden">
        <EmailFlowBuilder
          automationName={emailBuilderProps.automationName}
          triggerPipelineName={emailBuilderProps.triggerPipelineName}
          onSave={async (steps) => {
            await emailBuilderProps.onSave(steps);
            setEmailEditingContext(null); // Clear context after successful save
            closeEmailBuilder();
          }}
          onCancel={() => {
            emailBuilderProps.onCancel();
            closeEmailBuilder();
          }}
          initialSteps={emailBuilderProps.initialSteps}
          pipelines={emailBuilderProps.pipelines || pipelines}
          subOriginId={emailBuilderProps.subOriginId || subOriginId}
          automationId={emailBuilderProps.automationId}
          pendingEmailsCount={emailBuilderProps.pendingEmailsCount || 0}
        />
      </div>
    );
  }

  const navbarSlot = typeof document !== 'undefined' ? document.getElementById('navbar-center-slot') : null;

  return (
    <>
      {/* Search in navbar via portal */}
      {navbarSlot && createPortal(
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Pesquisar leads..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9 h-8 rounded-lg bg-muted border-0 text-sm"
          />
        </div>,
        navbarSlot
      )}
    <div className="relative flex flex-col h-full overflow-hidden">
      {/* Header - all on same line */}
      <div className="flex items-center gap-4 mt-4 mb-1">
        {/* Title - left */}
        <h1 className="text-sm font-bold tracking-wide text-foreground/70 flex-shrink-0">{pageTitle}</h1>

        {/* Hidden AutomationsDropdown - controlled externally */}
        {subOriginId && (
          <div className="hidden">
            <AutomationsDropdown 
              pipelines={pipelines} 
              subOriginId={subOriginId}
              externalOpen={automationsOpen}
              onOpenChange={setAutomationsOpen}
              emailEditingContext={emailEditingContext}
              onEmailContextChange={(ctx) => setEmailEditingContext(ctx)}
              onShowEmailBuilder={(show, props) => {
                if (show && props) {
                  if (props.editingContext) {
                    setEmailEditingContext(props.editingContext);
                  }
                  openEmailBuilder(props);
                } else {
                  closeEmailBuilder();
                }
              }}
            />
          </div>
        )}

        {/* Center space */}
        <div className="flex-1" />

        {/* Right side - Search, Export and Filters */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Filters - Modern Style */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9 relative">
                <Filter className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={8} className="w-[340px] bg-popover z-[9999] p-0 overflow-hidden rounded-xl border border-black/[0.06] dark:border-white/[0.08] shadow-2xl">
              {/* Quick presets on top */}
              <div className="p-3 space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Período
                  </span>
                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Limpar
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { key: "all", label: "Máximo" },
                    { key: "today", label: "Hoje" },
                    { key: "yesterday", label: "Ontem" },
                    { key: "7days", label: "Últimos 7 dias" },
                    { key: "30days", label: "Últimos 30 dias" },
                    { key: "thismonth", label: "Este mês" },
                  ].map((preset) => (
                    <button
                      key={preset.key}
                      onClick={() => {
                        const next = datePreset === preset.key ? "all" : (preset.key as typeof datePreset);
                        setDatePreset(next);
                        setStartDate(undefined);
                        setEndDate(undefined);
                      }}
                      className={cn(
                        "w-full px-3 py-2 text-sm font-medium rounded-lg border text-center transition-all",
                        datePreset === preset.key
                          ? "bg-foreground text-background border-foreground"
                          : "bg-background border-black/[0.08] dark:border-white/[0.08] hover:bg-muted hover:border-black/20 dark:hover:border-white/20"
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Calendar below */}
              <div className="p-3 border-t border-black/[0.06] dark:border-white/[0.08]">
                <div className="flex items-center justify-between px-1 pb-1.5">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Personalizado
                  </span>
                  <span className={cn(
                    "text-xs font-medium",
                    datePreset === "custom" && (startDate || endDate) ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {startDate ? format(startDate, "dd/MM/yy", { locale: ptBR }) : "Início"}
                    {"  —  "}
                    {endDate ? format(endDate, "dd/MM/yy", { locale: ptBR }) : "Fim"}
                  </span>
                </div>
                  <Calendar
                    mode="range"
                    selected={{ from: startDate, to: endDate } as DateRange}
                    onSelect={(range: DateRange | undefined) => {
                      setStartDate(range?.from);
                      setEndDate(range?.to);
                      setDatePreset("custom");
                    }}
                    numberOfMonths={1}
                    locale={ptBR}
                    className="pointer-events-auto p-0 w-full"
                    classNames={{
                      months: "w-full",
                      month: "w-full space-y-3",
                      table: "w-full border-collapse",
                      head_row: "flex w-full",
                      head_cell: "flex-1 text-muted-foreground rounded-md font-normal text-[0.8rem]",
                      row: "flex w-full mt-1.5",
                      cell: "flex-1 h-10 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                      day: "inline-flex items-center justify-center rounded-md text-sm font-normal h-10 w-full p-0 hover:bg-accent hover:text-accent-foreground aria-selected:opacity-100 transition-colors",
                    }}
                  />
                </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Manage Pipelines Button */}
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-2 text-sm font-medium rounded-full"
            onClick={() => setIsPipelinesDialogOpen(true)}
          >
            <Plus className="w-3.5 h-3.5" />
            Pipelines
          </Button>

          {/* Settings Button */}
          <button 
            onClick={() => setSettingsDialogOpen(true)}
            className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              <circle cx="12" cy="12" r="4"/>
            </svg>
          </button>
        </div>
      </div>

      {/* View Tabs - OverView | Quadro | Calendário */}
      {subOriginId && (
        <>
           <ViewTabs
            activeView={activeView}
            onViewChange={handleViewChange}
            onSettingsClick={() => setSettingsDialogOpen(true)}
            subOriginId={subOriginId}
          />
          {/* Full-width separator line - uses negative margin to break out of px-3 padding */}
          <div className="h-px bg-border -mx-3 mb-2" />
          
          {/* Settings Dialog */}
          <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
            <DialogContent className="max-w-[1600px] w-[96vw] h-[72vh] max-h-[80vh] p-0 flex flex-col gap-0" aria-describedby={undefined}>
              <DialogTitle className="sr-only">Configurações</DialogTitle>

              {/* Header with tabs */}
              <div className="border-b border-border pt-4">

                <div className="flex items-center gap-1 px-6">
                  <button
                    onClick={() => setSettingsTab("automations")}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 text-base font-medium border-b-2 transition-colors",
                      settingsTab === "automations"
                        ? "border-purple-700 text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Zap className="w-[18px] h-[18px]" />
                    Automação
                  </button>
                  <button
                    onClick={() => setSettingsTab("webhooks")}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 text-base font-medium border-b-2 transition-colors",
                      settingsTab === "webhooks"
                        ? "border-purple-700 text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Webhook className="w-[18px] h-[18px]" />
                    WebHook
                  </button>
                  <button
                    onClick={() => setSettingsTab("integrations")}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 text-base font-medium border-b-2 transition-colors",
                      settingsTab === "integrations"
                        ? "border-purple-700 text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Blocks className="w-[18px] h-[18px]" />
                    Integrações
                  </button>
                  <button
                    onClick={() => setSettingsTab("import")}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 text-base font-medium border-b-2 transition-colors",
                      settingsTab === "import"
                        ? "border-purple-700 text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Upload className="w-[18px] h-[18px]" />
                    Importar contatos
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-auto min-h-0 pt-4">
                {settingsTab === "automations" && (
                  <div className="h-full">
                    <AutomationsDropdown 
                      pipelines={pipelines} 
                      subOriginId={subOriginId}
                      externalOpen={true}
                      onOpenChange={() => {}}
                      emailEditingContext={emailEditingContext}
                      onEmailContextChange={(ctx) => setEmailEditingContext(ctx)}
                      onShowEmailBuilder={(show, props) => {
                        if (show && props) {
                          if (props.editingContext) {
                            setEmailEditingContext(props.editingContext);
                          }
                          setSettingsDialogOpen(false);
                          openEmailBuilder(props);
                        } else {
                          closeEmailBuilder();
                        }
                      }}
                      embedded={true}
                      embeddedTab="automations"
                    />
                  </div>
                )}
                
                {settingsTab === "webhooks" && (
                  <div className="h-full">
                    <AutomationsDropdown 
                      pipelines={pipelines} 
                      subOriginId={subOriginId}
                      externalOpen={true}
                      onOpenChange={() => {}}
                      emailEditingContext={emailEditingContext}
                      onEmailContextChange={(ctx) => setEmailEditingContext(ctx)}
                      onShowEmailBuilder={(show, props) => {
                        if (show && props) {
                          if (props.editingContext) {
                            setEmailEditingContext(props.editingContext);
                          }
                          setSettingsDialogOpen(false);
                          openEmailBuilder(props);
                        } else {
                          closeEmailBuilder();
                        }
                      }}
                      embedded={true}
                      embeddedTab="webhooks"
                    />
                  </div>
                )}

                {settingsTab === "integrations" && (
                  <div className="h-full">
                    <IntegrationsTab subOriginId={subOriginId} pipelines={pipelines} />
                  </div>
                )}

                {settingsTab === "import" && (
                  <div className="h-full">
                    <ImportContactsTab
                      subOriginId={subOriginId}
                      pipelines={pipelines}
                      onImportingChange={(v) => { setImportingLeads(v); if (!v) { queryClient.invalidateQueries({ queryKey: ["crm-leads-with-tags", subOriginId] }); } }}
                    />
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}

      {!subOriginId && (
        <p className="text-sm text-muted-foreground mb-4">
          Clique em uma sub-origem no menu lateral para ver os leads
        </p>
      )}


      {/* Quadro (Kanban) View - keep mounted when visited, hide with CSS for instant switching */}
      {activeView === "quadro" && (
        <div 
          className={activeView === "quadro" ? "flex-1 min-h-0 flex flex-col" : "hidden"}
          style={{ display: activeView === "quadro" ? undefined : "none" }}
        >
          <DndContext
            sensors={sensors}
            collisionDetection={collisionDetection}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
            measuring={{
              droppable: {
                // Measure once when the drag starts so collision detection uses the
                // ORIGINAL card grid. We open the visual gap by moving the card
                // wrappers ourselves; keeping collision on the stable grid makes the
                // drop position predictable and avoids feedback/oscillation.
                strategy: MeasuringStrategy.BeforeDragging,
              },
            }}
          >
            {isLoading ? (
              <CRMColumnsSkeleton count={skeletonColumnCount} />
            ) : (
              <TooltipProvider delayDuration={300}>
                {/* Thin green gradient bar while a contact import is running server-side */}
                {importingLeads && (
                  <div className="h-1 w-full overflow-hidden bg-emerald-500/10 flex-shrink-0 mb-1 rounded-full">
                    <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-green-400 to-emerald-500 animate-[loading-progress_1.2s_ease-in-out_infinite]" />
                  </div>
                )}
                <div className="flex gap-4 overflow-x-auto overflow-y-hidden flex-1 pb-0 min-h-0 board-scroll-x">
                  {/* Orphan leads column (leads with null or invalid pipeline_id) */}
                  {orphanPipeline && (
                    <VirtualizedKanbanColumn
                      key="__orphan__"
                      pipeline={orphanPipeline}
                      leads={orphanLeads}
                      leadCount={orphanLeads.length}
                      isOver={overId === "__orphan__"}
                      subOriginId={subOriginId}
                      activeId={activeId}
                      dropIndicator={dropIndicator}
                      activePipelineId={activeLead?.pipeline_id}
                      tagsMap={tagsMap}
                    />
                  )}
                  {pipelines.map((pipeline) => (
                    <VirtualizedKanbanColumn
                      key={pipeline.id}
                      pipeline={pipeline}
                      leads={leadsByPipeline.get(pipeline.id) || []}
                      leadCount={hasActiveFilters || searchQuery ? undefined : pipelineCounts[pipeline.id]}
                      isOver={overId === pipeline.id}
                      subOriginId={subOriginId}
                      activeId={activeId}
                      dropIndicator={dropIndicator}
                      activePipelineId={activeLead?.pipeline_id}
                      tagsMap={tagsMap}
                      
                    />
                  ))}
                </div>
              </TooltipProvider>
            )}

            <DragOverlay dropAnimation={null}>
              {activeLead ? (
                <div className="rotate-2 scale-[1.02] opacity-95 cursor-grabbing pointer-events-none">
                  <KanbanCard 
                    lead={activeLead} 
                    isDragging 
                    tags={tagsMap.get(activeLead.id) || []} 
                    
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      )}

      <Suspense fallback={null}>
        <ManagePipelinesDialog
          open={isPipelinesDialogOpen}
          onOpenChange={setIsPipelinesDialogOpen}
          pipelines={pipelines}
          subOriginId={subOriginId}
          workspaceId={currentWorkspace?.id}
        />
      </Suspense>
    </div>
    </>
  );
}
