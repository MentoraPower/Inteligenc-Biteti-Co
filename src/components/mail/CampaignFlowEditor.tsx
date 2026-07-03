import { useState, useCallback, useEffect } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  type Node,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Mail,
  Plus,
  Send,
  MailOpen,
  MousePointerClick,
  Ban,
  History,
  Users,
  ChevronsLeft,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/* ---------------------------- Custom nodes ---------------------------- */

function TriggerNode({ data }: { data: { label: string } }) {
  return (
    <div className="w-[240px] px-5 py-4 rounded-lg border border-dashed border-border text-[13px] text-muted-foreground text-center select-none">
      {data.label}
      <Handle type="source" position={Position.Bottom} className="!opacity-0" isConnectable={false} />
    </div>
  );
}

function GhostNode({ data }: { data: { label: string } }) {
  return (
    <div className="w-[240px] px-5 py-4 rounded-lg border border-dashed border-border text-[13px] text-muted-foreground text-center select-none">
      {data.label}
    </div>
  );
}

function AddNode({ data }: { data: { onAdd?: () => void } }) {
  return (
    <div className="relative">
      <Handle type="target" position={Position.Top} className="!opacity-0" isConnectable={false} />
      <button
        onClick={data.onAdd}
        className="w-8 h-8 rounded-full bg-card border border-border shadow-sm flex items-center justify-center text-foreground hover:bg-accent transition-colors"
      >
        <Plus className="h-4 w-4" />
      </button>
      <Handle type="source" position={Position.Bottom} className="!opacity-0" isConnectable={false} />
    </div>
  );
}

function EmailNode({ data }: { data: { title: string } }) {
  return (
    <div className="w-[380px] rounded-xl bg-card shadow-sm border border-border overflow-hidden select-none">
      <Handle type="target" position={Position.Top} className="!opacity-0" isConnectable={false} />
      <div className="flex items-start gap-3 p-4">
        <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
          <Mail className="h-4 w-4 text-white" />
        </div>
        <p className="text-sm font-semibold leading-tight pt-0.5 whitespace-pre-line">{data.title}</p>
      </div>
      <div className="flex items-center gap-4 px-4 py-2.5 border-t border-border text-[11px] font-medium text-blue-600">
        <span className="flex items-center gap-1"><Send className="h-3 w-3" /> 0 enviados</span>
        <span className="flex items-center gap-1"><MailOpen className="h-3 w-3" /> 0% de taxa de abertura</span>
        <span className="flex items-center gap-1"><MousePointerClick className="h-3 w-3" /> 0% de taxa de cliques</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!opacity-0" isConnectable={false} />
    </div>
  );
}

function EndNode({ data }: { data: { label: string } }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground select-none">
      <Handle type="target" position={Position.Top} className="!opacity-0" isConnectable={false} />
      <Ban className="h-3.5 w-3.5" />
      <span>{data.label}</span>
    </div>
  );
}

const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  ghost: GhostNode,
  add: AddNode,
  email: EmailNode,
  end: EndNode,
};

/* ---------------------------- Editor ---------------------------- */

interface CampaignFlowEditorProps {
  automation: { id: string; name: string; is_active: boolean };
  onBack: () => void;
}

const CENTER_X = 300;

const buildNodes = (onAdd: () => void): Node[] => [
  {
    id: "trigger",
    type: "trigger",
    position: { x: CENTER_X - 120, y: 20 },
    data: { label: "Adicione um gatilho de entrada" },
    draggable: false,
  },
  {
    id: "add-contact",
    type: "ghost",
    position: { x: CENTER_X + 150, y: 20 },
    data: { label: "adicionar contato à automação" },
    draggable: false,
  },
  {
    id: "add-1",
    type: "add",
    position: { x: CENTER_X - 16, y: 150 },
    data: { onAdd },
    draggable: false,
  },
  {
    id: "email",
    type: "email",
    position: { x: CENTER_X - 190, y: 220 },
    data: { title: "Enviar um\nemail" },
    draggable: false,
  },
  {
    id: "add-2",
    type: "add",
    position: { x: CENTER_X - 16, y: 370 },
    data: { onAdd },
    draggable: false,
  },
  {
    id: "end",
    type: "end",
    position: { x: CENTER_X - 90, y: 445 },
    data: { label: "A automação é encerrada" },
    draggable: false,
  },
];

const edgeStyle = { stroke: "#d4d4d8", strokeWidth: 1.5 };
const initialEdges = [
  { id: "e1", source: "trigger", target: "add-1", type: "straight", style: edgeStyle },
  { id: "e2", source: "add-1", target: "email", type: "straight", style: edgeStyle },
  { id: "e3", source: "email", target: "add-2", type: "straight", style: edgeStyle },
  { id: "e4", source: "add-2", target: "end", type: "straight", style: edgeStyle },
];

export function CampaignFlowEditor({ automation, onBack }: CampaignFlowEditorProps) {
  const [active, setActive] = useState(!!automation.is_active);
  const handleAdd = useCallback(() => toast.info("Adicionar etapa — em breve"), []);

  // Tell the layout to collapse the Mail submenu while the editor is open,
  // and reopen it when returning to the list.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("mail-editor", { detail: { open: true } }));
    return () => {
      window.dispatchEvent(new CustomEvent("mail-editor", { detail: { open: false } }));
    };
  }, []);

  const [nodes, , onNodesChange] = useNodesState(buildNodes(handleAdd));
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const toggleActive = async (next: boolean) => {
    setActive(next);
    const { error } = await (supabase as any)
      .from("email_automations")
      .update({ is_active: next })
      .eq("id", automation.id);
    if (error) {
      setActive(!next);
      toast.error("Erro ao atualizar status");
    }
  };

  return (
    <div className="h-full flex flex-col bg-background pt-2">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 h-14 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-1.5 text-sm">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors font-medium"
          >
            <ChevronLeft className="h-4 w-4" /> Automações
          </button>
          <span className="text-muted-foreground">/</span>
          <span className="font-semibold">{automation.name}</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <History className="h-3.5 w-3.5" /> Salvo
          </span>
          <button className="h-8 px-3 rounded-lg border border-border text-sm font-medium hover:bg-accent transition-colors">
            <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Ver contatos</span>
          </button>

          {/* Active / Inactive toggle */}
          <div className="flex items-center rounded-lg border border-border overflow-hidden text-xs font-medium">
            <button
              onClick={() => toggleActive(true)}
              className={cn(
                "flex items-center gap-1.5 px-3 h-8 transition-colors",
                active ? "bg-emerald-500/15 text-emerald-600" : "text-muted-foreground hover:bg-accent"
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-emerald-500" : "bg-muted-foreground/40")} />
              Ativo
            </button>
            <button
              onClick={() => toggleActive(false)}
              className={cn(
                "flex items-center gap-1.5 px-3 h-8 transition-colors border-l border-border",
                !active ? "bg-zinc-500/15 text-foreground" : "text-muted-foreground hover:bg-accent"
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", !active ? "bg-zinc-400" : "bg-muted-foreground/40")} />
              Inativo
            </button>
          </div>

          <button className="h-8 w-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:bg-accent transition-colors">
            <ChevronsLeft className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Flow canvas */}
      <div className="flex-1 min-h-0">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
          minZoom={0.3}
          maxZoom={2}
          nodesConnectable={false}
          elementsSelectable={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} color="#d4d4d8" />
          <MiniMap position="bottom-left" pannable className="!bottom-16" />
          <Controls position="bottom-left" showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
}
