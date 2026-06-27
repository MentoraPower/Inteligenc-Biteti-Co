import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLeadActivities, LeadActivity } from "@/hooks/use-lead-activities";
import { StepNavigation } from "./StepNavigation";
import { AddActivityDialog } from "./AddActivityDialog";
import { ActivityDetails } from "./ActivityDetails";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, MoreVertical, Trash2, Pencil, ClipboardList, Phone } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";

interface ActivitiesBoardProps {
  leadId: string;
  leadName: string;
  currentPipelineId: string | null;
  currentSubOriginId?: string | null;
  subOriginId?: string | null;
  onLeadMoved?: () => void;
}

const getTipoIcon = (tipo: string) => {
  switch (tipo) {
    case 'tarefas':
      return <ClipboardList className="h-5 w-5" strokeWidth={1.5} />;
    case 'ligacao':
      return <Phone className="h-5 w-5" strokeWidth={1.5} />;
    default:
      return null;
  }
};

export function ActivitiesBoard({ leadId, leadName, currentPipelineId, currentSubOriginId, subOriginId, onLeadMoved }: ActivitiesBoardProps) {
  const [isAddActivityOpen, setIsAddActivityOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<LeadActivity | null>(null);

  const {
    pipelines,
    viewingPipelineId,
    activities,
    selectedActivity,
    isLoadingActivities,
    currentPipelineName,
    handlePipelineClick,
    handleActivityClick,
    handleAddActivity,
    handleDeleteActivity,
    handleToggleConcluida,
  } = useLeadActivities({ leadId, currentPipelineId, subOriginId });

  const handleEditActivity = useCallback((activity: LeadActivity) => {
    setEditingActivity(activity);
    setIsAddActivityOpen(true);
  }, []);

  const handleOpenAddDialog = useCallback(() => {
    setEditingActivity(null);
    setIsAddActivityOpen(true);
  }, []);

  const handleCloseAddDialog = useCallback((open: boolean) => {
    setIsAddActivityOpen(open);
    if (!open) {
      setEditingActivity(null);
    }
  }, []);

  const handleSubmitActivity = useCallback(async (activity: { titulo: string; tipo: string; data: Date; hora: string }) => {
    await handleAddActivity(activity, editingActivity?.id);
    setEditingActivity(null);
  }, [handleAddActivity, editingActivity?.id]);

  const handleSaveNotes = useCallback(async (activityId: string, notes: string, activityGroupId?: string | null) => {
    try {
      // Se a atividade tiver um group_id, atualizar todas do grupo
      if (activityGroupId) {
        await supabase
          .from("lead_activities")
          .update({ notas: notes })
          .eq("activity_group_id", activityGroupId);
      } else {
        await supabase
          .from("lead_activities")
          .update({ notas: notes })
          .eq("id", activityId);
      }
    } catch (error) {
      console.error("Error saving notes:", error);
    }
  }, []);

  return (
    <div className="space-y-4">
      {/* Step Navigation */}
      <Card className="border-border/20 dark:border-white/[0.06] bg-card shadow-none">
        <CardContent className="p-4 pt-2">
          <StepNavigation
            pipelines={pipelines}
            viewingPipelineId={viewingPipelineId}
            currentPipelineId={currentPipelineId}
            leadId={leadId}
            leadName={leadName}
            currentSubOriginId={currentSubOriginId}
            onPipelineClick={handlePipelineClick}
            onLeadMoved={onLeadMoved}
          />
        </CardContent>
      </Card>

      {/* Two columns layout - left narrower */}
      <div className="grid grid-cols-1 lg:grid-cols-[480px_1fr] gap-4 h-[calc(100vh-420px)] min-h-0 overflow-hidden">
        {/* Left block - Activities List */}
        <Card className="border-border/20 dark:border-white/[0.06] bg-card shadow-none flex flex-col overflow-hidden">
          <CardContent className="p-4 flex flex-col h-full min-h-0">
            {isLoadingActivities ? (
              <div className="space-y-3 flex-1">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <>
                {/* Column headers */}
                <div className="flex items-center gap-2 pb-2 border-b border-black/10 dark:border-white/10 mb-2 flex-shrink-0">
                  <span className="flex-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">Atividade</span>
                  <span className="w-14 text-xs font-medium text-muted-foreground uppercase tracking-wide text-center">Data</span>
                  <span className="w-16 text-xs font-medium text-muted-foreground uppercase tracking-wide text-center">Concluído</span>
                  <span className="w-8"></span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
                  {activities.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                      <p className="text-sm text-muted-foreground">
                        Clique abaixo para criar sua primeira atividade
                      </p>
                    </div>
                  ) : (
                    activities.map((activity, index) => (
                      <div key={activity.id}>
                        <div
                          onClick={() => handleActivityClick(activity)}
                          className={cn(
                            "flex items-center gap-3 py-2 px-2 rounded-lg cursor-pointer transition-colors",
                          selectedActivity?.id === activity.id 
                            ? "bg-black/[0.04] dark:bg-white/[0.06]" 
                            : "hover:bg-muted/50",
                            activity.concluida && "opacity-60"
                          )}
                        >
                          {/* Ícone do tipo ou número em círculo */}
                          <div className="flex items-center justify-center w-7 h-7 flex-shrink-0 text-foreground">
                              {getTipoIcon(activity.tipo) || (
                                <span className={cn(
                                  "flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium",
                                  activity.concluida 
                                    ? "bg-neutral-800 dark:bg-white/20 text-white" 
                                    : "bg-neutral-900 dark:bg-white/30 text-white"
                                )}>
                                  {index + 1}
                              </span>
                            )}
                          </div>

                          {/* Atividade - título */}
                          <p className="text-sm font-semibold truncate flex-1 min-w-0">
                            {activity.titulo}
                          </p>

                          {/* Data - formato dd/MM */}
                          <span className="w-14 text-xs font-semibold text-muted-foreground text-center flex-shrink-0">
                            {format(new Date(activity.data + 'T00:00:00'), "dd/MM")}
                          </span>

                          {/* Concluído - checkbox */}
                          <div className="w-16 flex justify-center flex-shrink-0">
                            <Checkbox
                              checked={activity.concluida}
                              onCheckedChange={(checked) => {
                                if (typeof checked === 'boolean') {
                                  handleToggleConcluida(activity.id, checked);
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>

                          {/* Menu 3 pontos */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenuItem onClick={() => handleEditActivity(activity)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleDeleteActivity(activity.id)} 
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        {index < activities.length - 1 && (
                          <div className="mx-6 border-b border-border/30 dark:border-white/[0.06]" />
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Add activity button at bottom */}
                <Button
                  variant="outline"
                  className="w-full mt-4 border-dashed flex-shrink-0"
                  onClick={handleOpenAddDialog}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nova atividade
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Right block - Activity Details / Tasks */}
        <Card className="border-border/20 dark:border-white/[0.06] bg-card shadow-none flex flex-col overflow-hidden">
          <CardContent className="p-4 h-full flex flex-col min-h-0 overflow-y-auto">
            <ActivityDetails
              activity={selectedActivity}
              leadId={leadId}
              onSaveNotes={handleSaveNotes}
            />
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Activity Dialog */}
      <AddActivityDialog
        open={isAddActivityOpen}
        onOpenChange={handleCloseAddDialog}
        stepName={currentPipelineName}
        onAddActivity={handleSubmitActivity}
        editingActivity={editingActivity}
      />
    </div>
  );
}
