import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Plus, LayoutTemplate, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface EmailTemplate {
  id: string;
  name: string;
  subject: string | null;
  created_at: string;
}

export default function MailTemplates() {
  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<EmailTemplate | null>(null);

  const { data: templates = [], refetch } = useQuery({
    queryKey: ["email-templates-all"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("email_templates")
        .select("id,name,subject,created_at")
        .order("created_at", { ascending: false });
      return (data || []) as EmailTemplate[];
    },
  });

  const openCreate = () => {
    setNewName("");
    setNameDialogOpen(true);
  };

  const confirmCreate = async () => {
    if (!newName.trim()) return;
    const { error } = await (supabase as any)
      .from("email_templates")
      .insert({ name: newName.trim(), subject: "", body_html: "" });
    if (error) return toast.error("Erro ao criar template");
    setNameDialogOpen(false);
    refetch();
    toast.success("Template criado!");
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    const id = confirmDelete.id;
    setConfirmDelete(null);
    const { error } = await (supabase as any).from("email_templates").delete().eq("id", id);
    if (error) return toast.error("Erro ao remover");
    toast.success("Template removido!");
    refetch();
  };

  return (
    <div className="h-full flex flex-col p-6 w-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Templates</h1>
        <Button
          onClick={openCreate}
          className="h-10 gap-2 rounded-xl bg-gradient-to-r from-purple-700 to-purple-900 text-white hover:opacity-95 border-0 font-semibold"
        >
          <Plus className="h-4 w-4" /> Criar template
        </Button>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        Crie e-mails no editor visual e salve para reutilizar nas campanhas.
      </p>

      <div className="rounded-2xl border border-border overflow-hidden">
        <div className="grid grid-cols-[1fr_130px_44px] items-center gap-2 px-4 py-2.5 bg-zinc-500/[0.06] text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <div>Nome</div>
          <div>Data de criação</div>
          <div className="text-center">Ações</div>
        </div>
        {templates.length === 0 && (
          <div className="px-4 py-10 border-t border-border text-center text-sm text-muted-foreground">
            Nenhum template ainda. Clique em <b>Criar template</b> para começar.
          </div>
        )}
        {templates.map((t) => (
          <div
            key={t.id}
            className="grid grid-cols-[1fr_130px_44px] items-center gap-2 px-4 py-3 border-t border-border text-sm"
          >
            <div className="flex items-center gap-2 min-w-0">
              <LayoutTemplate className="h-4 w-4 text-purple-700 flex-shrink-0" />
              <span className="font-medium truncate">{t.name}</span>
            </div>
            <div className="text-muted-foreground">
              {new Date(t.created_at).toLocaleDateString("pt-BR")}
            </div>
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => toast.info("Editor visual — em construção")}>
                    <Pencil className="h-4 w-4 mr-2" /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setConfirmDelete(t)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}
      </div>

      {/* Name dialog before creating a template */}
      <Dialog open={nameDialogOpen} onOpenChange={setNameDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo template de e-mail</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nome do template"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && confirmCreate()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNameDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={confirmCreate}
              className="bg-gradient-to-r from-purple-700 to-purple-900 text-white border-0"
            >
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir template?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <b>"{confirmDelete?.name}"</b>? Essa ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={doDelete}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
