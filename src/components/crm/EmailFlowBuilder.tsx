import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { sanitizeHtml } from "@/lib/sanitize";
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  BackgroundVariant,
  Handle,
  Position,
  NodeProps,
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getStraightPath,
  getSmoothStepPath,
  EdgeProps,
  useReactFlow,
  ConnectionLineComponentProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Play, Clock, Pause, CheckCircle2, Trash2, Copy, ArrowLeft, ArrowUp, Plus, Mail, Zap, ChevronDown, Users, UserX, ChartPie, TrendingUp, AlertCircle, CheckCheck, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import gmailLogo from "@/assets/gmail-logo.png";


// Connection dropdown state interface
interface ConnectionDropdown {
  x: number;
  y: number;
  sourceNodeId: string;
  sourceHandleId: string | null;
}

interface Pipeline {
  id: string;
  nome: string;
  sub_origin_id?: string | null;
}

// Trigger type interface
interface TriggerItem {
  id: string;
  type: string;
  pipelineId?: string;
}

interface SavedEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

interface EmailFlowStep {
  id: string;
  type: "trigger" | "start" | "wait" | "email" | "end" | "entry" | "analytics" | "_edges";
  position?: { x: number; y: number };
  data: {
    label?: string;
    waitTime?: number;
    waitUnit?: "minutes" | "hours" | "days" | "months";
    subject?: string;
    bodyHtml?: string;
    triggers?: TriggerItem[];
    // Analytics node
    connectedNodeId?: string;
    connectedNodeType?: "email";
    // Legacy support
    triggerType?: string;
    triggerPipelineId?: string;
    // Edges storage (for _edges type)
    edges?: SavedEdge[];
  };
}

// Entry Node Component - Fully rounded pill shape "Start"
const EntryNode = ({ data }: NodeProps) => {
  return (
    <div className="px-6 py-3 rounded-full bg-background/30 backdrop-blur-xl border border-border shadow-sm transition-all flex items-center gap-2">
      <Play className="w-4 h-4 text-foreground" />
      <span className="text-sm font-semibold text-foreground tracking-wide">Start</span>
      <Handle
        id="entry-out"
        type="source"
        position={Position.Right}
        isConnectable
        className="!w-3.5 !h-3.5 !bg-purple-700 !border-[3px] !border-white !cursor-crosshair !shadow-sm"
      />
    </div>
  );
};

// Custom animated connection line while dragging
const AnimatedConnectionLine = ({
  fromX,
  fromY,
  toX,
  toY,
}: ConnectionLineComponentProps) => {
  return (
    <g>
      <path
        fill="none"
        stroke="#7e22ce"
        strokeWidth={2}
        strokeDasharray="8 4"
        strokeLinecap="round"
        d={`M${fromX},${fromY} C ${fromX + 50},${fromY} ${toX - 50},${toY} ${toX},${toY}`}
        style={{
          animation: "dash 0.5s linear infinite",
        }}
      />
      <circle
        cx={toX}
        cy={toY}
        r={6}
        fill="#7e22ce"
        stroke="white"
        strokeWidth={2}
      />
      <style>
        {`
          @keyframes dash {
            to {
              stroke-dashoffset: -12;
            }
          }
        `}
      </style>
    </g>
  );
};

// Group triggers removed — only lead-moved automations are supported.
const GROUP_TRIGGER_TYPES: { id: string; label: string; icon: any; description: string }[] = [];

// Trigger Node Component - Main entry point with multiple triggers
const TriggerNode = ({ data, id, selected }: NodeProps & { data: { 
  label: string; 
  triggers?: TriggerItem[];
  pipelines?: Pipeline[];
  onTriggersChange?: (triggers: TriggerItem[]) => void;
  // Legacy support
  triggerType?: string; 
  triggerPipelineId?: string;
}}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownCategory, setDropdownCategory] = useState<"pipeline" | "group" | null>(null);
  
  // Convert legacy single trigger to array format
  const getTriggers = (): TriggerItem[] => {
    if (data.triggers && data.triggers.length > 0) {
      return data.triggers;
    }
    if (data.triggerType) {
      return [{ id: "legacy-1", type: data.triggerType, pipelineId: data.triggerPipelineId }];
    }
    return [];
  };
  
  const triggers = getTriggers();

  // Filter out pipelines that are already selected as triggers
  const selectedPipelineIds = triggers.map(t => t.pipelineId).filter(Boolean);
  const availablePipelines = data.pipelines?.filter(p => !selectedPipelineIds.includes(p.id)) || [];

  // Filter out group triggers that are already added
  const selectedGroupTypes = triggers.map(t => t.type).filter(type => 
    GROUP_TRIGGER_TYPES.some(gt => gt.id === type)
  );
  const availableGroupTriggers = GROUP_TRIGGER_TYPES.filter(gt => !selectedGroupTypes.includes(gt.id));

  const getTriggerLabel = (trigger: TriggerItem) => {
    if (trigger.type === "lead_entered_pipeline" && trigger.pipelineId) {
      const pipeline = data.pipelines?.find(p => p.id === trigger.pipelineId);
      return `Lead entrou em: ${pipeline?.nome || ""}`;
    }
    
    const groupTrigger = GROUP_TRIGGER_TYPES.find(gt => gt.id === trigger.type);
    if (groupTrigger) {
      return groupTrigger.label;
    }
    
    return "Lead entrou em pipeline";
  };

  const getTriggerIcon = (trigger: TriggerItem) => {
    const groupTrigger = GROUP_TRIGGER_TYPES.find(gt => gt.id === trigger.type);
    if (groupTrigger) {
      const Icon = groupTrigger.icon;
      return <Icon className="w-4 h-4 text-purple-700" />;
    }
    return <Zap className="w-4 h-4 text-purple-700" />;
  };

  const addTriggerWithPipeline = (pipelineId: string) => {
    const newTrigger: TriggerItem = {
      id: `trigger-${Date.now()}`,
      type: "lead_entered_pipeline",
      pipelineId,
    };
    const newTriggers = [...triggers, newTrigger];
    if (data.onTriggersChange) {
      data.onTriggersChange(newTriggers);
    }
    setIsDropdownOpen(false);
    setDropdownCategory(null);
  };

  const addGroupTrigger = (triggerType: string) => {
    const newTrigger: TriggerItem = {
      id: `trigger-${Date.now()}`,
      type: triggerType,
    };
    const newTriggers = [...triggers, newTrigger];
    if (data.onTriggersChange) {
      data.onTriggersChange(newTriggers);
    }
    setIsDropdownOpen(false);
    setDropdownCategory(null);
  };

  const removeTrigger = (triggerId: string) => {
    const newTriggers = triggers.filter(t => t.id !== triggerId);
    if (data.onTriggersChange) {
      data.onTriggersChange(newTriggers);
    }
  };

  const hasAvailableTriggers = availablePipelines.length > 0 || availableGroupTriggers.length > 0;

  return (
    <div className="relative">
      <Handle
        id="trigger-in"
        type="target"
        position={Position.Left}
        isConnectable
        className="!w-3.5 !h-3.5 !bg-purple-700 !border-[3px] !border-white !shadow-sm"
      />
      <div 
        className="min-w-[280px] border border-border bg-card transition-all rounded-xl"
      >
        {/* Orange accent header */}
        <div 
          className="px-4 py-4 flex items-center gap-3 rounded-t-xl"
          style={{ background: "linear-gradient(135deg, #F97316 0%, #EA580C 100%)" }}
        >
          <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="text-base font-semibold text-white">Gatilho</span>
        </div>
        
        {/* Triggers list */}
        <div className="p-3 space-y-2">
          {triggers.map((trigger, index) => (
            <div 
              key={trigger.id}
              className="relative group"
            >
              <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-muted/30">
                {getTriggerIcon(trigger)}
                <div className="flex-1">
                  <span className="text-sm text-foreground font-medium">{getTriggerLabel(trigger)}</span>
                </div>
                <button
                  onClick={() => removeTrigger(trigger.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 text-destructive"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              
              <Handle
                type="source"
                position={Position.Right}
                id={`trigger-handle-${index}`}
                className="!w-3.5 !h-3.5 !bg-purple-700 !border-[3px] !border-white !shadow-sm"
                style={{ top: "50%", transform: "translateY(-50%)" }}
              />
            </div>
          ))}
          
          {/* Add trigger button with dashed border */}
          {hasAvailableTriggers && (
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-full p-3 rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-muted-foreground/50 hover:bg-muted/20 transition-all flex items-center justify-center gap-2 text-muted-foreground"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm font-medium">Adicionar gatilho</span>
            </button>
          )}
        </div>
      </div>
      
      {/* Category selection dropdown */}
      {isDropdownOpen && !dropdownCategory && (
        <div 
          className="absolute left-3 right-3 rounded-lg shadow-xl nodrag"
          style={{ 
            zIndex: 9999, 
            backgroundColor: '#ffffff',
            top: 'calc(100% - 8px)',
            border: '1px solid #e5e7eb'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-2 text-xs font-semibold text-muted-foreground border-b border-gray-100" style={{ backgroundColor: '#f9fafb' }}>
            Selecione o tipo de gatilho
          </div>
          
          {availablePipelines.length > 0 && (
            <button
              onClick={() => setDropdownCategory("pipeline")}
              className="w-full px-3 py-2.5 text-left text-sm hover:bg-gray-100 transition-colors flex items-center gap-2 text-foreground"
              style={{ backgroundColor: '#ffffff' }}
            >
              <Zap className="w-4 h-4 text-purple-700" />
              <div className="flex-1">
                <div className="font-medium">Entrou em Pipeline</div>
                <div className="text-xs text-muted-foreground">Quando lead entra em uma pipeline</div>
              </div>
              <ChevronDown className="w-4 h-4 text-muted-foreground -rotate-90" />
            </button>
          )}
          
          {availableGroupTriggers.length > 0 && (
            <button
              onClick={() => setDropdownCategory("group")}
              className="w-full px-3 py-2.5 text-left text-sm hover:bg-gray-100 transition-colors flex items-center gap-2 text-foreground last:rounded-b-lg"
              style={{ backgroundColor: '#ffffff' }}
            >
              <Users className="w-4 h-4 text-purple-700" />
              <div className="flex-1">
                <div className="font-medium">Gatilhos de Grupo</div>
                <div className="text-xs text-muted-foreground">Relacionados a grupos</div>
              </div>
              <ChevronDown className="w-4 h-4 text-muted-foreground -rotate-90" />
            </button>
          )}
        </div>
      )}

      {/* Pipeline selection dropdown */}
      {isDropdownOpen && dropdownCategory === "pipeline" && availablePipelines.length > 0 && (
        <div 
          className="absolute left-3 right-3 rounded-lg shadow-xl nodrag"
          style={{ 
            zIndex: 9999, 
            backgroundColor: '#ffffff',
            top: 'calc(100% - 8px)',
            border: '1px solid #e5e7eb'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setDropdownCategory(null)}
            className="w-full px-3 py-2 text-xs font-semibold text-muted-foreground border-b border-gray-100 flex items-center gap-1 hover:bg-gray-50"
            style={{ backgroundColor: '#f9fafb' }}
          >
            <ChevronDown className="w-3 h-3 rotate-90" />
            Voltar
          </button>
          <div className="px-3 py-2 text-xs font-semibold text-muted-foreground border-b border-gray-100" style={{ backgroundColor: '#f9fafb' }}>
            Lead entrou em pipeline
          </div>
          {availablePipelines.map(pipeline => (
            <button
              key={pipeline.id}
              onClick={() => addTriggerWithPipeline(pipeline.id)}
              className="w-full px-3 py-2.5 text-left text-sm hover:bg-gray-100 transition-colors flex items-center gap-2 text-foreground last:rounded-b-lg"
              style={{ backgroundColor: '#ffffff' }}
            >
              <Zap className="w-4 h-4 text-[#F40000]" />
              {pipeline.nome}
            </button>
          ))}
        </div>
      )}

      {/* Group triggers selection dropdown */}
      {isDropdownOpen && dropdownCategory === "group" && availableGroupTriggers.length > 0 && (
        <div 
          className="absolute left-3 right-3 rounded-lg shadow-xl nodrag"
          style={{ 
            zIndex: 9999, 
            backgroundColor: '#ffffff',
            top: 'calc(100% - 8px)',
            border: '1px solid #e5e7eb'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setDropdownCategory(null)}
            className="w-full px-3 py-2 text-xs font-semibold text-muted-foreground border-b border-gray-100 flex items-center gap-1 hover:bg-gray-50"
            style={{ backgroundColor: '#f9fafb' }}
          >
            <ChevronDown className="w-3 h-3 rotate-90" />
            Voltar
          </button>
          <div className="px-3 py-2 text-xs font-semibold text-muted-foreground border-b border-gray-100" style={{ backgroundColor: '#f9fafb' }}>
            Gatilhos de Grupo
          </div>
          {availableGroupTriggers.map(groupTrigger => {
            const Icon = groupTrigger.icon;
            return (
              <button
                key={groupTrigger.id}
                onClick={() => addGroupTrigger(groupTrigger.id)}
                className="w-full px-3 py-2.5 text-left text-sm hover:bg-gray-100 transition-colors flex items-center gap-2 text-foreground last:rounded-b-lg"
                style={{ backgroundColor: '#ffffff' }}
              >
                <Icon className="w-4 h-4 text-[#F40000]" />
                <div>
                  <div className="font-medium">{groupTrigger.label}</div>
                  <div className="text-xs text-muted-foreground">{groupTrigger.description}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Start Node Component - Pill shape, black/white (legacy support)
const StartNode = ({ data }: NodeProps) => {
  return (
    <div className="px-5 py-2.5 rounded-full border border-foreground bg-foreground shadow-sm transition-all flex items-center gap-2">
      <Play className="w-4 h-4 text-background fill-background" />
      <span className="text-sm font-medium text-background">{data.label as string}</span>
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3.5 !h-3.5 !bg-purple-700 !border-[3px] !border-white !shadow-sm"
      />
    </div>
  );
};

// Wait Node Component - Modern yellow design with dropdown
const WaitNode = ({ data, id, selected }: NodeProps) => {
  const { setNodes, setEdges } = useReactFlow();
  const [isEditing, setIsEditing] = useState(false);
  const [localWaitTime, setLocalWaitTime] = useState((data.waitTime as number) || 1);
  const [localWaitUnit, setLocalWaitUnit] = useState((data.waitUnit as string) || "hours");
  
  const waitTime = (data.waitTime as number) || 1;
  const waitUnit = (data.waitUnit as string) || "hours";
  const pendingCount = (data.pendingCount as number) || 0;
  
  const unitLabels: Record<string, string> = {
    seconds: "segundos",
    minutes: "minutos",
    hours: "horas",
    days: "dias",
    months: "meses",
  };

  // Auto-save on change while editing
  useEffect(() => {
    if (!isEditing) return;
    
    const timeout = setTimeout(() => {
      setNodes((nds) =>
        nds.map((node) =>
          node.id === id
            ? { ...node, data: { ...node.data, waitTime: localWaitTime, waitUnit: localWaitUnit } }
            : node
        )
      );
    }, 300);

    return () => clearTimeout(timeout);
  }, [localWaitTime, localWaitUnit, isEditing, id, setNodes]);

  const handleOpen = () => {
    setLocalWaitTime(waitTime);
    setLocalWaitUnit(waitUnit);
    setIsEditing(true);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  };

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNodes((nds) => {
      const currentNode = nds.find((n) => n.id === id);
      if (!currentNode) return nds;
      const maxZIndex = Math.max(...nds.map((n) => n.zIndex ?? 0), 0);
      return [
        ...nds,
        {
          ...currentNode,
          id: `wait-${Date.now()}`,
          position: { x: currentNode.position.x + 350, y: currentNode.position.y + 50 },
          selected: false,
          zIndex: maxZIndex + 1,
        },
      ];
    });
  };

  return (
    <div className="relative">
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3.5 !h-3.5 !bg-gray-600 !border-[3px] !border-white !shadow-sm !z-10"
      />
      
      {/* Square card - icon only */}
      <div 
        className="w-20 h-20 bg-white border border-gray-300 transition-all rounded-2xl cursor-pointer hover:shadow-lg hover:border-gray-400 flex items-center justify-center shadow-sm"
        onClick={handleOpen}
      >
        <Pause className="w-9 h-9 text-gray-600" />
      </div>
      
      {/* Pending count badge - on the connection line */}
      {pendingCount > 0 && (
        <div className="absolute -right-3 top-1/2 -translate-y-1/2 translate-x-full flex items-center bg-gray-600 rounded-full w-6 h-6 justify-center shadow-md z-20">
          <span className="text-[10px] font-bold text-white">{pendingCount}</span>
        </div>
      )}

      {/* Editor Dropdown - Side */}
      {isEditing && (
        <div className="absolute top-0 left-full ml-2 w-[280px] bg-background border border-border rounded-lg shadow-xl z-50 nodrag">
          <div className="p-4 border-b border-border bg-muted/30">
            <h4 className="text-sm font-semibold text-foreground">Configurar tempo</h4>
          </div>
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Tempo</label>
                <Input
                  type="number"
                  min={1}
                  value={localWaitTime}
                  onChange={(e) => setLocalWaitTime(parseInt(e.target.value) || 1)}
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Unidade</label>
                <Select
                  value={localWaitUnit}
                  onValueChange={(v) => setLocalWaitUnit(v)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="seconds">Segundos</SelectItem>
                    <SelectItem value="minutes">Minutos</SelectItem>
                    <SelectItem value="hours">Horas</SelectItem>
                    <SelectItem value="days">Dias</SelectItem>
                    <SelectItem value="months">Meses</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button size="sm" onClick={() => setIsEditing(false)} className="bg-foreground text-background hover:bg-foreground/90">
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="!w-3.5 !h-3.5 !bg-gray-600 !border-[3px] !border-white !shadow-sm !z-10"
      />

      {/* Action buttons - slide down from top */}
      <div 
        className={`absolute left-1/2 -translate-x-1/2 flex gap-1.5 transition-all duration-200 nodrag ${
          selected ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'
        }`}
        style={{ bottom: 'calc(100% + 8px)' }}
      >
        <button
          onClick={handleDuplicate}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-background border border-border hover:bg-muted/60 transition-colors text-xs font-medium text-foreground shadow-sm"
        >
          <Copy className="w-3.5 h-3.5" />
          Duplicar
        </button>
        <button
          onClick={handleDelete}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-destructive/10 border border-destructive/30 hover:bg-destructive/20 transition-colors text-xs font-medium text-destructive shadow-sm"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Apagar
        </button>
      </div>
    </div>
  );
};

// Email Node Component - Large preview with dropdown editor
const EmailNode = ({ id, data, selected }: NodeProps) => {
  const { setNodes, setEdges } = useReactFlow();
  const [isEditing, setIsEditing] = useState(false);
  const [localSubject, setLocalSubject] = useState((data.subject as string) || "");
  const [localBodyHtml, setLocalBodyHtml] = useState((data.bodyHtml as string) || "");
  
  const subject = (data.subject as string) || "";
  const bodyHtml = (data.bodyHtml as string) || "";

  // Auto-save on change while editing
  useEffect(() => {
    if (!isEditing) return;
    
    const timeout = setTimeout(() => {
      setNodes((nds) =>
        nds.map((node) =>
          node.id === id
            ? { ...node, data: { ...node.data, subject: localSubject, bodyHtml: localBodyHtml } }
            : node
        )
      );
    }, 300); // Debounce 300ms

    return () => clearTimeout(timeout);
  }, [localSubject, localBodyHtml, isEditing, id, setNodes]);

  const handleOpen = () => {
    setLocalSubject(subject);
    setLocalBodyHtml(bodyHtml);
    setIsEditing(true);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  };

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNodes((nds) => {
      const currentNode = nds.find((n) => n.id === id);
      if (!currentNode) return nds;
      const maxZIndex = Math.max(...nds.map((n) => n.zIndex ?? 0), 0);
      return [
        ...nds,
        {
          ...currentNode,
          id: `email-${Date.now()}`,
          position: { x: currentNode.position.x + 400, y: currentNode.position.y + 50 },
          selected: false,
          zIndex: maxZIndex + 1,
        },
      ];
    });
  };

  return (
    <div className="relative">
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3.5 !h-3.5 !bg-purple-700 !border-[3px] !border-white !shadow-sm !z-10"
      />
      <div className="w-[320px] border border-border bg-background shadow-sm transition-all rounded-lg overflow-hidden">
        {/* Orange gradient header with Gmail logo */}
        <div 
          className="px-4 py-2.5 flex items-center justify-between cursor-pointer hover:opacity-90 transition-opacity"
          style={{ background: "linear-gradient(135deg, #F97316 0%, #EA580C 100%)" }}
          onClick={handleOpen}
        >
          <div className="flex items-center gap-3">
            <img src={gmailLogo} alt="Gmail" className="w-7 h-7 rounded" />
            <span className="text-xs font-semibold text-white uppercase tracking-wide">E-mail</span>
          </div>
          <span className="text-white/70 text-xs">Clique para editar</span>
        </div>
        
        {/* Email Preview - Large */}
        <div className="p-2 bg-card min-h-[400px]">
          <div 
            className="bg-card rounded border border-border p-2 min-h-[380px] text-xs overflow-y-auto nodrag nowheel [&_*]:!text-xs [&_*]:!leading-tight"
            style={{ maxHeight: "390px", fontSize: "11px" }}
            onWheelCapture={(e) => e.stopPropagation()}
            dangerouslySetInnerHTML={{ 
              __html: sanitizeHtml(bodyHtml || '<div style="color:#999; font-style:italic;">Clique para editar o e-mail...</div>') 
            }}
          />
        </div>

        {/* Editor Dropdown - Side */}
        {isEditing && (
          <div className="absolute top-0 left-full ml-2 w-[500px] bg-background border border-border rounded-lg shadow-xl z-50 nodrag">
            <div className="p-4 border-b border-border bg-muted/30">
              <h4 className="text-sm font-semibold text-foreground">Editar E-mail</h4>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Assunto</label>
                <Input
                  value={localSubject}
                  onChange={(e) => setLocalSubject(e.target.value)}
                  placeholder="Ex: {{nome}}, seu e-book está pronto!"
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Código HTML</label>
                <Textarea
                  value={localBodyHtml}
                  onChange={(e) => setLocalBodyHtml(e.target.value)}
                  onWheelCapture={(e) => e.stopPropagation()}
                  placeholder="<h1>Olá {{nome}}!</h1>&#10;<p>Seu conteúdo aqui...</p>"
                  className="h-[200px] text-xs font-mono resize-none overflow-y-auto nowheel"
                />
              </div>
              <div className="flex justify-end pt-2">
                <Button size="sm" onClick={() => setIsEditing(false)} className="bg-foreground text-background hover:bg-foreground/90">
                  Fechar
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-3.5 !h-3.5 !bg-purple-700 !border-[3px] !border-white !shadow-sm !z-10"
      />

      {/* Action buttons - slide down from top */}
      <div 
        className={`absolute left-1/2 -translate-x-1/2 flex gap-1.5 transition-all duration-200 nodrag ${
          selected ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'
        }`}
        style={{ bottom: 'calc(100% + 8px)' }}
      >
        <button
          onClick={handleDuplicate}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-background border border-border hover:bg-muted/60 transition-colors text-xs font-medium text-foreground shadow-sm"
        >
          <Copy className="w-3.5 h-3.5" />
          Duplicar
        </button>
        <button
          onClick={handleDelete}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-destructive/10 border border-destructive/30 hover:bg-destructive/20 transition-colors text-xs font-medium text-destructive shadow-sm"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Apagar
        </button>
      </div>
    </div>
  );
};


// Analytics Node Component - Shows metrics for connected email nodes
// Analytics metrics type
type AnalyticsMetrics = {
  sent: number;
  failed: number;
  pending: number;
  opens: number;
  clicks: number;
  byDayOfWeek: { day: string; count: number }[];
};

const AnalyticsNode = ({ id, data, selected }: NodeProps) => {
  const { setNodes, setEdges, getEdges, getNodes } = useReactFlow();
  const activeTab = "email" as const;
  const [emailMetrics, setEmailMetrics] = useState<AnalyticsMetrics>({ sent: 0, failed: 0, pending: 0, opens: 0, clicks: 0, byDayOfWeek: [] });
  const [isLoadingEmail, setIsLoadingEmail] = useState(false);
  const [connectedTypes, setConnectedTypes] = useState<{ email: boolean }>({ email: false });

  // Get automationId from node data (passed from parent)
  const automationId = (data as any)?.automationId;

  // Find all connected source nodes (can be multiple)
  useEffect(() => {
    const edges = getEdges();
    const nodes = getNodes();
    const incomingEdges = edges.filter(e => e.target === id);
    
    let hasEmail = false;

    incomingEdges.forEach(edge => {
      const sourceNode = nodes.find(n => n.id === edge.source);
      if (sourceNode?.type === "email") hasEmail = true;
    });

    setConnectedTypes({ email: hasEmail });
  }, [id, getEdges, getNodes]);

  // Fetch email metrics filtered by automationId
  useEffect(() => {
    if (!connectedTypes.email) return;

    const fetchEmailMetrics = async () => {
      setIsLoadingEmail(true);
      try {
        if (automationId) {
          // Get scheduled emails for this automation
          const { data: scheduledEmails, error: schedError } = await (supabase as any)
            .from("scheduled_emails")
            .select("id, status, created_at, sent_at")
            .eq("automation_id", automationId);

          if (schedError) throw schedError;

          const sent = scheduledEmails?.filter(e => e.status === "sent").length || 0;
          const failed = scheduledEmails?.filter(e => e.status === "failed" || e.status === "cancelled").length || 0;
          const pending = scheduledEmails?.filter(e => e.status === "pending").length || 0;

          // Get tracking events for these emails
          const emailIds = scheduledEmails?.filter(e => e.status === "sent").map(e => e.id) || [];
          let opens = 0;
          let clicks = 0;

          if (emailIds.length > 0) {
            const { data: trackingEvents } = await (supabase as any)
              .from("email_tracking_events")
              .select("event_type, scheduled_email_id")
              .in("scheduled_email_id", emailIds);

            if (trackingEvents) {
              // Count unique opens (one per email)
              const uniqueOpens = new Set(trackingEvents.filter(e => e.event_type === "open").map(e => e.scheduled_email_id));
              opens = uniqueOpens.size;
              
              // Count unique clicks (one per email)
              const uniqueClicks = new Set(trackingEvents.filter(e => e.event_type === "click").map(e => e.scheduled_email_id));
              clicks = uniqueClicks.size;
            }
          }

          const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
          const dayCounts = [0, 0, 0, 0, 0, 0, 0];
          
          scheduledEmails?.forEach(email => {
            if (email.status === "sent" && email.sent_at) {
              const date = new Date(email.sent_at);
              dayCounts[date.getDay()]++;
            }
          });

          setEmailMetrics({
            sent,
            failed,
            pending,
            opens,
            clicks,
            byDayOfWeek: dayNames.map((day, i) => ({ day, count: dayCounts[i] })),
          });
        } else {
          // No automationId - show zeros (start from now)
          setEmailMetrics({
            sent: 0,
            failed: 0,
            pending: 0,
            opens: 0,
            clicks: 0,
            byDayOfWeek: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(day => ({ day, count: 0 })),
          });
        }
      } catch (error) {
        console.error("Error fetching email analytics:", error);
        setEmailMetrics({
          sent: 0,
          failed: 0,
          pending: 0,
          opens: 0,
          clicks: 0,
          byDayOfWeek: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(day => ({ day, count: 0 })),
        });
      } finally {
        setIsLoadingEmail(false);
      }
    };

    fetchEmailMetrics();
  }, [connectedTypes.email, automationId]);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  };

  const hasAnyConnection = connectedTypes.email;
  const currentMetrics = emailMetrics;
  const isLoading = isLoadingEmail;
  const maxCount = Math.max(...currentMetrics.byDayOfWeek.map(d => d.count), 1);
  const totalMessages = currentMetrics.sent + currentMetrics.failed + currentMetrics.pending;
  const successRate = totalMessages > 0 ? Math.round((currentMetrics.sent / totalMessages) * 100) : 0;

  return (
    <div className="relative">
      <Handle
        type="target"
        position={Position.Left}
        className="!w-4 !h-4 !bg-purple-700 !border-[3px] !border-white !shadow-md !z-10"
      />
      
      {/* Node Card - Wider and more modern */}
      <div 
        className={cn(
          "bg-background border transition-all shadow-lg rounded-2xl w-[820px] overflow-hidden border-border"
        )}
      >
        {/* Header - Dark Gray */}
        <div className="px-4 py-3 flex items-center justify-between bg-zinc-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-background/10 backdrop-blur-sm flex items-center justify-center shadow-inner">
              <ChartPie className="w-5 h-5 text-background" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-background tracking-tight">Análise de Métricas</h4>
              <p className="text-xs text-background/70">
                {connectedTypes.email ? "Métricas de E-mail" : "Conecte para visualizar"}
              </p>
            </div>
          </div>
        </div>
        
        {/* Content */}
        <div className="p-4">
          {!hasAnyConnection ? (
            <div className="text-center py-6 text-muted-foreground">
              <div className="w-12 h-12 rounded-xl bg-purple-200 flex items-center justify-center mx-auto mb-3">
                <ChartPie className="w-6 h-6 text-purple-700" />
              </div>
              <p className="text-sm font-medium">Nenhuma conexão detectada</p>
              <p className="text-xs mt-1 text-muted-foreground/70">
                Arraste uma conexão de um nó de E-mail
              </p>
            </div>
          ) : (
            <>
              {isLoading ? (
                <div className="text-center py-6">
                  <div className="animate-spin w-6 h-6 border-2 border-t-transparent rounded-full mx-auto border-purple-700" />
                  <p className="text-xs text-muted-foreground mt-2">Carregando...</p>
                </div>
              ) : (
                <>
                  {/* Stats Grid - Compact */}
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div className="border border-border rounded-lg p-3 text-center">
                      <p className="text-xl font-bold text-zinc-700">{currentMetrics.sent}</p>
                      <p className="text-xs font-medium text-muted-foreground">Enviados</p>
                    </div>
                    <div className="border border-border rounded-lg p-3 text-center">
                      <p className="text-xl font-bold text-zinc-700">{currentMetrics.failed}</p>
                      <p className="text-xs font-medium text-muted-foreground">Falhas</p>
                    </div>
                    <div className="border border-border rounded-lg p-3 text-center">
                      <p className="text-xl font-bold text-zinc-700">{currentMetrics.pending}</p>
                      <p className="text-xs font-medium text-muted-foreground">Pendentes</p>
                    </div>
                  </div>

                  {/* Email-only: Opens and Clicks */}
                  {activeTab === "email" && currentMetrics.sent > 0 && (
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="border border-border rounded-lg p-3 text-center">
                        <p className="text-xl font-bold text-zinc-700">
                          {currentMetrics.opens}
                          <span className="text-sm font-normal text-muted-foreground ml-1">
                            ({currentMetrics.sent > 0 ? Math.round((currentMetrics.opens / currentMetrics.sent) * 100) : 0}%)
                          </span>
                        </p>
                        <p className="text-xs font-medium text-muted-foreground">Aberturas</p>
                      </div>
                      <div className="border border-border rounded-lg p-3 text-center">
                        <p className="text-xl font-bold text-zinc-700">
                          {currentMetrics.clicks}
                          <span className="text-sm font-normal text-muted-foreground ml-1">
                            ({currentMetrics.sent > 0 ? Math.round((currentMetrics.clicks / currentMetrics.sent) * 100) : 0}%)
                          </span>
                        </p>
                        <p className="text-xs font-medium text-muted-foreground">Cliques</p>
                      </div>
                    </div>
                  )}

                  {/* Day of Week Chart */}
                  {currentMetrics.byDayOfWeek.length > 0 && (
                    <div className="bg-muted/30 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-sm font-semibold text-foreground">
                          Disparos por dia
                        </p>
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">
                          Últimos 30 dias
                        </span>
                      </div>
                      <div className="flex items-end justify-between gap-2 h-24">
                        {currentMetrics.byDayOfWeek.map((day, i) => (
                          <div key={i} className="flex-1 flex flex-col items-center gap-2">
                            <div className="relative w-full group">
                              <div 
                                className="w-full rounded-lg transition-all cursor-default bg-gradient-to-t from-zinc-600 to-zinc-500 shadow-sm hover:shadow-md"
                                style={{ 
                                  height: `${Math.max((day.count / maxCount) * 80, 8)}px`,
                                }}
                              />
                              {/* Tooltip on hover */}
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-foreground text-background text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                                {day.count} envios
                              </div>
                            </div>
                            <span className="text-xs font-semibold text-muted-foreground">{day.day}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div 
        className={`absolute left-1/2 -translate-x-1/2 flex gap-2 transition-all duration-200 nodrag ${
          selected ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'
        }`}
        style={{ bottom: 'calc(100% + 10px)' }}
      >
        <button
          onClick={handleDelete}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-destructive/10 border border-destructive/30 hover:bg-destructive/20 transition-colors text-sm font-medium text-destructive shadow-sm backdrop-blur-sm"
        >
          <Trash2 className="w-4 h-4" />
          Apagar
        </button>
      </div>
    </div>
  );
};

// End Node Component - Pill shape, black/white with delete
const EndNode = ({ data, id, selected }: NodeProps) => {
  const { setNodes, setEdges } = useReactFlow();

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  };

  return (
    <div className="relative">
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3.5 !h-3.5 !bg-gray-600 !border-[3px] !border-white !shadow-sm !z-10"
      />
      
      {/* Square card with rounded corners */}
      <div className="w-20 h-20 bg-white border border-gray-300 transition-all rounded-2xl flex items-center justify-center shadow-sm">
        <CheckCircle2 className="w-9 h-9 text-gray-600" />
      </div>

      {/* Action button - slide down from top */}
      <div 
        className={`absolute left-1/2 -translate-x-1/2 flex gap-1.5 transition-all duration-200 nodrag ${
          selected ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'
        }`}
        style={{ bottom: 'calc(100% + 8px)' }}
      >
        <button
          onClick={handleDelete}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-destructive/10 border border-destructive/30 hover:bg-destructive/20 transition-colors text-xs font-medium text-destructive shadow-sm"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Apagar
        </button>
      </div>
    </div>
  );
};

const nodeTypes = {
  entry: EntryNode,
  trigger: TriggerNode,
  start: StartNode,
  wait: WaitNode,
  email: EmailNode,
  analytics: AnalyticsNode,
  end: EndNode,
};

// Custom Edge with + button
interface CustomEdgeProps extends EdgeProps {
  data?: {
    onAddNode?: (edgeId: string, type: "wait" | "email") => void;
    onDeleteEdge?: (edgeId: string) => void;
  };
}

const CustomEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: CustomEdgeProps) => {
  // Use getSmoothStepPath for clean orthogonal (90°) edges
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition: sourcePosition || Position.Right,
    targetX,
    targetY,
    targetPosition: targetPosition || Position.Left,
    borderRadius: 0, // Sharp 90° corners for straight lines
  });

  const gradientId = `edge-gradient-${id}`.replace(/[^a-zA-Z0-9_-]/g, "_");

  return (
    <>
      <defs>
        <linearGradient
          id={gradientId}
          gradientUnits="userSpaceOnUse"
          x1={sourceX}
          y1={sourceY}
          x2={targetX}
          y2={targetY}
        >
          <stop offset="0%" stopColor="#F97316" />
          <stop offset="100%" stopColor="#EA580C" />
        </linearGradient>
      </defs>
      <path
        d={edgePath}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={3}
        strokeDasharray="8 5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          animation: "flowDash 1s linear infinite",
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "all",
          }}
          className="nodrag nopan"
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-7 h-7 rounded-full bg-background border-2 border-purple-700 shadow-md flex items-center justify-center hover:bg-purple-100 hover:scale-110 transition-all">
                <Plus className="w-4 h-4 text-purple-700" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-40">
              <DropdownMenuItem onClick={() => data?.onAddNode?.(id, "wait")}>
                <Pause className="w-4 h-4 mr-2 text-gray-600" />
                Tempo de Espera
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => data?.onAddNode?.(id, "email")}>
                <Mail className="w-4 h-4 mr-2" />
                Enviar E-mail
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => data?.onDeleteEdge?.(id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Apagar conexão
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

const edgeTypes = {
  custom: CustomEdge,
};

interface EmailFlowBuilderProps {
  initialSteps?: EmailFlowStep[];
  onSave: (steps: EmailFlowStep[]) => void;
  onCancel: () => void;
  onChange?: (steps: EmailFlowStep[]) => void;
  automationName: string;
  triggerPipelineName?: string;
  pipelines?: Pipeline[];
  subOriginId?: string | null;
  automationId?: string;
  pendingEmailsCount?: number;
  hideHeader?: boolean;
}

export function EmailFlowBuilder({
  initialSteps,
  onSave,
  onCancel,
  onChange,
  automationName,
  triggerPipelineName,
  pipelines = [],
  subOriginId,
  automationId,
  pendingEmailsCount = 0,
  hideHeader = false,
}: EmailFlowBuilderProps) {
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [triggerType, setTriggerType] = useState<string>("");
  const [triggerPipelineId, setTriggerPipelineId] = useState<string>("");
  const [connectionDropdown, setConnectionDropdown] = useState<ConnectionDropdown | null>(null);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  // Filter pipelines for current sub-origin
  const filteredPipelines = useMemo(() => {
    if (!subOriginId) return pipelines;
    return pipelines.filter(p => p.sub_origin_id === subOriginId);
  }, [pipelines, subOriginId]);

  // Handle triggers changes from the node (new array format)
  const handleTriggersChange = useCallback((triggers: TriggerItem[]) => {
    // Update the trigger node data
    setNodes((nds) => nds.map((n) => {
      if (n.type === "trigger") {
        return {
          ...n,
          data: {
            ...n.data,
            triggers,
          },
        };
      }
      return n;
    }));
  }, []);

  // Initialize nodes and edges (use saved positions if available)
  const initialNodes: Node[] = useMemo(() => {
    if (initialSteps?.length) {
      // Filter out the _edges type which is used for storing edges
      const nodeSteps = initialSteps.filter(step => step.type !== "_edges");
      
      // Check if entry node exists
      const hasEntryNode = nodeSteps.some(step => step.type === "entry");
      const nodes = nodeSteps.map((step, index) => {
        // Convert old 'start' nodes to 'trigger' nodes
        const nodeType = step.type === "start" ? "trigger" : step.type;
        return {
          id: step.id,
          type: nodeType,
          position: step.position || { x: 150 + index * 220, y: 200 },
          data: {
            ...step.data,
            pipelines: filteredPipelines,
            onTriggersChange: handleTriggersChange,
            // Pass automationId to analytics nodes
            ...(nodeType === "analytics" ? { automationId } : {}),
          },
        };
      });
      
      // If no entry node, add one before trigger
      if (!hasEntryNode) {
        const triggerNode = nodes.find(n => n.type === "trigger");
        if (triggerNode) {
          nodes.unshift({
            id: "entry-1",
            type: "entry",
            position: { x: triggerNode.position.x - 200, y: triggerNode.position.y + 50 },
            data: { label: "Start" } as any,
          });
        }
      }
      
      return nodes;
    }
    return [
      {
        id: "entry-1",
        type: "entry",
        position: { x: 100, y: 250 },
        data: { label: "Start" } as any,
      },
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 300, y: 200 },
        data: { 
          label: "Gatilho",
          triggers: [],
          pipelines: filteredPipelines,
          onTriggersChange: handleTriggersChange,
        },
      },
    ];
  }, [initialSteps, filteredPipelines, handleTriggersChange, automationId]);

  const initialEdges: Edge[] = useMemo(() => {
    if (initialSteps?.length) {
      // Check if edges are saved in the steps (look for _edges type)
      const edgesStep = initialSteps.find(step => step.type === "_edges");
      if (edgesStep?.data?.edges && edgesStep.data.edges.length > 0) {
        // Use saved edges
        return edgesStep.data.edges.map((e: SavedEdge) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle || null,
          targetHandle: e.targetHandle || null,
          type: "custom",
        }));
      }

      // Legacy fallback: reconstruct edges sequentially
      const nodeSteps = initialSteps.filter(step => step.type !== "_edges");
      const hasEntryNode = nodeSteps.some(step => step.type === "entry");
      const edges: Edge[] = nodeSteps.slice(0, -1).map((step, index) => ({
        id: `e-${step.id}-${nodeSteps[index + 1].id}`,
        source: step.id,
        target: nodeSteps[index + 1].id,
        type: "custom",
      }));
      
      // Add entry -> trigger edge if entry node was added
      if (!hasEntryNode) {
        const triggerNode = nodeSteps.find(step => step.type === "trigger" || step.type === "start");
        if (triggerNode) {
          edges.unshift({
            id: `e-entry-1-${triggerNode.id}`,
            source: "entry-1",
            sourceHandle: "entry-out",
            target: triggerNode.id,
            targetHandle: "trigger-in",
            type: "custom",
          });
        }
      }
      
      return edges;
    }
    // Default: connect entry to trigger
    return [{
      id: "e-entry-1-trigger-1",
      source: "entry-1",
      sourceHandle: "entry-out",
      target: "trigger-1",
      targetHandle: "trigger-in",
      type: "custom",
    }];
  }, [initialSteps]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Ensure Start (entry) is always connected to the first Trigger
  useEffect(() => {
    const entryNode = nodes.find((n) => n.type === "entry");
    const triggerNode = nodes.find((n) => n.type === "trigger");
    if (!entryNode || !triggerNode) return;

    setEdges((eds) => {
      // Remove duplicate entry->trigger edges
      const entryToTrigger = eds.filter((e) => e.source === entryNode.id && e.target === triggerNode.id);

      const desired: Partial<Edge> = {
        sourceHandle: "entry-out",
        targetHandle: "trigger-in",
        type: "custom",
      };

      if (entryToTrigger.length === 0) {
        return [
          ...eds,
          {
            id: `e-${entryNode.id}-${triggerNode.id}`,
            source: entryNode.id,
            target: triggerNode.id,
            ...(desired as any),
          } as Edge,
        ];
      }

      // Keep the first, fix handles, drop the rest
      const keepId = entryToTrigger[0].id;
      const next = eds
        .filter((e) => !(e.source === entryNode.id && e.target === triggerNode.id && e.id !== keepId))
        .map((e) => {
          if (e.id !== keepId) return e;
          return {
            ...e,
            ...desired,
          } as Edge;
        });

      return next;
    });
  }, [nodes, setEdges]);

  useEffect(() => {
    if (filteredPipelines.length > 0) {
      setNodes((nds) => nds.map((n) => {
        if (n.type === "trigger") {
          return {
            ...n,
            data: {
              ...n.data,
              pipelines: filteredPipelines,
              onTriggersChange: handleTriggersChange,
            },
          };
        }
        return n;
      }));
    }
  }, [filteredPipelines, handleTriggersChange, setNodes]);

  // Inject pendingEmailsCount into wait nodes
  useEffect(() => {
    if (pendingEmailsCount > 0) {
      setNodes((nds) => nds.map((n) => {
        if (n.type === "wait") {
          return {
            ...n,
            data: {
              ...n.data,
              pendingCount: pendingEmailsCount,
            },
          };
        }
        return n;
      }));
    }
  }, [pendingEmailsCount, setNodes]);

  // Call onChange when nodes or edges change (for auto-save)
  useEffect(() => {
    if (!onChange) return;
    
    // Build steps from current nodes and edges
    const steps: EmailFlowStep[] = nodes
      .filter(n => n.type !== "entry")
      .map(node => ({
        id: node.id,
        type: node.type as EmailFlowStep["type"],
        data: node.data,
        position: node.position,
      }));

    // Store edges in a special step
    steps.push({
      id: "_edges",
      type: "_edges" as any,
      data: {
        edges: edges.map(e => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle,
          targetHandle: e.targetHandle,
        })),
      },
    });

    onChange(steps);
  }, [nodes, edges, onChange]);

  const onConnect = useCallback(
    (params: Connection) => {
      setConnectionDropdown(null);
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: "custom",
          },
          eds
        )
      );
    },
    [setEdges]
  );

  // Handle connection end (when user drags connection line and releases)
  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent, connectionState: any) => {
      // Only show dropdown if connection was not completed (dropped on empty space)
      if (!connectionState.isValid && connectionState.fromNode) {
        const targetIsPane = (event.target as HTMLElement).classList.contains('react-flow__pane');
        
        if (targetIsPane && reactFlowWrapper.current) {
          const { clientX, clientY } = 'changedTouches' in event ? event.changedTouches[0] : event;
          const bounds = reactFlowWrapper.current.getBoundingClientRect();
          
          setConnectionDropdown({
            x: clientX - bounds.left,
            y: clientY - bounds.top,
            sourceNodeId: connectionState.fromNode.id,
            sourceHandleId: connectionState.fromHandle?.id || null,
          });
        }
      }
    },
    []
  );

  // Add node from connection dropdown
  const addNodeFromConnection = useCallback((type: "wait" | "email" | "end" | "analytics") => {
    if (!connectionDropdown || !reactFlowWrapper.current) return;

    const newId = `${type}-${Date.now()}`;
    const defaultData: Record<string, any> = {
      wait: { label: "Espera", waitTime: 1, waitUnit: "hours" },
      email: { label: "E-mail", subject: "", bodyHtml: "" },
      analytics: { label: "Análise", automationId },
      end: { label: "Fim" },
    };

    // Convert screen position to flow position (approximate)
    const newNode: Node = {
      id: newId,
      type,
      position: { 
        x: connectionDropdown.x - 100, 
        y: connectionDropdown.y - 50 
      },
      data: defaultData[type],
    };

    setNodes((nds) => [...nds, newNode]);

    // Connect from source node to new node
    setEdges((eds) => [
      ...eds,
      {
        id: `e-${connectionDropdown.sourceNodeId}-${newId}`,
        source: connectionDropdown.sourceNodeId,
        sourceHandle: connectionDropdown.sourceHandleId,
        target: newId,
        type: "custom",
      },
    ]);

    setConnectionDropdown(null);
  }, [connectionDropdown, setNodes, setEdges, automationId]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const addNode = useCallback((type: string, position?: { x: number; y: number }) => {
    const lastNode = nodes[nodes.length - 1];

    const nodeType = type;

    const newId = `${nodeType}-${Date.now()}`;
    const newX = position?.x ?? (lastNode ? lastNode.position.x + 220 : 100);
    const newY = position?.y ?? 200;

    const defaultData: Record<string, any> = {
      wait: { label: "Espera", waitTime: 1, waitUnit: "hours" },
      email: { label: "E-mail", subject: "", bodyHtml: "" },
      analytics: { label: "Análise", automationId },
      end: { label: "Fim" },
    };

    const newNode: Node = {
      id: newId,
      type: nodeType,
      position: { x: newX, y: newY },
      data: defaultData[nodeType] || defaultData.email,
    };

    setNodes((nds) => [...nds, newNode]);

    // Auto-connect to last node only if no position was specified (non-drag)
    if (!position && lastNode) {
      setEdges((eds) => [
        ...eds,
        {
          id: `e-${lastNode.id}-${newId}`,
          source: lastNode.id,
          target: newId,
          type: "custom",
        },
      ]);
    }
  }, [nodes, setNodes, setEdges, automationId]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData("application/reactflow");
      if (!type) return;

      const reactFlowBounds = event.currentTarget.getBoundingClientRect();
      const position = {
        x: event.clientX - reactFlowBounds.left - 100,
        y: event.clientY - reactFlowBounds.top - 50,
      };

      addNode(type, position);
    },
    [addNode]
  );

  // Add node between two connected nodes
  const addNodeBetween = useCallback((edgeId: string, type: "wait" | "email") => {
    const edge = edges.find((e) => e.id === edgeId);
    if (!edge) return;

    const sourceNode = nodes.find((n) => n.id === edge.source);
    const targetNode = nodes.find((n) => n.id === edge.target);
    if (!sourceNode || !targetNode) return;

    const newId = `${type}-${Date.now()}`;
    const defaultData: Record<string, any> = {
      wait: { label: "Espera", waitTime: 1, waitUnit: "hours" },
      email: { label: "E-mail", subject: "", bodyHtml: "" },
    };

    // Position the new node between source and target
    const newNode: Node = {
      id: newId,
      type,
      position: {
        x: (sourceNode.position.x + targetNode.position.x) / 2,
        y: (sourceNode.position.y + targetNode.position.y) / 2,
      },
      data: defaultData[type],
    };

    // Remove the old edge and create two new edges
    setNodes((nds) => [...nds, newNode]);
    setEdges((eds) => [
      ...eds.filter((e) => e.id !== edgeId),
      {
        id: `e-${edge.source}-${newId}`,
        source: edge.source,
        target: newId,
        type: "custom",
      },
      {
        id: `e-${newId}-${edge.target}`,
        source: newId,
        target: edge.target,
        type: "custom",
      },
    ]);
  }, [edges, nodes, setNodes, setEdges]);

  // Delete edge
  const deleteEdge = useCallback((edgeId: string) => {
    setEdges((eds) => eds.filter((e) => e.id !== edgeId));
  }, [setEdges]);

  // Use refs for stable callback references to avoid re-renders
  const addNodeBetweenRef = useRef(addNodeBetween);
  addNodeBetweenRef.current = addNodeBetween;

  const deleteEdgeRef = useRef(deleteEdge);
  deleteEdgeRef.current = deleteEdge;

  // Memoized edges with data callbacks - only recalculates when edges change
  const edgesWithData = useMemo(() => 
    edges.map((edge) => ({
      ...edge,
      data: {
        onAddNode: (edgeId: string, type: "wait" | "email") => 
          addNodeBetweenRef.current(edgeId, type),
        onDeleteEdge: (edgeId: string) => 
          deleteEdgeRef.current(edgeId),
      },
    })),
    [edges]
  );


  const handleSave = () => {
    // Get trigger data from the trigger node
    const triggerNode = nodes.find(n => n.type === "trigger");
    
    // Check for triggers array (new format) or legacy triggerType
    const triggers = triggerNode?.data?.triggers as TriggerItem[] | undefined;
    const hasTriggers = triggers && triggers.length > 0;
    const legacyTriggerType = triggerNode?.data?.triggerType as string || triggerType;
    
    // Validate: must have at least one trigger configured
    if (!hasTriggers && !legacyTriggerType) {
      console.warn("No trigger type selected");
    }

    // Save nodes as steps
    const nodeSteps: EmailFlowStep[] = nodes.map((node) => ({
      id: node.id,
      type: node.type as EmailFlowStep["type"],
      position: { x: node.position.x, y: node.position.y },
      data: {
        ...node.data as EmailFlowStep["data"],
        // Clean up internal props before saving
        pipelines: undefined,
        onTriggerChange: undefined,
        onTriggersChange: undefined,
      },
    }));

    // Save edges as a special step type
    const edgesStep: EmailFlowStep = {
      id: "_edges",
      type: "_edges",
      data: {
        edges: edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle || null,
          targetHandle: e.targetHandle || null,
        })),
      },
    };

    // Combine nodes and edges
    const steps = [...nodeSteps, edgesStep];
    onSave(steps);
  };

  // Get current trigger label for header
  const getTriggerHeaderLabel = () => {
    const triggerNode = nodes.find(n => n.type === "trigger");
    const type = triggerNode?.data?.triggerType as string || triggerType;
    const pipelineId = triggerNode?.data?.triggerPipelineId as string || triggerPipelineId;
    
    if (!type) return "Nenhum gatilho definido";
    
    const triggerLabels: Record<string, string> = {
      lead_created: "Lead criado",
      lead_updated: "Lead atualizado", 
      lead_entered_pipeline: "Lead entrou em pipeline",
    };
    
    if (type === "lead_entered_pipeline" && pipelineId) {
      const pipeline = filteredPipelines.find(p => p.id === pipelineId);
      return `${triggerLabels[type]}: ${pipeline?.nome || ""}`;
    }
    
    return triggerLabels[type] || type;
  };

  return (
    <div className="flex flex-col h-full w-full bg-muted/30 rounded-2xl overflow-hidden border border-border">
      {/* Header */}
      {!hideHeader && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onCancel} className="h-8 w-8">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h2 className="text-sm font-semibold text-foreground">{automationName}</h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onCancel}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} className="bg-foreground text-background hover:bg-foreground/90">
              Salvar fluxo
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* Left Sidebar */}
        <div className="border-r border-border bg-background p-4 flex flex-col gap-3 w-48">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Ações</span>
          
          {/* Wait Node */}
          <div
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("application/reactflow", "wait");
              e.dataTransfer.effectAllowed = "move";
            }}
            className="flex items-center gap-3 cursor-grab active:cursor-grabbing hover:bg-muted/50 rounded-xl p-2.5 transition-colors border border-border w-full"
          >
            <div className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 border border-gray-200 flex-shrink-0">
              <Pause className="w-4 h-4 text-gray-600" />
            </div>
            <span className="text-sm text-foreground">Espera</span>
          </div>

          {/* Email Node */}
          <div
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("application/reactflow", "email");
              e.dataTransfer.effectAllowed = "move";
            }}
            className="flex items-center gap-3 cursor-grab active:cursor-grabbing hover:bg-muted/50 rounded-xl p-2.5 transition-colors border border-border w-full"
          >
            <div className="w-8 h-8 flex items-center justify-center rounded-full bg-white flex-shrink-0">
              <img src={gmailLogo} alt="Gmail" className="w-5 h-5 object-contain" />
            </div>
            <span className="text-sm text-foreground">E-mail</span>
          </div>

          {/* Analytics Node */}
          <div
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("application/reactflow", "analytics");
              e.dataTransfer.effectAllowed = "move";
            }}
            className="flex items-center gap-3 cursor-grab active:cursor-grabbing hover:bg-muted/50 rounded-xl p-2.5 transition-colors border border-border w-full"
          >
            <div className="w-8 h-8 flex items-center justify-center rounded-full bg-purple-200 border border-purple-300 flex-shrink-0">
              <ChartPie className="w-4 h-4 text-purple-800" />
            </div>
            <span className="text-sm text-foreground">Análise</span>
          </div>

          {/* End Node */}
          <div
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("application/reactflow", "end");
              e.dataTransfer.effectAllowed = "move";
            }}
            className="flex items-center gap-3 cursor-grab active:cursor-grabbing hover:bg-muted/50 rounded-xl p-2.5 transition-colors border border-border w-full"
          >
            <div className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 border border-gray-200 flex-shrink-0">
              <CheckCircle2 className="w-4 h-4 text-gray-600" />
            </div>
            <span className="text-sm text-foreground">Finalizar</span>
          </div>
        </div>

        {/* Flow Canvas */}
        <div className="flex-1 relative" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edgesWithData}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onConnectEnd={onConnectEnd}
            onNodeClick={onNodeClick}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onPaneClick={() => setConnectionDropdown(null)}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            connectionLineComponent={AnimatedConnectionLine}
            fitView
            snapToGrid
            snapGrid={[20, 20]}
            defaultEdgeOptions={{
              type: "custom",
            }}
            proOptions={{ hideAttribution: true }}
          >
            <Controls 
              className="!bg-background !border-border !shadow-sm !rounded-lg"
              showInteractive={false}
            />
            <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#d4d4d8" />
          </ReactFlow>

          {/* Connection Dropdown - shows when dragging connection to empty space */}
          {connectionDropdown && (
            <div
              className="absolute z-50 bg-background rounded-lg shadow-xl border border-border overflow-hidden"
              style={{
                left: connectionDropdown.x,
                top: connectionDropdown.y,
                transform: 'translate(-50%, -50%)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-3 py-2 text-xs font-semibold text-muted-foreground border-b border-border bg-muted/30">
                Adicionar ação
              </div>
              <div className="py-1">
                <button
                  onClick={() => addNodeFromConnection("wait")}
                  className="w-full px-3 py-2.5 text-left text-sm hover:bg-muted/50 transition-colors flex items-center gap-2"
                >
                  <Pause className="w-4 h-4 text-gray-600" />
                  <span className="text-foreground">Tempo de Espera</span>
                </button>
                <button
                  onClick={() => addNodeFromConnection("email")}
                  className="w-full px-3 py-2.5 text-left text-sm hover:bg-muted/50 transition-colors flex items-center gap-2"
                >
                  <Mail className="w-4 h-4 text-foreground" />
                  <span className="text-foreground">Enviar E-mail</span>
                </button>
                <button
                  onClick={() => addNodeFromConnection("analytics")}
                  className="w-full px-3 py-2.5 text-left text-sm hover:bg-muted/50 transition-colors flex items-center gap-2"
                >
                  <ChartPie className="w-4 h-4 text-purple-700" />
                  <span className="text-foreground">Análise</span>
                </button>
                <button
                  onClick={() => addNodeFromConnection("end")}
                  className="w-full px-3 py-2.5 text-left text-sm hover:bg-muted/50 transition-colors flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 text-gray-600" />
                  <span className="text-foreground">Finalizar</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
