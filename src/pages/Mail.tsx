import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { Plus, MoreVertical, Pencil, Trash2, Zap, Copy, ArrowLeft } from "lucide-react";
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

export default function Mail() {
  const [editing, setEditing] = useState<EmailAutomation | null>(null);
  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<EmailAutomation | null>(null);

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

  const openCreate = () => { setNewName(""); setNameDialogOpen(true); };

  const confirmCreate = async () => {
    if (!newName.trim()) return toast.error("Dê um nome à campanha");
    const { data, error } = await (supabase as any)
      .from("email_automations")
      .insert({ name: newName.trim(), is_active: true, subject: "", body_html: "" })
      .select("*")
      .single();
    if (error) return toast.error("Erro ao criar campanha");
    setNameDialogOpen(false);
    refetch();
    setEditing(data as EmailAutomation); // open the blank builder page
  };

  const toggleActive = async (a: EmailAutomation) => {
    const { error } = await (supabase as any).from("email_automations").update({ is_active: !a.is_active }).eq("id", a.id);
    if (error) return toast.error("Erro ao atualizar");
    refetch();
  };

  const duplicate = async (a: EmailAutomation) => {
    const { error } = await (supabase as any).from("email_automations").insert({
      name: `${a.name} (cópia)`,
      trigger_pipeline_id: a.trigger_pipeline_id,
      sub_origin_id: a.sub_origin_id,
      subject: a.subject,
      body_html: a.body_html,
      is_active: false,
      flow_steps: a.flow_steps,
    });
    if (error) return toast.error("Erro ao duplicar");
    toast.success("Campanha duplicada!");
    refetch();
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    const id = confirmDelete.id;
    setConfirmDelete(null);
    const { error } = await (supabase as any).from("email_automations").delete().eq("id", id);
    if (error) return toast.error("Erro ao remover");
    toast.success("Campanha removida!");
    refetch();
  };

  // ── Blank campaign page (starting point — to be built next) ──
  if (editing) {
    return (
      <div className="h-full flex flex-col bg-white dark:bg-background">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border flex-shrink-0">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg" onClick={() => { setEditing(null); refetch(); }}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="font-bold text-lg truncate">{editing.name}</h2>
        </div>
        <div className="flex-1 bg-white dark:bg-background" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6 w-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Mail</h1>
        <Button onClick={openCreate} className="h-10 gap-2 rounded-xl bg-gradient-to-r from-purple-700 to-purple-900 text-white hover:opacity-95 border-0 font-semibold">
          <Plus className="h-4 w-4" /> Criar campanha
        </Button>
      </div>

      <div className="rounded-2xl border border-border overflow-hidden">
        <div className="grid grid-cols-[1fr_130px_110px_44px] items-center gap-2 px-4 py-2.5 bg-zinc-500/[0.06] text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <div>Nome</div>
          <div>Data de criação</div>
          <div className="text-center">Status</div>
          <div className="text-center">Ações</div>
        </div>
        {automations.length === 0 && (
          <div className="px-4 py-10 border-t border-border text-center text-sm text-muted-foreground">
            Nenhuma campanha ainda. Clique em <b>Criar campanha</b> para começar.
          </div>
        )}
        {automations.map((a) => (
          <div key={a.id} className="grid grid-cols-[1fr_130px_110px_44px] items-center gap-2 px-4 py-3 border-t border-border text-sm">
            <div className="flex items-center gap-2 min-w-0">
              <Zap className="h-4 w-4 text-purple-700 flex-shrink-0" />
              <span className="font-medium truncate">{a.name}</span>
            </div>
            <div className="text-muted-foreground">{new Date(a.created_at).toLocaleDateString("pt-BR")}</div>
            <div className="flex justify-center">
              <Switch checked={a.is_active} onCheckedChange={() => toggleActive(a)} />
            </div>
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg"><MoreVertical className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setEditing(a)}>
                    <Pencil className="h-4 w-4 mr-2" /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => duplicate(a)}>
                    <Copy className="h-4 w-4 mr-2" /> Duplicar
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

      {/* Name dialog before opening the campaign page */}
      <Dialog open={nameDialogOpen} onOpenChange={setNameDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Nova campanha de e-mail</DialogTitle></DialogHeader>
          <div className="py-2">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome da campanha" autoFocus onKeyDown={(e) => e.key === "Enter" && confirmCreate()} />
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
            <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
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
