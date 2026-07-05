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
import { Plus, LayoutTemplate, MoreVertical, Pencil, Trash2, Clock } from "lucide-react";
import { toast } from "sonner";
import { TemplateEditor } from "@/components/mail/TemplateEditor";

interface EmailTemplate {
  id: string;
  name: string;
  subject: string | null;
  created_at: string;
  body_html?: string | null;
}

// Make the email fit the card preview width.
const fitDoc = (html: string) => {
  const css = "<style>html,body{margin:0;padding:0}*{box-sizing:border-box;max-width:100%!important}table{width:100%!important;max-width:100%!important}img{max-width:100%!important;height:auto!important}</style>";
  return html.includes("</head>") ? html.replace("</head>", css + "</head>") : css + html;
};

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

  const openCreate = async () => {
    // Create the template immediately and open the editor; the name popup shows on top.
    const { data, error } = await (supabase as any)
      .from("email_templates")
      .insert({ name: "Novo template", subject: "", body_html: "" })
      .select("id,name,subject,created_at")
      .single();
    if (error) return toast.error("Erro ao criar template");
    refetch();
    setEditing(data as EmailTemplate);
    setNewName("");
    setNameDialogOpen(true);
  };

  const confirmCreate = async () => {
    if (!editing) { setNameDialogOpen(false); return; }
    const name = newName.trim() || "Novo template";
    const { error } = await (supabase as any)
      .from("email_templates")
      .update({ name })
      .eq("id", editing.id);
    if (error) return toast.error("Erro ao salvar nome");
    setEditing({ ...editing, name });
    setNameDialogOpen(false);
    refetch();
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

  const nameDialogEl = (
    <Dialog open={nameDialogOpen} onOpenChange={setNameDialogOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nome do template</DialogTitle>
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
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // Visual email editor (Elementor-style) ─ full screen
  if (editing) {
    return (
      <>
        <TemplateEditor
          template={editing}
          onBack={() => { setEditing(null); refetch(); }}
        />
        {nameDialogEl}
      </>
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
        {templates.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            Nenhum template ainda. Clique em <b>Criar template</b> para começar.
          </div>
        ) : (
          <div className="grid grid-cols-3 xl:grid-cols-4 gap-4">
            {templates.map((t) => (
              <div key={t.id} className="rounded-xl border border-border overflow-hidden bg-card flex flex-col group hover:border-foreground/20 hover:shadow-md transition-all">
                {/* Top: real email preview (16:9) */}
                <button
                  onClick={() => setEditing(t)}
                  className="block aspect-[4/3] bg-white overflow-hidden relative border-b border-border"
                >
                  {t.body_html && t.body_html.includes("<") ? (
                    <iframe
                      title={t.name}
                      srcDoc={fitDoc(t.body_html)}
                      scrolling="no"
                      tabIndex={-1}
                      aria-hidden
                      className="absolute inset-0 w-full h-full border-0 pointer-events-none"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <LayoutTemplate className="h-8 w-8 text-muted-foreground/40" />
                    </div>
                  )}
                </button>
                {/* Bottom: name + subject, divider, updated date + 3-dots */}
                <div className="p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <button onClick={() => setEditing(t)} className="min-w-0 text-left flex-1">
                      <p className="font-bold text-base leading-snug truncate">{t.name}</p>
                      <p className="text-[13px] text-muted-foreground truncate mt-1">
                        {t.subject || "Sem linha de assunto"}
                      </p>
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg flex-shrink-0 -mr-1.5 -mt-1 text-muted-foreground hover:text-foreground">
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
                  <div className="flex items-center gap-2 text-xs text-muted-foreground pt-3 border-t border-border">
                    <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>Editado em {new Date(t.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Name popup (shown on top of the editor after creating) */}
      {nameDialogEl}

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
