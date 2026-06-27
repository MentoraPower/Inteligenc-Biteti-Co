import { memo, useState, useEffect, useRef, useCallback } from "react";
import { ClipboardList, Phone, Bold, Italic, List as ListIcon, ListOrdered, Quote, ChevronDown, Heading1, Heading2, Pilcrow, Loader2, CheckCircle2, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import TiptapLink from "@tiptap/extension-link";
import { LeadActivity } from "@/hooks/use-lead-activities";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ActivityDetailsProps {
  activity: LeadActivity | null;
  leadId: string;
  onSaveNotes: (activityId: string, notes: string, activityGroupId?: string | null) => void;
}

export const ActivityDetails = memo(function ActivityDetails({
  activity,
  leadId,
  onSaveNotes,
}: ActivityDetailsProps) {
  const [showToolbar, setShowToolbar] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const toolbarTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const saveNotesTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showSavedStatus = useCallback(() => {
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  }, []);

  const resetToolbarTimeout = useCallback(() => {
    if (toolbarTimeoutRef.current) clearTimeout(toolbarTimeoutRef.current);
    toolbarTimeoutRef.current = setTimeout(() => setShowToolbar(false), 10000);
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ inline: true, allowBase64: true }),
      TiptapLink.configure({
        openOnClick: true,
        HTMLAttributes: { class: 'text-primary underline hover:text-primary/80 cursor-pointer', target: '_blank' },
      }),
    ],
    content: "",
    onUpdate: ({ editor }) => {
      resetToolbarTimeout();
      setSaveStatus('saving');
      if (saveNotesTimeoutRef.current) clearTimeout(saveNotesTimeoutRef.current);
      if (activity) {
        saveNotesTimeoutRef.current = setTimeout(() => {
          onSaveNotes(activity.id, editor.getHTML(), activity.activity_group_id);
          showSavedStatus();
        }, 800);
      }
    },
    onFocus: () => { 
      setShowToolbar(true); 
      resetToolbarTimeout(); 
    },
  });

  useEffect(() => {
    if (!activity) return;
    setSaveStatus('idle');
    if (editor && editor.getHTML() !== (activity.notas || "")) {
      editor.commands.setContent(activity.notas || "");
    }
    setShowToolbar(false);
  }, [activity?.id, activity?.tipo, editor]);

  const handleImageUpload = useCallback(async (file: File) => {
    if (!editor || !activity || !file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) {
      toast.error('Arquivo inválido (máx 10MB, apenas imagens)');
      return;
    }
    setIsUploadingImage(true);
    try {
      const fileName = `${leadId}/activities/${activity.id}/${crypto.randomUUID()}.${file.name.split('.').pop()}`;
      const { error: uploadError } = await supabase.storage.from('lead_files').upload(fileName, file);
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage.from('lead_files').getPublicUrl(fileName);
      editor.chain().focus().setImage({ src: publicUrl }).run();
      toast.success('Imagem adicionada');
    } catch (error) { 
      console.error('Upload error:', error);
      toast.error('Erro ao enviar imagem'); 
    } finally { 
      setIsUploadingImage(false); 
    }
  }, [editor, activity, leadId]);

  if (!activity) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-sm text-muted-foreground text-center">
          Selecione uma atividade para ver os detalhes
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 pb-3 border-b border-black/5 dark:border-white/10">
        <div className="flex items-center justify-center text-foreground">
          {activity.tipo === 'ligacao' ? <Phone className="h-5 w-5" strokeWidth={1.5} /> : <ClipboardList className="h-5 w-5" strokeWidth={1.5} />}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold truncate">{activity.titulo}</h3>
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          {saveStatus === 'saving' && <><Loader2 className="h-3 w-3 animate-spin" />Salvando...</>}
          {saveStatus === 'saved' && <><CheckCircle2 className="h-3 w-3 text-green-500" />Salvo</>}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 mt-3 overflow-hidden">
        {activity.tipo === 'ligacao' ? (
          /* Ligação - Script editável direto no balão */
          <div className="h-full flex flex-col">
            <p className="text-xs text-muted-foreground mb-3">Escreva seu script para a ligação</p>
            
            {/* Balão editável que cresce conforme o conteúdo */}
            <div className="inline-block max-w-full">
              <div className="bg-green-100 dark:bg-green-900/40 text-foreground rounded-2xl rounded-tl-sm p-4 shadow-sm inline-block">
                <EditorContent 
                  editor={editor} 
                  className="prose prose-sm prose-invert max-w-none [&_.ProseMirror]:min-h-[24px] [&_.ProseMirror]:outline-none [&_.ProseMirror_p]:mb-2 [&_.ProseMirror_p:last-child]:mb-0 [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-['Digite_seu_script...'] [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-primary-foreground/50 [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none" 
                />
              </div>
            </div>
          </div>
        ) : (
          /* Tarefas - Editor com toolbar */
          <div className="h-full flex flex-col">
            {/* Toolbar - only visible when active */}
            <div className={cn(
              "flex items-center gap-1 pb-2 border-b border-black/5 dark:border-white/10 transition-all duration-300",
              showToolbar ? "opacity-100 h-auto" : "opacity-0 h-0 overflow-hidden pb-0 border-b-0"
            )}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs">
                    {editor?.isActive("heading", { level: 1 }) ? (
                      <><Heading1 className="h-3.5 w-3.5" />Título 1</>
                    ) : editor?.isActive("heading", { level: 2 }) ? (
                      <><Heading2 className="h-3.5 w-3.5" />Título 2</>
                    ) : (
                      <><Pilcrow className="h-3.5 w-3.5" />Parágrafo</>
                    )}
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}>
                    <Heading1 className="h-4 w-4 mr-2" />Título 1
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>
                    <Heading2 className="h-4 w-4 mr-2" />Título 2
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => editor?.chain().focus().setParagraph().run()}>
                    <Pilcrow className="h-4 w-4 mr-2" />Parágrafo
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Separator orientation="vertical" className="h-5 mx-1" />

              <Button 
                variant="ghost" 
                size="icon" 
                className={cn("h-8 w-8", editor?.isActive("bold") && "bg-muted")}
                onClick={() => editor?.chain().focus().toggleBold().run()}
              >
                <Bold className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className={cn("h-8 w-8", editor?.isActive("italic") && "bg-muted")}
                onClick={() => editor?.chain().focus().toggleItalic().run()}
              >
                <Italic className="h-4 w-4" />
              </Button>

              <Separator orientation="vertical" className="h-5 mx-1" />

              <Button 
                variant="ghost" 
                size="icon" 
                className={cn("h-8 w-8", editor?.isActive("bulletList") && "bg-muted")}
                onClick={() => editor?.chain().focus().toggleBulletList().run()}
              >
                <ListIcon className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className={cn("h-8 w-8", editor?.isActive("orderedList") && "bg-muted")}
                onClick={() => editor?.chain().focus().toggleOrderedList().run()}
              >
                <ListOrdered className="h-4 w-4" />
              </Button>

              <Separator orientation="vertical" className="h-5 mx-1" />

              <Button 
                variant="ghost" 
                size="icon" 
                className={cn("h-8 w-8", editor?.isActive("blockquote") && "bg-muted")}
                onClick={() => editor?.chain().focus().toggleBlockquote().run()}
              >
                <Quote className="h-4 w-4" />
              </Button>

              <input 
                type="file" 
                ref={imageInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])} 
              />
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => imageInputRef.current?.click()} 
                disabled={isUploadingImage} 
                className="h-8 w-8"
              >
                {isUploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
              </Button>
            </div>

            {/* Editor */}
            <div className="flex-1 overflow-y-auto mt-2">
              <EditorContent 
                editor={editor} 
                className="prose prose-sm max-w-none h-full [&_.ProseMirror]:min-h-full [&_.ProseMirror]:outline-none [&_.ProseMirror]:p-2" 
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
