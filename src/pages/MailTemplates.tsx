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
import { TemplateEditor } from "@/components/mail/TemplateEditor";

interface EmailTemplate {
  id: string;
  name: string;
  subject: string | null;
  created_at: string;
  body_html?: string | null;
}

export default function MailTemplates() {
  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<EmailTemplate | null>(null);
  const [editing, setEditing] = useState<EmailTemplate | null>(null);

  const { data: templates = [], refetch } = useQuery({
    queryKey: ["email-templates-all"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("email_templates")
        .select("id,name,subject,created_at,body_html")
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
    const { data, error } = await (supabase as any)
      .from("email_templates")
      .insert({ name: newName.trim(), subject: "", body_html: "" })
      .select("id,name,subject,created_at")
      .single();
    if (error) return toast.error("Erro ao criar template");
    setNameDialogOpen(false);
    refetch();
    setEditing(data as EmailTemplate); // open the visual editor right away
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

  // Visual email editor (Elementor-style) ─ full screen
  if (editing) {
    return (
      <TemplateEditor
        template={editing}
        onBack={() => { setEditing(null); refetch(); }}
      />
    );
  }

  return (
    <div className="h-full flex flex-col p-6 w-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Templates</h1>
        <Button
          onClick={openCreate}
          className="h-10 gap-2 rounded-xl bg-purple-900 hover:bg-purple-800 text-white border-0 font-semibold"
        >
          <Plus className="h-4 w-4" /> Criar template
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="grid grid-cols-[1fr_130px_44px] items-center gap-2 px-4 py-2.5 bg-zinc-500/[0.06] text-[13px] font-semibold text-muted-foreground uppercase tracking-wide">
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
            <button
              onClick={() => setEditing(t)}
              className="flex items-center gap-3 min-w-0 text-left group"
            >
              <div className="w-[72px] h-[72px] rounded-sm border border-border overflow-hidden bg-white flex-shrink-0 relative group-hover:border-foreground/30 transition-colors">
                {t.body_html && t.body_html.includes("<") ? (
                  <iframe
                    title={t.name}
                    srcDoc={t.body_html}
                    scrolling="no"
                    tabIndex={-1}
                    aria-hidden
                    className="border-0 pointer-events-none absolute top-0 left-0"
                    style={{ width: 600, height: 600, transform: `scale(${72 / 600})`, transformOrigin: "top left" }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <LayoutTemplate className="h-5 w-5 text-muted-foreground/40" />
                  </div>
                )}
              </div>
              <span className="font-medium truncate">{t.name}</span>
            </button>
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
                  <DropdownMenuItem onClick={() => setEditing(t)}>
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
