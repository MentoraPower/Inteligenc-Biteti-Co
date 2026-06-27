import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Pipeline } from "@/types/crm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Check, GripVertical, X } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

interface ManagePipelinesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelines: Pipeline[];
  subOriginId: string | null;
  workspaceId?: string | null;
  embedded?: boolean;
}

interface SortablePipelineItemProps {
  pipeline: Pipeline;
  editingId: string | null;
  editingName: string;
  setEditingId: (id: string | null) => void;
  setEditingName: (name: string) => void;
  updatePipeline: (id: string) => void;
  deletePipeline: (id: string) => void;
  isDragging?: boolean;
  isOverlay?: boolean;
}

function SortablePipelineItem({
  pipeline,
  editingId,
  editingName,
  setEditingId,
  setEditingName,
  updatePipeline,
  deletePipeline,
  isDragging = false,
  isOverlay = false,
  isFirst = false,
  isLast = false,
}: SortablePipelineItemProps & { isFirst?: boolean; isLast?: boolean }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: pipeline.id, disabled: isOverlay });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: undefined,
  };

  const dragging = isDragging || isSortableDragging;

  return (
    <div
      ref={isOverlay ? undefined : setNodeRef}
      style={isOverlay ? undefined : style}
      className={cn(
        "group flex-shrink-0 w-60 min-h-[340px] rounded-xl border p-3.5 flex flex-col gap-3 transition-all",
        "bg-muted/40 dark:bg-white/[0.03] border-black/[0.06] dark:border-white/[0.08]",
        dragging && !isOverlay && "opacity-30 border-dashed",
        isOverlay && "shadow-2xl border-foreground/20 bg-card"
      )}
    >
      {/* Header: drag handle + name */}
      <div className="flex items-center gap-2 min-w-0">
        <div
          {...(isOverlay ? {} : attributes)}
          {...(isOverlay ? {} : listeners)}
          className={cn(
            "p-1 -ml-1 rounded-md transition-all cursor-grab active:cursor-grabbing touch-none flex-shrink-0",
            isOverlay ? "opacity-100" : "opacity-30 group-hover:opacity-100 hover:bg-muted"
          )}
        >
          <GripVertical className="w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>
        {editingId === pipeline.id && !isOverlay ? (
          <Input
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") updatePipeline(pipeline.id);
              if (e.key === "Escape") setEditingId(null);
            }}
            onClick={(e) => e.stopPropagation()}
            autoFocus
            className="h-9 flex-1 text-sm rounded"
          />
        ) : (
          <span className="font-semibold text-[15px] truncate flex-1">
            {pipeline.nome}
          </span>
        )}
      </div>

      {/* Actions — edit & delete (or save/cancel while editing) */}
      {!isOverlay && (
        editingId === pipeline.id ? (
          <div className="mt-auto flex items-center gap-1.5">
            <Button
              size="sm"
              className="flex-1 h-9 rounded gap-1.5 text-sm bg-green-600 hover:bg-green-700 text-white"
              onClick={() => updatePipeline(pipeline.id)}
            >
              <Check className="h-4 w-4" /> Salvar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-9 w-9 p-0 rounded flex-shrink-0"
              onClick={() => setEditingId(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="mt-auto flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-9 rounded gap-1.5 text-sm"
              onClick={() => {
                setEditingId(pipeline.id);
                setEditingName(pipeline.nome);
              }}
            >
              <Pencil className="h-4 w-4" /> Editar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-9 w-9 p-0 rounded flex-shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => deletePipeline(pipeline.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )
      )}
    </div>
  );
}

export function ManagePipelinesDialog({
  open,
  onOpenChange,
  pipelines,
  subOriginId,
  workspaceId,
  embedded = false,
}: ManagePipelinesDialogProps) {
  const queryClient = useQueryClient();
  const [newPipelineName, setNewPipelineName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Pipeline | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [localPipelines, setLocalPipelines] = useState<Pipeline[]>([]);

  // Sync local state with props
  useEffect(() => {
    const sorted = [...pipelines].sort((a, b) => a.ordem - b.ordem);
    setLocalPipelines(sorted);
  }, [pipelines]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const activePipeline = activeId ? localPipelines.find(p => p.id === activeId) : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const oldIndex = localPipelines.findIndex((p) => p.id === active.id);
    const newIndex = localPipelines.findIndex((p) => p.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // Optimistic update - immediately update local state
    const reorderedPipelines = arrayMove(localPipelines, oldIndex, newIndex);
    setLocalPipelines(reorderedPipelines);

    // Background database update
    try {
      const updates = reorderedPipelines.map((pipeline, index) => ({
        id: pipeline.id,
        ordem: index,
      }));

      // Use Promise.all for parallel updates
      await Promise.all(
        updates.map((update) =>
          supabase
            .from("pipelines")
            .update({ ordem: update.ordem })
            .eq("id", update.id)
        )
      );

      queryClient.invalidateQueries({ queryKey: ["pipelines", subOriginId] });
    } catch (error) {
      // Revert on error
      setLocalPipelines([...pipelines].sort((a, b) => a.ordem - b.ordem));
      console.error("Erro ao reordenar pipelines:", error);
      toast.error("Erro ao reordenar pipelines");
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  const addPipeline = async () => {
    if (!newPipelineName.trim()) return;

    try {
      const maxOrdem = Math.max(...pipelines.map((p) => p.ordem), -1);
      const { error } = await supabase.from("pipelines").insert({
        nome: newPipelineName,
        ordem: maxOrdem + 1,
        cor: "#6366f1",
        sub_origin_id: subOriginId,
        workspace_id: workspaceId,
      });

      if (error) throw error;

      setNewPipelineName("");
      queryClient.invalidateQueries({ queryKey: ["pipelines", subOriginId] });
      toast.success("Pipeline adicionada!");
    } catch (error) {
      console.error("Erro ao adicionar pipeline:", error);
      toast.error("Erro ao adicionar pipeline");
    }
  };

  const deletePipeline = async (id: string) => {
    try {
      const { error } = await supabase.from("pipelines").delete().eq("id", id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["pipelines", subOriginId] });
      toast.success("Pipeline removida!");
    } catch (error) {
      console.error("Erro ao remover pipeline:", error);
      toast.error("Erro ao remover pipeline");
    }
  };

  const updatePipeline = async (id: string) => {
    if (!editingName.trim()) return;

    try {
      const { error } = await supabase
        .from("pipelines")
        .update({ nome: editingName })
        .eq("id", id);

      if (error) throw error;

      setEditingId(null);
      setEditingName("");
      queryClient.invalidateQueries({ queryKey: ["pipelines", subOriginId] });
      toast.success("Pipeline atualizada!");
    } catch (error) {
      console.error("Erro ao atualizar pipeline:", error);
      toast.error("Erro ao atualizar pipeline");
    }
  };

  const content = (
    <div className={cn("space-y-4 min-w-0", embedded ? "px-6 pb-6" : "px-6 py-6")}>
      {/* Add New Pipeline */}
      <div className="flex gap-3">
        <Input
          placeholder="Nome da nova pipeline..."
          value={newPipelineName}
          onChange={(e) => setNewPipelineName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addPipeline();
          }}
          className="flex-1 h-11 rounded"
        />
        <Button
          onClick={addPipeline}
          className="h-11 px-6 rounded bg-foreground text-background hover:bg-foreground/90 shrink-0"
        >
          <Plus className="w-5 h-5 mr-2" />
          Adicionar
        </Button>
      </div>

      {/* Pipelines — horizontal blocks with horizontal scroll */}
      <div className="min-w-0 w-full overflow-x-auto overflow-y-hidden pb-3 pt-1 kanban-scroll">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext
            items={localPipelines.map((p) => p.id)}
            strategy={horizontalListSortingStrategy}
          >
            <div className="flex gap-3 w-max">
              {localPipelines.map((pipeline) => (
                <SortablePipelineItem
                  key={pipeline.id}
                  pipeline={pipeline}
                  editingId={editingId}
                  editingName={editingName}
                  setEditingId={setEditingId}
                  setEditingName={setEditingName}
                  updatePipeline={updatePipeline}
                  deletePipeline={(id) => {
                    const p = localPipelines.find((x) => x.id === id);
                    if (p) setPendingDelete(p);
                  }}
                  isDragging={activeId === pipeline.id}
                />
              ))}
            </div>
          </SortableContext>

          {typeof document !== "undefined"
            ? createPortal(
                <DragOverlay
                  zIndex={99999}
                  dropAnimation={null}
                >
                  {activePipeline ? (
                    <SortablePipelineItem
                      pipeline={activePipeline}
                      editingId={null}
                      editingName=""
                      setEditingId={() => {}}
                      setEditingName={() => {}}
                      updatePipeline={() => {}}
                      deletePipeline={() => {}}
                      isOverlay
                    />
                  ) : null}
                </DragOverlay>,
                document.body
              )
            : null}
        </DndContext>
      </div>

      {pipelines.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">Nenhuma pipeline criada ainda.</p>
          <p className="text-xs mt-1">Adicione uma pipeline usando o campo acima.</p>
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar pipeline</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja apagar a pipeline{" "}
              <span className="font-semibold text-foreground">"{pendingDelete?.nome}"</span>? Os leads
              dela ficarão sem pipeline. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async (e) => {
                e.preventDefault();
                if (!pendingDelete) return;
                setIsDeleting(true);
                await deletePipeline(pendingDelete.id);
                setIsDeleting(false);
                setPendingDelete(null);
              }}
            >
              {isDeleting ? "Apagando..." : "Apagar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl w-[95vw] max-h-[90vh] overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/30 dark:border-white/[0.06] bg-muted/30">
          <DialogTitle className="text-lg font-semibold">Gerenciar Pipelines</DialogTitle>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
