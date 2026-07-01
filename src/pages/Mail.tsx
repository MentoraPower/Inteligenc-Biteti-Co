import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Pipeline } from "@/types/crm";
import { EmailFlowBuilder } from "@/components/crm/EmailFlowBuilder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Mail as MailIcon, Plus, MoreVertical, Pencil, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";

interface EmailAutomation {
  id: string;
  name: string;
  trigger_pipeline_id: string | null;
  sub_origin_id: string | null;
  subject: string;
  body_html: string;
  is_active: boolean;
  created_at: string;
  flow_steps: any[] | null;
}

type BuilderState = { mode: "create" | "edit"; automation?: EmailAutomation; name: string };

export default function Mail() {
  const [builder, setBuilder] = useState<BuilderState | null>(null);
  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<EmailAutomation | null>(null);

  const { data: pipelines = [] } = useQuery({
    queryKey: ["mail-pipelines"],
    queryFn: async () => {
      const { data } = await supabase.from("pipelines").select("*").order("ordem", { ascending: true });
      return (data || []) as Pipeline[];
    },
  });

  const { data: automations = [], refetch } = useQuery({
    queryKey: ["email-automations-all"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("email_automations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as EmailAutomation[];
    },
  });

  const pipelineName = (id: string | null) => pipelines.find((p) => p.id === id)?.nome || "—";

  const openCreate = () => { setNewName(""); setNameDialogOpen(true); };
  const confirmCreate = () => {
    if (!newName.trim()) return toast.error("Dê um nome à automação");
    setBuilder({ mode: "create", name: newName.trim() });
    setNameDialogOpen(false);
  };

  const toggleActive = async (a: EmailAutomation) => {
    const { error } = await (supabase as any).from("email_automations").update({ is_active: !a.is_active }).eq("id", a.id);
    if (error) return toast.error("Erro ao atualizar");
    refetch();
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    const id = confirmDelete.id;
    setConfirmDelete(null);
    const { error } = await (supabase as any).from("email_automations").delete().eq("id", id);
    if (error) return toast.error("Erro ao remover");
    toast.success("Automação removida!");
    refetch();
  };

  // Persist the visual flow — mirrors the CRM AutomationsDropdown save logic.
  const handleSave = async (steps: any[]) => {
    if (!builder) return;
    const emailSteps = steps.filter((s) => s.type === "email");
    if (emailSteps.length === 0) return toast.error("Adicione pelo menos um passo de e-mail");

    const triggerStep = steps.find((s) => s.type === "trigger");
    const triggers = triggerStep?.data?.triggers as Array<{ id: string; type: string; pipelineId?: string }> | undefined;
    const hasTriggers = triggers && triggers.length > 0;
    const hasLegacy = triggerStep?.data?.triggerPipelineId || builder.automation?.trigger_pipeline_id;
    if (!hasTriggers && !hasLegacy) return toast.error("Selecione pelo menos um gatilho no nó de trigger");

    const pipelineTrigger = triggers?.find((t) => t.type === "lead_entered_pipeline");
    const extracted = pipelineTrigger?.pipelineId || triggerStep?.data?.triggerPipelineId || builder.automation?.trigger_pipeline_id || null;
    const triggerPipelineIdForDb = extracted && String(extracted).trim() ? extracted : null;

    const firstEmail = emailSteps[0];
    const finalSubject = firstEmail.data.subject || builder.automation?.subject || "";
    const finalBodyHtml = firstEmail.data.bodyHtml || builder.automation?.body_html || "";
    if (!finalSubject.trim()) return toast.error("Digite o assunto do e-mail");
    if (!finalBodyHtml.trim()) return toast.error("Digite o conteúdo do e-mail");

    try {
      if (builder.mode === "edit" && builder.automation) {
        const { error } = await (supabase as any).from("email_automations").update({
          name: builder.name,
          trigger_pipeline_id: triggerPipelineIdForDb,
          subject: finalSubject,
          body_html: finalBodyHtml,
          flow_steps: steps,
        }).eq("id", builder.automation.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("email_automations").insert({
          name: builder.name,
          trigger_pipeline_id: triggerPipelineIdForDb,
          sub_origin_id: null,
          subject: finalSubject,
          body_html: finalBodyHtml,
          is_active: true,
          flow_steps: steps,
        });
        if (error) throw error;
      }
      toast.success(builder.mode === "edit" ? "Automação atualizada!" : "Automação criada!");
      setBuilder(null);
      refetch();
    } catch (e: any) {
      toast.error(e?.message ? `Erro ao salvar: ${e.message}` : "Erro ao salvar automação");
    }
  };

  const initialSteps = (a?: EmailAutomation) => {
    if (a?.flow_steps && a.flow_steps.length > 0) return a.flow_steps;
    if (a) {
      return [
        { id: "trigger-1", type: "trigger", position: { x: 100, y: 200 }, data: { label: "Adicionar gatilhos", triggerType: "lead_entered_pipeline", triggerPipelineId: a.trigger_pipeline_id } },
        { id: "email-1", type: "email", position: { x: 380, y: 200 }, data: { label: "Enviar e-mail", subject: a.subject, bodyHtml: a.body_html } },
        { id: "end-1", type: "end", position: { x: 660, y: 200 }, data: { label: "Fluxo finalizado" } },
      ];
    }
    return undefined;
  };

  // Full-screen flow builder
  if (builder) {
    return (
      <div className="relative flex flex-col h-full w-full overflow-hidden">
        <EmailFlowBuilder
          automationName={builder.name}
          onSave={handleSave}
          onCancel={() => setBuilder(null)}
          initialSteps={initialSteps(builder.automation)}
          pipelines={pipelines}
          subOriginId={null}
          automationId={builder.automation?.id}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6 max-w-5xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Mail</h1>
        <Button onClick={openCreate} className="h-10 gap-2 rounded-xl bg-gradient-to-r from-purple-700 to-purple-900 text-white hover:opacity-95 border-0 font-semibold">
          <Plus className="h-4 w-4" /> Criar automação
        </Button>
      </div>

      {automations.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-20">
          <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center">
            <MailIcon className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">Nenhuma automação de e-mail ainda.</p>
          <Button onClick={openCreate} variant="outline" className="rounded-xl gap-2"><Plus className="h-4 w-4" /> Criar a primeira</Button>
        </div>
      ) : (
        <div className="rounded-2xl border border-border overflow-hidden">
          <div className="grid grid-cols-[1fr_180px_90px_44px] items-center gap-2 px-4 py-2.5 bg-zinc-500/[0.06] text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <div>Nome</div>
            <div>Gatilho (pipeline)</div>
            <div className="text-center">Ativa</div>
            <div />
          </div>
          {automations.map((a) => (
            <div key={a.id} className="grid grid-cols-[1fr_180px_90px_44px] items-center gap-2 px-4 py-3 border-t border-border text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <Zap className="h-4 w-4 text-purple-700 flex-shrink-0" />
                <span className="font-medium truncate">{a.name}</span>
              </div>
              <div className="text-muted-foreground truncate">{pipelineName(a.trigger_pipeline_id)}</div>
              <div className="flex justify-center">
                <Switch checked={a.is_active} onCheckedChange={() => toggleActive(a)} />
              </div>
              <div className="flex justify-end">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg"><MoreVertical className="h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setBuilder({ mode: "edit", automation: a, name: a.name })}>
                      <Pencil className="h-4 w-4 mr-2" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setConfirmDelete(a)} className="text-destructive focus:text-destructive">
                      <Trash2 className="h-4 w-4 mr-2" /> Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Name dialog before opening the builder */}
      <Dialog open={nameDialogOpen} onOpenChange={setNameDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Nova automação de e-mail</DialogTitle></DialogHeader>
          <div className="py-2">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome da automação" autoFocus onKeyDown={(e) => e.key === "Enter" && confirmCreate()} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNameDialogOpen(false)}>Cancelar</Button>
            <Button onClick={confirmCreate} className="bg-gradient-to-r from-purple-700 to-purple-900 text-white border-0">Continuar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir automação?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <b>"{confirmDelete?.name}"</b>? Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={doDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
